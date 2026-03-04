import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Generate a random alphanumeric code like XXXX-XXXX-XXXX
const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    return `${segment()}-${segment()}-${segment()}`
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action, raffleId, campaignId, count, codes } = body

        if (!raffleId && !campaignId) {
            return NextResponse.json({ error: 'Raffle or Campaign ID is required' }, { status: 400 })
        }

        // Verify the user is the host of this raffle or an admin
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
        const isAdmin = profile?.is_admin

        if (raffleId) {
            const { data: raffle, error: raffleError } = await supabase
                .from('raffles')
                .select('host_user_id')
                .eq('id', raffleId)
                .single()

            if (raffleError || !raffle) {
                return NextResponse.json({ error: 'Raffle not found' }, { status: 404 })
            }

            if (!isAdmin && raffle.host_user_id !== session.user.id) {
                return NextResponse.json({ error: 'Forbidden. You are not the host of this event.' }, { status: 403 })
            }
        } else if (campaignId) {
            const { data: campaign, error: campaignError } = await supabase
                .from('campaigns')
                .select('host_user_id')
                .eq('id', campaignId)
                .single()

            if (campaignError || !campaign) {
                return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
            }

            if (!isAdmin && campaign.host_user_id !== session.user.id) {
                return NextResponse.json({ error: 'Forbidden. You are not the host of this campaign.' }, { status: 403 })
            }
        }

        let codesToInsert: string[] = []

        if (action === 'generate') {
            const generateCount = parseInt(count)
            if (isNaN(generateCount) || generateCount <= 0 || generateCount > 100000) {
                return NextResponse.json({ error: 'Invalid count. Must be between 1 and 100,000' }, { status: 400 })
            }

            // Generate unique codes
            const generatedSet = new Set<string>()
            while (generatedSet.size < generateCount) {
                generatedSet.add(generateRandomCode())
            }
            codesToInsert = Array.from(generatedSet)

        } else if (action === 'upload') {
            if (!Array.isArray(codes) || codes.length === 0 || codes.length > 100000) {
                return NextResponse.json({ error: 'Invalid codes array. Must contain between 1 and 100,000 codes' }, { status: 400 })
            }
            // Sanitize and deduplicate uploaded codes
            const uploadedSet = new Set<string>()
            for (const code of codes) {
                const sanitized = String(code).trim().toUpperCase()
                if (sanitized) uploadedSet.add(sanitized)
            }
            codesToInsert = Array.from(uploadedSet)
        } else {
            return NextResponse.json({ error: 'Invalid action. Must be "generate" or "upload"' }, { status: 400 })
        }

        // Insert codes into database in batches to avoid payload too large errors
        const BATCH_SIZE = 5000
        let insertedCount = 0

        for (let i = 0; i < codesToInsert.length; i += BATCH_SIZE) {
            const batch = codesToInsert.slice(i, i + BATCH_SIZE).map(code => ({
                host_user_id: session.user.id,
                raffle_id: raffleId || null,
                campaign_id: campaignId || null,
                code: code
            }))

            const { error: insertError } = await supabase
                .from('campaign_codes')
                .insert(batch)

            if (insertError) {
                console.error('Error inserting batch:', insertError)
                return NextResponse.json({
                    error: 'Error inserting codes into database',
                    details: insertError.message,
                    inserted_so_far: insertedCount
                }, { status: 500 })
            }
            insertedCount += batch.length
        }

        return NextResponse.json({ success: true, inserted: insertedCount })

    } catch (error: any) {
        console.error('API /business/codes Error:', error)
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const raffleId = searchParams.get('raffleId')
        const campaignId = searchParams.get('campaignId')

        if (!raffleId && !campaignId) {
            return NextResponse.json({ error: 'Raffle or Campaign ID is required' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify the user is the host of this raffle or an admin
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
        const isAdmin = profile?.is_admin

        if (raffleId) {
            const { data: raffle } = await supabase
                .from('raffles')
                .select('host_user_id')
                .eq('id', raffleId)
                .single()

            if (!raffle) {
                return NextResponse.json({ error: 'Raffle not found' }, { status: 404 })
            }

            if (!isAdmin && raffle.host_user_id !== session.user.id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        } else if (campaignId) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('host_user_id')
                .eq('id', campaignId)
                .single()

            if (!campaign) {
                return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
            }

            if (!isAdmin && campaign.host_user_id !== session.user.id) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        // Fetch all codes for this raffle including who used them and when
        const query = supabase
            .from('campaign_codes')
            .select(`
                code, 
                is_used, 
                used_at,
                used_by_profile:profiles!used_by (
                    email
                )
            `)

        if (raffleId) {
            query.eq('raffle_id', raffleId)
        } else {
            query.eq('campaign_id', campaignId)
        }

        const { data: codes, error: fetchError } = await query

        if (fetchError) throw fetchError

        return NextResponse.json({ success: true, codes })

    } catch (error: any) {
        console.error('API /business/codes Error:', error)
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
    }
}
