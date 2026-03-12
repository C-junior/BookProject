import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });

import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

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
