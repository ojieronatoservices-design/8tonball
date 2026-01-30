"use client"

import React, { useEffect, useState, useRef } from 'react'
import { Plus, Ticket, ShieldCheck, Clock, Trophy, Loader2, User, LogOut, Wallet, CheckSquare, X, Settings, XCircle, Mail } from 'lucide-react'
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
        winning_user_id?: string | null
        winning_entry_id: string | null
        media_urls: string[]
    }
    ticket_number?: string
}

export default function ProfilePage() {
    const { user, isLoaded: isUserLoaded } = useUser()
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { signOut } = useClerk()
    const { getClient } = useSupabase()
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [myEntries, setMyEntries] = useState<EntryWithEvent[]>([])
    const [hostedEvents, setHostedEvents] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'live' | 'archives' | 'hosted'>('live')

    // Payout State
    const [showPayoutModal, setShowPayoutModal] = useState(false)
    const [gcashNumber, setGcashNumber] = useState('')
    const [gcashName, setGcashName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

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
                .select(`
                    id, 
                    raffle_id, 
                    created_at, 
                    ticket_number, 
                    raffles:raffles!entries_raffle_id_fkey(*)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (entriesError) {
                console.error('Entries Fetch Error:', entriesError)
            }

            setMyEntries(entriesData as any[] || [])

            // Fetch hosted events if eligible
            if (profileData.is_host_eligible) {
                const { data: hostedData, error: hostedError } = await supabaseClient
                    .from('raffles')
                    .select('*')
                    .eq('host_user_id', userId)
                    .order('created_at', { ascending: false })

                if (!hostedError) {
                    setHostedEvents(hostedData || [])
                }
            }
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

    // Realtime subscriptions for profile updates
    const supabaseRef = useRef<any>(null)

    useEffect(() => {
        if (!userId) return

        let profileChannel: any = null
        let rafflesChannel: any = null

        const setupRealtime = async () => {
            const supabaseClient = await getClient()
            if (!supabaseClient) return
            supabaseRef.current = supabaseClient

            // Subscribe to profile changes (balance, host eligibility, etc.)
            profileChannel = supabaseClient
                .channel(`profile-realtime:${userId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`
                }, (payload: any) => {
                    console.log('[Profile Realtime] Update received:', payload.new)
                    setProfile((prev: any) => prev ? { ...prev, ...payload.new } : payload.new)
                })
                .subscribe((status: string) => {
                    console.log('[Profile Realtime] Channel status:', status)
                })

            // Subscribe to raffle updates (for when events user entered are drawn)
            rafflesChannel = supabaseClient
                .channel('raffles-profile-realtime')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'raffles'
                }, (payload: any) => {
                    // If any raffle user is part of gets updated, refresh entries
                    console.log('[Profile Realtime] Raffle updated:', payload.new?.id)
                    // Update the entries list with new raffle data
                    setMyEntries((prev: EntryWithEvent[]) => prev.map(entry =>
                        entry.raffle_id === payload.new?.id
                            ? { ...entry, raffles: { ...entry.raffles, ...payload.new } }
                            : entry
                    ))
                })
                .subscribe((status: string) => {
                    console.log('[Profile Realtime] Raffles channel:', status)
                })
        }

        setupRealtime()

        return () => {
            if (profileChannel && supabaseRef.current) {
                supabaseRef.current.removeChannel(profileChannel)
            }
            if (rafflesChannel && supabaseRef.current) {
                supabaseRef.current.removeChannel(rafflesChannel)
            }
        }
    }, [userId])

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
    const didWin = (entry: EntryWithEvent) => {
        // Strictly check if THIS entry is the winning one
        // We do NOT check winner_user_id here, because that would mark ALL of the user's tickets as winners
        return entry.raffles?.winning_entry_id === entry.id
    }

    const handleRequestPayout = async () => {
        if (!gcashNumber || !gcashName) {
            alert('Please fill in all GCash details.')
            return
        }

        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsSubmitting(true)
        try {
            const { error } = await supabaseClient
                .from('payout_requests')
                .insert([{
                    user_id: userId,
                    amount_tibs: profile.tibs_balance,
                    gcash_number: gcashNumber,
                    gcash_name: gcashName
                }])

            if (error) throw error

            alert('Payout request submitted! Please allow 24-48 hours for processing.')
            setShowPayoutModal(false)
            setGcashNumber('')
            setGcashName('')
            fetchProfile() // Refresh balance
        } catch (error: any) {
            console.error('Payout error:', error)
            alert(error.message || 'Error submitting payout request')
        } finally {
            setIsSubmitting(false)
        }
    }

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
                <p className="text-muted-foreground">Please log in to view your profile.</p>
                <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-2 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-xl text-xs neon-border shadow-md"
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
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden shadow-inner">
                    {user?.imageUrl ? (
                        <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <User size={32} className="text-primary" />
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black tracking-tight text-foreground">{profile.display_name || 'Guest'}</h2>
                        {isHostEligible && (
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                                Host
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">{profile.email}</p>
                </div>
            </div>

            {/* Balance Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card p-6 rounded-3xl border border-border flex flex-col justify-between shadow-sm">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-1">Current Balance</p>
                        <div className="text-2xl font-black neon-text">{profile.tibs_balance.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground font-bold uppercase">TIBS</p>
                    </div>
                    {(isHostEligible || profile.is_admin) && profile.tibs_balance > 0 && (
                        <button
                            onClick={() => setShowPayoutModal(true)}
                            className="mt-4 py-2 bg-muted hover:bg-foreground/5 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl border border-border transition-all"
                        >
                            Settle Balance
                        </button>
                    )}
                </div>
                <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                    <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">Total Spent</p>
                    <div className="text-2xl font-black text-foreground">{totalSpent.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground font-bold">TIBS</p>
                </div>
            </div>

            {/* Hosting Eligibility */}
            <div className="bg-card p-6 rounded-3xl border border-border relative overflow-hidden shadow-sm">
                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-foreground">
                            <ShieldCheck className={isHostEligible ? "text-green-500" : "text-muted-foreground/30"} size={20} />
                            Hosting Eligibility
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-widest neon-text">{totalSpent.toLocaleString()} / {threshold.toLocaleString()}</span>
                    </div>

                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(57,255,20,0.4)]"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>

                    {isHostEligible && (
                        <Link
                            href="/admin"
                            className="mt-2 w-full py-3 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-xl text-xs flex items-center justify-center gap-2 neon-border shadow-md"
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
                <div className="flex bg-muted p-1.5 rounded-2xl border border-border">
                    <button
                        onClick={() => setActiveTab('live')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'live' ? 'bg-primary text-primary-foreground neon-border' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Clock size={14} />
                        Live
                    </button>
                    <button
                        onClick={() => setActiveTab('archives')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'archives' ? 'bg-primary text-primary-foreground neon-border' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Trophy size={14} />
                        Archive
                    </button>
                    {isHostEligible && (
                        <button
                            onClick={() => setActiveTab('hosted')}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'hosted' ? 'bg-primary text-primary-foreground neon-border' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <ShieldCheck size={14} />
                            Hosted
                        </button>
                    )}
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
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <h4 className="font-bold text-sm truncate">{entry.raffles?.title}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-1.5 py-1 rounded text-white/40 leading-none">
                                                T#-{entry.ticket_number || '---'}
                                            </span>
                                            <CountdownTimer endsAt={entry.raffles?.ends_at} className="text-[10px]" />
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )
                    ) : activeTab === 'archives' ? (
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
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <h4 className="font-bold text-sm truncate">{entry.raffles?.title}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-1.5 py-1 rounded text-white/40 leading-none">
                                                T#-{entry.ticket_number || '---'}
                                            </span>
                                            <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                                                {entry.raffles?.status === 'drawn' ? 'Ended' : 'Closed'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Win/Miss Badge */}
                                    {entry.raffles?.status === 'drawn' && (
                                        <div className="shrink-0">
                                            {didWin(entry) ? (
                                                <div className="px-2.5 py-1 bg-green-500/10 text-green-500 text-[9px] font-black uppercase rounded-lg border border-green-500/20 flex items-center gap-1">
                                                    <Trophy size={10} />
                                                    WON
                                                </div>
                                            ) : (
                                                <div className="px-2.5 py-1 bg-white/5 text-white/20 text-[9px] font-black uppercase rounded-lg border border-white/5 flex items-center gap-1">
                                                    <XCircle size={10} />
                                                    MISSED
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Link>
                            ))
                        )
                    ) : (
                        hostedEvents.length === 0 ? (
                            <div className="py-10 text-center text-white/20 text-sm">
                                You haven't hosted any events yet.
                                <br />
                                <Link href="/admin" className="text-primary hover:underline mt-2 inline-block">
                                    Create one now!
                                </Link>
                            </div>
                        ) : (
                            hostedEvents.map((event) => (
                                <Link
                                    key={event.id}
                                    href={`/event/${event.id}`}
                                    className="bg-card hover:bg-muted p-4 rounded-2xl flex items-center gap-4 transition-colors border border-border mt-1 first:mt-0"
                                >
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 shadow-sm">
                                        <img
                                            src={event.media_urls?.[0] || '/placeholder.png'}
                                            alt={event.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-sm truncate text-foreground">{event.title}</h4>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${event.status === 'open'
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : 'bg-muted text-muted-foreground border border-border'
                                                }`}>
                                                {event.status === 'open' ? 'LIVE' : 'ENDED'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground uppercase font-black tracking-tighter">
                                            <span className="text-primary">{event.entry_cost_tibs} Tibs</span>
                                            <span className="opacity-30">•</span>
                                            <CountdownTimer endsAt={event.ends_at} className="text-foreground" />
                                        </div>
                                    </div>
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
                    className="w-full p-4 bg-muted rounded-2xl flex items-center justify-between hover:bg-foreground/5 transition-colors group border border-border shadow-sm"
                >
                    <div className="flex items-center gap-3">
                        <Settings size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-bold text-sm text-foreground">App Settings</span>
                    </div>
                </Link>
                <button
                    onClick={handleLogout}
                    className="w-full p-4 bg-muted rounded-2xl flex items-center justify-between text-red-500 hover:bg-red-400/10 transition-colors border border-border shadow-sm"
                >
                    <div className="flex items-center gap-3">
                        <LogOut size={20} />
                        <span className="font-bold text-sm">Log Out</span>
                    </div>
                </button>
            </div>

            {/* Payout Modal */}
            {showPayoutModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-sm rounded-3xl border border-border p-8 flex flex-col gap-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight text-foreground">Request Payout</h3>
                            <button onClick={() => setShowPayoutModal(false)} className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total to Settle</p>
                            <div className="text-2xl font-black neon-text">₱{(profile.tibs_balance / 8).toLocaleString()}</div>
                            <p className="text-[10px] text-muted-foreground font-bold">{profile.tibs_balance.toLocaleString()} TIBS</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">GCash Number</label>
                                <input
                                    type="text"
                                    value={gcashNumber}
                                    onChange={(e) => setGcashNumber(e.target.value)}
                                    placeholder="0912 345 6789"
                                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground/30"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Account Name</label>
                                <input
                                    type="text"
                                    value={gcashName}
                                    onChange={(e) => setGcashName(e.target.value)}
                                    placeholder="JUAN DELA CRUZ"
                                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none uppercase text-foreground placeholder:text-muted-foreground/30"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleRequestPayout}
                            disabled={isSubmitting}
                            className="w-full py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 neon-border"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                        <p className="text-[10px] text-center text-muted-foreground italic">
                            Settlements are usually processed within 24-48 hours.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
