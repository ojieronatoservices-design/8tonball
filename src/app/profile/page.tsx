"use client"

import React, { useEffect, useState } from 'react'
import { User, Settings, LogOut, ShieldCheck, Mail, Loader2, Trophy, Clock, XCircle, Ticket, Plus } from 'lucide-react'
import { useUser, useAuth, useClerk } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { CountdownTimer } from '@/components/CountdownTimer'
import Link from 'next/link'

type EntryWithEvent = {
    id: string
    raffle_id: string
    created_at: string
    raffles: {
        id: string
        title: string
        status: string
        ends_at: string
        winner_user_id: string | null
        media_urls: string[]
    }
}

export default function ProfilePage() {
    const { user, isLoaded: isUserLoaded } = useUser()
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { signOut } = useClerk()
    const { getClient } = useSupabase()
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [myEntries, setMyEntries] = useState<EntryWithEvent[]>([])
    const [activeTab, setActiveTab] = useState<'live' | 'archives'>('live')

    const fetchProfile = async () => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoading(true)
        try {
            // Fetch profile
            const { data: profileData, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (profileError) throw profileError
            setProfile(profileData)

            // Fetch user's entries with event details
            const { data: entriesData, error: entriesError } = await supabaseClient
                .from('entries')
                .select('id, raffle_id, created_at, raffles(id, title, status, ends_at, winner_user_id, media_urls)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (entriesError) throw entriesError
            setMyEntries(entriesData as any || [])
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchProfile()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId])

    const handleLogout = async () => {
        await signOut()
        window.location.href = '/'
    }

    const threshold = 8000
    const totalSpent = profile?.total_tibs_spent || 0
    const progress = (totalSpent / threshold) * 100
    const isHostEligible = profile?.is_host_eligible || false

    // Filter entries by status
    const liveEntries = myEntries.filter(e => e.raffles?.status === 'open')
    const archivedEntries = myEntries.filter(e => e.raffles?.status !== 'open')

    // Check if user won an event
    const didWin = (entry: EntryWithEvent) => entry.raffles?.winner_user_id === userId

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-white/20 font-black uppercase tracking-widest text-xs">Loading Profile...</p>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <User size={48} className="text-white/10" />
                <p className="text-white/40">Please log in to view your profile.</p>
                <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-2 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs"
                >
                    Back to Home
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden">
                    {user?.imageUrl ? (
                        <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <User size={32} className="text-primary" />
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black tracking-tight">{profile.display_name || 'Guest'}</h2>
                        {isHostEligible && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/30">
                                Host
                            </span>
                        )}
                    </div>
                    <p className="text-white/40 text-sm">{profile.email}</p>
                </div>
            </div>

            {/* Balance Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-1">Current Balance</p>
                    <div className="text-2xl font-black">{profile.tibs_balance.toLocaleString()}</div>
                    <p className="text-xs text-white/30 font-bold">TIBS</p>
                </div>
                <div className="bg-card p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-white/40 mb-1">Total Spent</p>
                    <div className="text-2xl font-black">{totalSpent.toLocaleString()}</div>
                    <p className="text-xs text-white/30 font-bold">TIBS</p>
                </div>
            </div>

            {/* Hosting Eligibility */}
            <div className="bg-card p-6 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2">
                            <ShieldCheck className={isHostEligible ? "text-green-500" : "text-white/20"} size={20} />
                            Hosting Eligibility
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">{totalSpent.toLocaleString()} / {threshold.toLocaleString()}</span>
                    </div>

                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>

                    {isHostEligible && (
                        <Link
                            href="/admin"
                            className="mt-2 w-full py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Create Event
                        </Link>
                    )}
                </div>
            </div>

            {/* My Events Section */}
            <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Ticket size={20} className="text-primary" />
                    My Events
                </h3>

                {/* Tabs */}
                <div className="flex bg-card p-1.5 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('live')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'live' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        <Clock size={14} />
                        Live ({liveEntries.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('archives')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'archives' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        <Trophy size={14} />
                        Archives ({archivedEntries.length})
                    </button>
                </div>

                {/* Event List */}
                <div className="flex flex-col gap-2">
                    {activeTab === 'live' ? (
                        liveEntries.length === 0 ? (
                            <div className="py-10 text-center text-white/20 text-sm">
                                No active events. Enter some events to see them here!
                            </div>
                        ) : (
                            liveEntries.map((entry) => (
                                <Link
                                    key={entry.id}
                                    href={`/event/${entry.raffle_id}`}
                                    className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex items-center gap-4 transition-colors"
                                >
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                        <img
                                            src={entry.raffles?.media_urls?.[0] || '/placeholder.png'}
                                            alt={entry.raffles?.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm truncate">{entry.raffles?.title}</h4>
                                        <CountdownTimer endsAt={entry.raffles?.ends_at} className="text-xs" />
                                    </div>
                                </Link>
                            ))
                        )
                    ) : (
                        archivedEntries.length === 0 ? (
                            <div className="py-10 text-center text-white/20 text-sm">
                                No past events yet.
                            </div>
                        ) : (
                            archivedEntries.map((entry) => (
                                <Link
                                    key={entry.id}
                                    href={`/event/${entry.raffle_id}`}
                                    className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex items-center gap-4 transition-colors"
                                >
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                        <img
                                            src={entry.raffles?.media_urls?.[0] || '/placeholder.png'}
                                            alt={entry.raffles?.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm truncate">{entry.raffles?.title}</h4>
                                        <span className="text-xs text-white/40">
                                            {entry.raffles?.status === 'drawn' ? 'Ended' : 'Closed'}
                                        </span>
                                    </div>
                                    {/* Win/Miss Badge */}
                                    {entry.raffles?.status === 'drawn' && (
                                        didWin(entry) ? (
                                            <div className="px-3 py-1 bg-green-500/20 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/30 flex items-center gap-1">
                                                <Trophy size={12} />
                                                WON
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1 bg-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/30 flex items-center gap-1">
                                                <XCircle size={12} />
                                                MISSED
                                            </div>
                                        )
                                    )}
                                </Link>
                            ))
                        )
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
                <Link
                    href="/profile/settings"
                    className="w-full p-4 bg-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <Settings size={20} className="text-white/40 group-hover:text-primary transition-colors" />
                        <span className="font-bold text-sm">Account Settings</span>
                    </div>
                </Link>
                <button
                    onClick={handleLogout}
                    className="w-full p-4 bg-white/5 rounded-2xl flex items-center justify-between text-red-500 hover:bg-red-400/10 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <LogOut size={20} />
                        <span className="font-bold text-sm">Log Out</span>
                    </div>
                </button>
            </div>
        </div>
    )
}
