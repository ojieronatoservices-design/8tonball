import { NextRequest, NextResponse } from 'next/server'

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY

// Tibs packages matching wallet page
const PACKAGES: Record<number, { tibs: number; price: number; label: string }> = {
    80: { tibs: 80, price: 10, label: 'Starter' },
    400: { tibs: 400, price: 50, label: 'Popular' },
    800: { tibs: 800, price: 100, label: 'Best Value' },
    8000: { tibs: 8000, price: 1000, label: 'TONBALL' },
}

export async function POST(req: NextRequest) {
    try {
        const { tibs, userId } = await req.json()

        if (!tibs || !userId) {
            return NextResponse.json({ error: 'Missing tibs or userId' }, { status: 400 })
        }

        const pkg = PACKAGES[tibs]
        if (!pkg) {
            return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
        }

        // Create PayMongo Checkout Session
        const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
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

        const data = await response.json()

        if (!response.ok) {
            console.error('PayMongo error:', data)
            return NextResponse.json({ error: data.errors?.[0]?.detail || 'PayMongo error' }, { status: 500 })
        }

        return NextResponse.json({
            checkout_url: data.data.attributes.checkout_url,
            checkout_id: data.data.id,
        })

    } catch (error: any) {
        console.error('Checkout error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
