import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use standard client (matches implementation in Shell.tsx for persistence)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const event = body.data
        const attributes = event?.attributes
        const type = attributes?.type

        // Handle checkout session payment completed or event success
        if (type === 'checkout_session.payment.paid' || type === 'source.chargeable') {
            const data = attributes.data
            const metadata = data?.attributes?.metadata || attributes?.metadata

            if (!metadata?.user_id || !metadata?.tibs) {
                console.error('Missing metadata in webhook:', metadata)
                return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
            }

            const userId = metadata.user_id
            const tibs = parseInt(metadata.tibs, 10)

            // Get current user balance
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('tibs_balance')
                .eq('id', userId)
                .single()

            if (fetchError) {
                console.error('Error fetching profile:', fetchError)
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
            }

            const newBalance = (profile?.tibs_balance || 0) + tibs

            // Update user balance
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ tibs_balance: newBalance })
                .eq('id', userId)

            if (updateError) {
                console.error('Error updating balance:', updateError)
                return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
            }

            // Create notification
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'payment',
                title: 'Payment Received!',
                message: `${tibs} Tibs have been added to your balance.`,
            })

            console.log(`✅ Credited ${tibs} Tibs to user ${userId}`)
        }

        return NextResponse.json({ received: true })

    } catch (error: any) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
