import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const event = body.data
        const attributes = event?.attributes
        const type = attributes?.type

        console.log(`[Webhook] Received event: ${type}`)

        // Support all variations of success pings
        const supportedEvents = [
            'checkout_session.payment.paid',
            'charge.paid',
            'payment.paid',
            'source.chargeable'
        ]

        if (supportedEvents.includes(type)) {
            // PayMongo nesting: attributes.data is the resource (CheckoutSession or Charge)
            const resource = attributes.data
            const metadata = resource?.attributes?.metadata || attributes?.metadata

            if (!metadata?.user_id || !metadata?.tibs) {
                console.error('[Webhook] Missing required metadata:', metadata)
                return NextResponse.json({ error: 'Missing metadata' }, { status: 200 }) // Return 200 to acknowledge receipt
            }

            const userId = metadata.user_id
            const tibs = parseInt(metadata.tibs, 10)

            // 1. Log the transaction first for audit trail
            // We use 'system' or a specific marker to indicate automated fulfillment
            const { data: tx, error: txError } = await supabase.from('transactions').insert({
                user_id: userId,
                requested_tibs: tibs,
                status: 'approved',
                processed_at: new Date().toISOString(),
                proof_image_url: `paymongo://${resource?.id || type}`
            }).select().single()

            if (txError) {
                console.error('[Webhook] Failed to log transaction:', txError)
                // Continue anyway to try and credit the user
            }

            // 2. Fetch current balance
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('tibs_balance')
                .eq('id', userId)
                .single()

            if (fetchError || !profile) {
                console.error('[Webhook] Profile fetch failed:', fetchError)
                return NextResponse.json({ error: 'Profile not found' }, { status: 200 })
            }

            // 3. Update Balance
            const newBalance = (profile.tibs_balance || 0) + tibs
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ tibs_balance: newBalance })
                .eq('id', userId)

            if (updateError) {
                console.error('[Webhook] Balance update failed:', updateError)
                return NextResponse.json({ error: 'Update failed' }, { status: 200 })
            }

            // 4. Send Notification
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'payment',
                message: `Success! ${tibs} Tibs have been added to your balance.`,
                is_read: false
            })

            console.log(`✅ Automated Fulfillment: Credited ${tibs} Tibs to ${userId}`)
        }

        return NextResponse.json({ received: true })

    } catch (error: any) {
        console.error('[Webhook] Fatal Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 200 })
    }
}
