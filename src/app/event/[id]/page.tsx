import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const getSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    return createClient(supabaseUrl, supabaseKey)
}

type Props = {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params

    const supabase = getSupabase()
    const { data: event } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', id)
        .single()

    if (!event) {
        return { title: 'Event Not Found' }
    }

    const imageUrl = event.media_urls?.[0] || 'https://8tonball.vercel.app/og-default.png'

    return {
        title: `${event.title} | 8TONBALL`,
        description: event.description || 'Enter to win this exclusive prize!',
        openGraph: {
            title: event.title,
            description: event.description || 'Enter to win this exclusive prize!',
            images: [{ url: imageUrl, width: 1200, height: 630 }],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: event.title,
            description: event.description || 'Enter to win this exclusive prize!',
            images: [imageUrl],
        },
    }
}

export default async function EventPage({ params }: Props) {
    const { id } = await params

    const supabase = getSupabase()
    const { data: event } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', id)
        .single()

    if (!event) {
        notFound()
    }

    const { data: entries } = await supabase
        .from('entries')
        .select('id')
        .eq('raffle_id', id)

    const entryCount = entries?.length || 0

    return (
        <div className="min-h-screen bg-background text-foreground p-6 pb-24">
            {/* Hero Image */}
            <div className="relative aspect-square rounded-3xl overflow-hidden mb-6 border border-border shadow-xl">
                <img
                    src={event.media_urls?.[0] || '/placeholder.png'}
                    alt={event.title}
                    className="w-full h-full object-cover"
                />
                {event.status === 'drawn' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-3xl font-black neon-text drop-shadow-[0_0_15px_rgba(57,255,20,0.6)]">ENDED</span>
                    </div>
                )}
            </div>

            {/* Event Info */}
            <div className="flex flex-col gap-6">
                <h1 className="text-3xl font-black tracking-tight">{event.title}</h1>

                {event.description && (
                    <p className="text-muted-foreground leading-relaxed">{event.description}</p>
                )}

                <div className="flex gap-4">
                    <div className="flex-1 bg-muted px-4 py-3 rounded-2xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Entry Cost</span>
                        <span className="font-bold neon-text text-lg">{event.entry_cost_tibs.toLocaleString()} Tibs</span>
                    </div>
                    <div className="flex-1 bg-muted px-4 py-3 rounded-2xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Total Entries</span>
                        <span className="font-bold text-lg">{entryCount.toLocaleString()}</span>
                    </div>
                </div>

                {event.status === 'open' && (
                    <Link
                        href="/"
                        className="w-full py-5 bg-primary text-primary-foreground font-black text-center uppercase tracking-[0.2em] rounded-2xl mt-4 neon-border shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        Enter Now
                        <div className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
                    </Link>
                )}
            </div>
        </div>
    )
}
