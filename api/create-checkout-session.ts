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
        console.log('Firebase Admin initialized successfully in create-checkout-session');
    } catch (error: any) {
        console.error('Firebase admin initialization error:', error?.message || error);
    }
}

// Initialize at module load
initFirebase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        console.error('STRIPE_SECRET_KEY is not configured');
        return res.status(500).json({ error: 'Payment service is not configured. Please contact support.' });
    }

    try {
        const stripe = new Stripe(secretKey.trim());

        const { userId, targetUrl } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
        }
        const idToken = authHeader.split('Bearer ')[1];

        // Guard: check Firebase is initialized
        const apps = admin.apps || [];
        if (!apps.length) {
            initFirebase();
            if (!(admin.apps || []).length) {
                return res.status(500).json({ error: 'Server error: Firebase not initialized' });
            }
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (decodedToken.uid !== userId) {
            return res.status(403).json({ error: 'Forbidden: UID mismatch' });
        }

        let successUrl = 'https://codex-two-teal.vercel.app/';
        if (targetUrl) {
            successUrl = `https://codex-two-teal.vercel.app/?url=${encodeURIComponent(targetUrl)}`;
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: 'price_1T9CQBRjV64R8pPEEHT7Ua1a', quantity: 1 }],
            success_url: successUrl,
            cancel_url: 'https://codex-two-teal.vercel.app/',
            client_reference_id: userId,
            metadata: {
                userId,
            }
        });

        res.status(200).json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error.message);
        const safeMessage = error.type === 'StripeAuthenticationError'
            ? 'Payment service authentication failed. Please contact support.'
            : 'Failed to create checkout session. Please try again.';
        res.status(500).json({ error: safeMessage });
    }
}
