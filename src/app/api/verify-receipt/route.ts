import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const openaiKey = process.env.OPENAI_API_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
    try {
        if (!openaiKey) {
            return NextResponse.json({ error: 'OpenAI API Key not configured' }, { status: 500 })
        }

        const formData = await req.formData()
        const image = formData.get('image') as File
        const userId = formData.get('userId') as string
        const expectedTibs = parseInt(formData.get('tibs') as string, 10)
        const expectedPrice = parseInt(formData.get('price') as string, 10)

        if (!image || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Convert image to base64
        const bytes = await image.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64Image = buffer.toString('base64')

        // 2. Upload to Supabase Storage first for record keeping
        const fileName = `${userId}-${Date.now()}.png`
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('media')
            .upload(`receipts/${fileName}`, buffer, {
                contentType: 'image/png',
                upsert: true
            })

        if (uploadError) {
            console.error('[Verify] Storage upload failed:', uploadError)
        }

        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`receipts/${fileName}`)

        // 3. Ask OpenAI to parse the receipt
        console.log('[Verify] Sending to OpenAI...')
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Extract payment details from this Philippine e-wallet or bank transfer receipt (GCash, Maya, or bank app via InstaPay/PESONet). 
                                Return ONLY a JSON object with:
                                - reference_number (string)
                                - amount (number)
                                - date (string, YYYY-MM-DD)
                                - is_likely_legit (boolean, false if it looks edited or like a fake template)
                                - payment_type (string, "gcash", "maya", or identification of the bank app)`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" }
            })
        })

        const aiData = await response.json()
        const result = JSON.parse(aiData.choices[0].message.content)
        console.log('[Verify] AI Result:', result)

        const { reference_number, amount, is_likely_legit } = result

        // 4. Verification Logic
        let status: 'pending' | 'approved' | 'rejected' = 'pending'
        let failureReason = ''

        if (!is_likely_legit) {
            failureReason = 'AI flagged receipt as suspicious'
        } else if (!reference_number) {
            failureReason = 'Could not find reference number'
        } else if (amount !== expectedPrice) {
            failureReason = `Amount mismatch: AI found ₱${amount}, expected ₱${expectedPrice}`
        } else {
            // Check for duplicate Reference Number
            const { data: duplicate } = await supabase
                .from('transactions')
                .select('id')
                .eq('proof_image_url', `ref://${reference_number}`)
                .maybeSingle()

            if (duplicate) {
                status = 'rejected'
                failureReason = 'Duplicate reference number (receipt already used)'
            } else {
                status = 'approved'
            }
        }

        // 5. Create Transaction Record
        const { data: tx, error: txError } = await supabase.from('transactions').insert({
            user_id: userId,
            requested_tibs: expectedTibs,
            status: status,
            processed_at: status === 'approved' ? new Date().toISOString() : null,
            proof_image_url: publicUrl,
            metadata: {
                ai_extracted: result,
                failure_reason: failureReason,
                ref_id: reference_number,
                external_id: `ref://${reference_number}`
            }
        }).select().single()

        // 6. If Approved, Update Balance
        if (status === 'approved') {
            const { data: profile } = await supabase.from('profiles').select('tibs_balance').eq('id', userId).single()
            const newBalance = (profile?.tibs_balance || 0) + expectedTibs

            await supabase.from('profiles').update({ tibs_balance: newBalance }).eq('id', userId)

            // Notification
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'payment',
                message: `Success! ${expectedTibs} Tibs have been added to your balance.`,
                is_read: false
            })
        }

        return NextResponse.json({
            success: status === 'approved',
            status,
            message: failureReason || 'Payment processed successfully',
            extracted: result
        })

    } catch (error: any) {
        console.error('[Verify] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
