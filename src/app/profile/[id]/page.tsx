"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { Trophy, Clock, Loader2, User, LayoutDashboard, Search, Calendar, Ticket, CheckCircle2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useSupabase } from '@/hooks/useSupabase'
import { EventCard } from '@/components/EventCard'

export default function PublicProfilePage() {
    const params = useParams()
    const profileId = params?.id as string
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [hostedRaffles, setHostedRaffles] = useState<any[]>([])
    const { getClient } = useSupabase()

    const fetchPublicProfile = async () => {
        if (!profileId) return
        setIsLoading(true)

        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            // Fetch profile and their hosted raffles
            const [profileResult, rafflesResult] = await Promise.all([
                supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', profileId)
                    .single(),
                supabaseClient
                    .from('raffles')
                    .select(`
                        *,
                        host:profiles!host_user_id(display_name, is_host_eligible)
                    `)
                    .eq('host_user_id', profileId)
                    .order('created_at', { ascending: false })
            ])

            if (profileResult.error) throw profileResult.error
            setProfile(profileResult.data)
            setHostedRaffles(rafflesResult.data || [])

        } catch (error) {
            console.error('Error fetching public profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchPublicProfile()
    }, [profileId])

    const stats = useMemo(() => {
        if (!hostedRaffles.length) return { total: 0, completed: 0, active: 0 }
        return {
            total: hostedRaffles.length,
            completed: hostedRaffles.filter(r => r.status === 'drawn' || r.status === 'claimed').length,
            active: hostedRaffles.filter(r => r.status === 'open').length
        }
    }, [hostedRaffles])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Loading Profile...</p>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <User size={48} className="text-muted-foreground/20" />
                <p className="text-muted-foreground">Profile not found.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 pb-24 -mx-6">
            {/* Profile Header */}
            <div className="relative pt-12 pb-8 px-6 overflow-hidden">
                {profile.cover_photo_url ? (
                    <div className="absolute inset-0 z-0">
                        <img src={profile.cover_photo_url} alt="" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-primary/5 -skew-y-3 origin-top-left -mt-20 h-64 z-0" />
                )}

                <div className="relative z-10 flex flex-col items-center text-center gap-4 mt-8">
                    <div className="w-24 h-24 rounded-[2rem] bg-muted border-4 border-background shadow-2xl flex items-center justify-center overflow-hidden shrink-0 relative">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} className="text-muted-foreground/50" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-1">
                            {profile.display_name || 'Anonymous Host'}
                        </h1>
                        <div className="flex items-center justify-center gap-2">
                            {profile.is_host_eligible && (
                                <span className="bg-primary/20 text-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Verified Host
                                </span>
                            )}
                            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                                Joined {new Date(profile.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="px-6">
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card border border-border p-4 rounded-3xl flex flex-col items-center gap-1">
                        <span className="text-2xl font-black font-sans">{stats.total}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Total Events</span>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-3xl flex flex-col items-center gap-1">
                        <span className="text-2xl font-black font-sans text-primary">{stats.active}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Active Now</span>
                    </div>
                    <div className="bg-card border border-border p-4 rounded-3xl flex flex-col items-center gap-1">
                        <span className="text-2xl font-black font-sans text-green-500">{stats.completed}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Successful</span>
                    </div>
                </div>
            </div>

            {/* Events Section */}
            <div className="flex flex-col gap-4">
                <div className="px-6 flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] italic flex items-center gap-2">
                        <LayoutDashboard size={16} /> Hosted Events
                    </h2>
                </div>

                <div className="flex flex-col">
                    {hostedRaffles.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs px-6">
                            No Events Hosted Yet
                        </div>
                    ) : (
                        hostedRaffles.map((raffle) => (
                            <EventCard
                                key={raffle.id}
                                event={raffle}
                                entryCount={0}
                                onShare={() => { }}
                                variant="feed"
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
