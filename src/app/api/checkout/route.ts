import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'buffer'

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY

// Tibs packages matching wallet page
const PACKAGES: Record<number, { tibs: number; price: number; label: string }> = {
    80: { tibs: 80, price: 10, label: 'Starter' },
    400: { tibs: 400, price: 50, label: 'Popular' },
    800: { tibs: 800, price: 100, label: 'Best Value' },
    8000: { tibs: 8000, price: 1000, label: 'TONBALL' },
}

export async function POST(req: NextRequest) {
    let debugStatus = 'init';
    try {
        debugStatus = 'validating_env';
        // Validate environment
        if (!PAYMONGO_SECRET_KEY) {
            console.error('PAYMONGO_SECRET_KEY is not configured')
            return NextResponse.json({ error: 'Payment system not configured. Contact admin.' }, { status: 500 })
        }

        debugStatus = 'parsing_body';
        const { tibs, userId } = await req.json()

        if (!tibs || !userId) {
            return NextResponse.json({ error: 'Missing tibs or userId' }, { status: 400 })
        }

        const pkg = PACKAGES[tibs]
        if (!pkg) {
            return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
        }

        debugStatus = 'creating_session';
        // Create PayMongo Checkout Session
        // Use trim() to clean up the environment variable
        const rawKey = PAYMONGO_SECRET_KEY || '';
        const cleanKey = rawKey.trim();

        if (!cleanKey) {
            console.error('PAYMONGO_SECRET_KEY is empty or undefined');
            // Proceed anyway to let it fail with 401 if empty, but logging helps
        }

        const authHeader = `Basic ${btoa(cleanKey + ':')}`;

        const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        send_email_receipt: true,
                        show_description: true,
                        show_line_items: true,
                        description: `Purchase ${pkg.tibs} Tibs for 8TONBALL`,
                        line_items: [
                            {
                                currency: 'PHP',
                                amount: pkg.price * 100, // PayMongo expects centavos
                                name: `${pkg.tibs} Tibs (${pkg.label})`,
                                quantity: 1,
                            }
                        ],
                        payment_method_types: [
                            'card',
                            'gcash',
                            'grab_pay',
                            'paymaya',
                            'qrph',
                        ],
                        success_url: `${req.nextUrl.origin}/wallet/success?tibs=${pkg.tibs}&session_id={cs_id}`,
                        cancel_url: `${req.nextUrl.origin}/wallet?cancelled=true`,
                        metadata: {
                            user_id: userId,
                            tibs: pkg.tibs.toString(),
                        }
                    }
                }
            })
        })

        debugStatus = 'reading_response';
        // Read text first to avoid JSON parse errors
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { error: 'Failed to parse JSON response', raw: responseText };
        }

        if (!response.ok) {
            console.error('PayMongo error:', data)
            const errorDetail = data.errors?.[0]?.detail || JSON.stringify(data);
            return NextResponse.json({
                error: `PayMongo Failed: ${response.status}`,
                details: errorDetail,
                debug_status: debugStatus,
                debug_url: 'https://api.paymongo.com/v1/checkout_sessions',
                debug_key_length: cleanKey.length,
                debug_key_start: cleanKey.substring(0, 5) + '...',
                debug_key_end: '...' + cleanKey.substring(cleanKey.length - 4)
            }, { status: 500 })
        }

        return NextResponse.json({
            checkout_url: data.data.attributes.checkout_url,
            checkout_id: data.data.id,
        })

    } catch (error: any) {
        console.error('Checkout error:', error)
        return NextResponse.json({
            error: error.message || 'Internal server error',
            stack: error.stack,
            debug_status: debugStatus,
            debug_key_configured: !!PAYMONGO_SECRET_KEY
        }, { status: 500 })
    }
}
