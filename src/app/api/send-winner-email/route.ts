import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_123')

export async function POST(request: NextRequest) {
    try {
        const { to, winnerName, eventTitle, eventImage } = await request.json()

        console.log('[send-winner-email] Processing winner email request...')

        if (!to || !eventTitle) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Use Resend's shared domain until custom domain is verified
        // To use your own domain, verify it at https://resend.com/domains
        const { data, error } = await resend.emails.send({
            from: '8TONBALL <onboarding@resend.dev>',
            to: [to],
            subject: `🎉 Congratulations! You won ${eventTitle}!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 40px; border-radius: 20px;">
                    <h1 style="color: #FFD700; margin-bottom: 20px;">🎉 You're a Winner!</h1>
                    
                    <p style="font-size: 18px; margin-bottom: 20px;">
                        Congratulations${winnerName ? `, ${winnerName}` : ''}!
                    </p>
                    
                    <p style="margin-bottom: 30px;">
                        You've won <strong style="color: #FFD700;">${eventTitle}</strong> on 8TONBALL!
                    </p>
                    
                    ${eventImage ? `<img src="${eventImage}" alt="${eventTitle}" style="width: 100%; border-radius: 12px; margin-bottom: 30px;" />` : ''}
                    
                    <p style="margin-bottom: 20px;">
                        Please reply to this email to claim your prize. We'll need to coordinate delivery details with you.
                    </p>
                    
                    <p style="color: #888; font-size: 14px;">
                        Thank you for participating in 8TONBALL!
                    </p>
                </div>
            `,
            replyTo: 'jrronato@gmail.com'
        })

        if (error) {
            console.error('Resend error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, id: data?.id })
    } catch (error: any) {
        console.error('Email error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
