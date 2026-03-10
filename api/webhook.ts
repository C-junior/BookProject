import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    try {
        // Expected format for FIREBASE_SERVICE_ACCOUNT is a stringified JSON object
        // Or we rely on individual environment variables
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : {
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle multiline private key from env
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase admin initialization error:', error);
    }
}

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-02-24.acacia' as any,
});

export const config = {
    api: {
        bodyParser: false, // Disabling body parser to retrieve the raw body for Stripe signature verification
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // Get raw body for webhook verification
    const chunks: any[] = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        return res.status(400).send('Webhook secret or signature missing');
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful checkout session
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;

        if (userId) {
            try {
                console.log(`Upgrading user ${userId} to Pro...`);
                // Update user document in Firestore to mark them as Pro
                await db.collection('users').doc(userId).set(
                    {
                        isPro: true,
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: session.subscription as string,
                    },
                    { merge: true }
                );
                console.log(`User ${userId} upgraded successfully.`);
            } catch (dbError) {
                console.error('Error updating user in Firestore:', dbError);
                return res.status(500).send('Database update failed');
            }
        } else {
            console.warn('Checkout session completed, but no userId found attached to session.');
        }
    }

    // Also handle subscription deletions/cancellations
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        // We would ideally query by stripeSubscriptionId here to set isPro: false
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
            }
        } catch (dbError) {
            console.error('Error downgrading user in Firestore:', dbError);
        }
    }

    res.json({ received: true });
}
