import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const status: Record<string, any> = {
        method: req.method,
        timestamp: new Date().toISOString(),
        env: {
            STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING',
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'SET' : 'MISSING',
            FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? 'SET' : 'MISSING',
            FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING',
            FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? `SET (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'MISSING',
            VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'MISSING',
        }
    };

    try {
        const appsCount = (admin.apps || []).length;
        status.firebaseAdmin = { loaded: true, appsCount };

        if (!appsCount) {
            let serviceAccount: any;
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                status.initMethod = 'FIREBASE_SERVICE_ACCOUNT JSON';
            } else {
                const pk = process.env.FIREBASE_PRIVATE_KEY;
                serviceAccount = {
                    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: pk?.replace(/\\n/g, '\n'),
                };
                status.initMethod = 'individual env vars';
                status.serviceAccount = {
                    projectId: serviceAccount.projectId,
                    clientEmail: serviceAccount.clientEmail,
                    privateKeyLength: serviceAccount.privateKey?.length || 0,
                };
            }
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            status.firebaseInit = 'SUCCESS';
        } else {
            status.firebaseInit = 'ALREADY_INITIALIZED';
        }

        const db = admin.firestore();
        status.firestoreAccess = 'OK';
    } catch (e: any) {
        status.firebaseError = e.message;
        status.firebaseStack = e.stack?.split('\n').slice(0, 5);
    }

    try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
        status.stripe = { loaded: true };
    } catch (e: any) {
        status.stripeError = e.message;
    }

    return res.status(200).json(status);
}
