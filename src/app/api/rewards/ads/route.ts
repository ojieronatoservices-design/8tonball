import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        const { userId } = auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { adValuePhp } = body

        if (typeof adValuePhp !== 'number' || adValuePhp <= 0) {
            return NextResponse.json({ error: 'Invalid ad value' }, { status: 400 })
        }

        // Call the secure RPC to calculate reward and update balance
        // We use the service role client here because the function is SECURITY DEFINER 
        // and handles its own auth check via auth_uid_text() if we pass the right headers, 
        // but since we are in a Route Handler, we can just pass the userId if needed 
        // or rely on the function's internal logic.

        // Actually, the RPC uses auth_uid_text() which depends on the JWT.
        // In a route handler, we should probably pass the user_id explicitly if we want to use service role,
        // or better yet, use the user's own supabase client if possible.
        // But for rewards, service role is safer to ensure the user can't skip the balance update.

        const { data, error } = await supabase.rpc('reward_watch_ad', {
            p_ad_value_php: adValuePhp
        }, {
            // Mocking the auth context so auth_uid_text() works inside the RPC
            headers: {
                'Authorization': `Bearer ${req.headers.get('Authorization')}`
            }
        })

        // If headers trick doesn't work well in Route Handlers, 
        // we might modify the RPC to take p_user_id.
        // Let's try the direct approach first if the user is authenticated.

        if (error) {
            console.error('[AdReward] RPC Error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            rewardTibs: data.reward_tibs,
            newBalance: data.new_balance
        })

    } catch (error: any) {
        console.error('[AdReward] Fatal Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
