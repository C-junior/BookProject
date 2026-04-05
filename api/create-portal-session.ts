import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
function initFirebase() {
    try {
        if (admin.apps?.length) {
            return;
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
        console.log('Firebase Admin initialized successfully in create-portal-session');
    } catch (error: any) {
        console.error('Firebase admin initialization error:', error?.message || error);
    }
}

initFirebase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        console.error('STRIPE_SECRET_KEY is not configured');
        return res.status(500).json({ error: 'Payment service is not configured.' });
    }

    try {
        const stripe = new Stripe(secretKey.trim());

        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Verify Firebase token
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
        }
        const idToken = authHeader.split('Bearer ')[1];

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

        // Get stripeCustomerId from Firestore
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData?.stripeCustomerId) {
            return res.status(404).json({
                error: 'Nenhuma assinatura encontrada. Assine um plano primeiro.'
            });
        }

        // Create Stripe Customer Portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: userData.stripeCustomerId,
            return_url: 'https://codex-two-teal.vercel.app/',
            locale: 'pt-BR',
        });

        res.status(200).json({ url: session.url });
    } catch (error: any) {
        console.error('Portal session error:', error.message);
        const safeMessage = error.type === 'StripeAuthenticationError'
            ? 'Erro de autenticação no serviço de pagamento.'
            : 'Não foi possível abrir o portal de assinatura. Tente novamente.';
        res.status(500).json({ error: safeMessage });
    }
}
