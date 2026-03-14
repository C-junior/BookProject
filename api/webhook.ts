import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
function initFirebase() {
    try {
        if (admin.apps?.length) {
            return; // already initialized
        }
    } catch {
        // Not initialized yet, proceed
    }

    try {
        let serviceAccount: admin.ServiceAccount;

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('FIREBASE_PRIVATE_KEY is not set');
            }
            serviceAccount = {
                projectId: process.env.VITE_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            };
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin initialized successfully');
    } catch (error: any) {
        console.error('Firebase admin initialization error:', error?.message || error);
    }
}

// Initialize at module load
initFirebase();

function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    return new Stripe(key.trim());
}

/**
 * Read the raw body from the Vercel request as a Buffer.
 */
function getRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`Webhook handler called: method=${req.method}`);

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // Guard: check Firebase is initialized
    const apps = admin.apps || [];
    if (!apps.length) {
        // Try once more
        initFirebase();
        const retryApps = admin.apps || [];
        if (!retryApps.length) {
            console.error('Firebase Admin is not initialized — cannot process webhook');
            return res.status(500).json({ error: 'Server configuration error: Firebase not initialized' });
        }
    }

    const db = admin.firestore();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'];

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!sig) {
        console.error('Missing stripe-signature header');
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
        const stripe = getStripe();

        let rawBody: Buffer;
        if (req.body && Buffer.isBuffer(req.body)) {
            rawBody = req.body;
        } else if (typeof req.body === 'string') {
            rawBody = Buffer.from(req.body);
        } else {
            rawBody = await getRawBody(req);
        }

        console.log(`Webhook raw body size: ${rawBody.length} bytes`);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret.trim());
        console.log(`Webhook event verified: ${event.type} (${event.id})`);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle successful checkout session
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;

        console.log(`checkout.session.completed — client_reference_id: ${session.client_reference_id}, metadata.userId: ${session.metadata?.userId}, customer: ${session.customer}, subscription: ${session.subscription}`);

        if (userId) {
            try {
                console.log(`Upgrading user ${userId} to Pro...`);
                await db.collection('users').doc(userId).set(
                    {
                        isPro: true,
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: session.subscription as string,
                    },
                    { merge: true }
                );
                console.log(`User ${userId} upgraded to Pro successfully!`);
            } catch (dbError: any) {
                console.error('Error updating user in Firestore:', dbError.message || dbError);
                return res.status(500).json({ error: 'Database update failed' });
            }
        } else {
            console.warn('checkout.session.completed received, but no userId found');
        }
    }

    // Handle subscription cancellations
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`customer.subscription.deleted — subscription: ${subscription.id}`);

        try {
            const snapshot = await db.collection('users')
                .where('stripeSubscriptionId', '==', subscription.id)
                .get();

            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach((doc) => {
                    batch.update(doc.ref, { isPro: false });
                });
                await batch.commit();
                console.log(`Downgraded user for cancelled subscription ${subscription.id}`);
            } else {
                console.warn(`No user found with stripeSubscriptionId: ${subscription.id}`);
            }
        } catch (dbError: any) {
            console.error('Error downgrading user in Firestore:', dbError.message || dbError);
        }
    }

    return res.status(200).json({ received: true });
}
