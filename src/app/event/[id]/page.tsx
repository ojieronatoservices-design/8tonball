"use client"

import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TibsDisplay } from '@/components/TibsDisplay'
import { Loader2 } from 'lucide-react'

const getSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    return createClient(supabaseUrl, supabaseKey)
}

type Props = {
    params: any
}

export default function EventPage({ params }: Props) {
    const [event, setEvent] = useState<any>(null)
    const [entryCount, setEntryCount] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [id, setId] = useState<string | null>(null)

    useEffect(() => {
        params.then((p: any) => setId(p.id))
    }, [params])

    useEffect(() => {
        if (!id) return

        const fetchData = async () => {
            const supabase = getSupabase()
            const { data: eventData } = await supabase
                .from('raffles')
                .select('*')
                .eq('id', id)
                .single()

            if (!eventData) {
                setIsLoading(false)
                return
            }

            const { data: entries } = await supabase
                .from('entries')
                .select('id', { count: 'exact', head: true })
                .eq('raffle_id', id)

            const { count } = await supabase
                .from('entries')
                .select('*', { count: 'exact', head: true })
                .eq('raffle_id', id)

            setEvent(eventData)
            setEntryCount(count || 0)
            setIsLoading(false)
        }

        fetchData()
    }, [id])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 pb-24">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Loading Event...</p>
            </div>
        )
    }

    if (!event) {
        notFound()
        return null
    }

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
                        <div className="font-bold neon-text text-lg">
                            <TibsDisplay amount={event.entry_cost_tibs} />
                        </div>
                    </div>
                    <div className="flex-1 bg-muted px-4 py-3 rounded-2xl border border-border flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Total Entries</span>
                        <span className="font-bold text-lg">{entryCount.toLocaleString()}</span>
                    </div>
                </div>

                {event.status === 'open' && (
                    <Link
                        href="/"
                        className="w-full py-5 bg-primary text-black font-black text-center uppercase tracking-[0.2em] rounded-2xl mt-4 neon-border shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        Enter Now
                        <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                    </Link>
                )}
            </div>
        </div>
    )
}
