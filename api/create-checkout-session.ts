import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-02-24.acacia' as any,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { userId, targetUrl } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Build the success URL, optionally preserving the book they wanted to import
        let successUrl = 'https://codex-two-teal.vercel.app/';
        if (targetUrl) {
            successUrl = `https://codex-two-teal.vercel.app/?url=${encodeURIComponent(targetUrl)}`;
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: 'price_1T9CQBRjV64R8pPEEHT7Ua1a', quantity: 1 }],
            success_url: successUrl,
            cancel_url: 'https://codex-two-teal.vercel.app/',
            client_reference_id: userId, // This lets us identify the user in the webhook
            metadata: {
                userId,
            }
        });

        res.status(200).json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        res.status(500).json({ error: error.message });
    }
}
