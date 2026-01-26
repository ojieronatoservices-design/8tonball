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
        <div className="min-h-screen bg-black text-white p-6 pb-24">
            {/* Hero Image */}
            <div className="relative aspect-square rounded-3xl overflow-hidden mb-6">
                <img
                    src={event.media_urls?.[0] || '/placeholder.png'}
                    alt={event.title}
                    className="w-full h-full object-cover"
                />
                {event.status === 'drawn' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-2xl font-black text-primary">ENDED</span>
                    </div>
                )}
            </div>

            {/* Event Info */}
            <div className="flex flex-col gap-4">
                <h1 className="text-2xl font-black">{event.title}</h1>

                {event.description && (
                    <p className="text-white/60">{event.description}</p>
                )}

                <div className="flex gap-4 text-sm">
                    <div className="bg-white/5 px-4 py-2 rounded-xl">
                        <span className="text-white/40">Entry Cost:</span>{' '}
                        <span className="font-bold text-primary">{event.entry_cost_tibs} Tibs</span>
                    </div>
                    <div className="bg-white/5 px-4 py-2 rounded-xl">
                        <span className="text-white/40">Entries:</span>{' '}
                        <span className="font-bold">{entryCount}</span>
                    </div>
                </div>

                {event.status === 'open' && (
                    <Link
                        href="/"
                        className="w-full py-4 bg-primary text-black font-black text-center uppercase tracking-widest rounded-2xl mt-4"
                    >
                        Enter Now
                    </Link>
                )}
            </div>
        </div>
    )
}
