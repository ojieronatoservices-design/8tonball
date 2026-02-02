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

import { EventCard } from '@/components/EventCard'

export default function ProfilePage() {
    const { user, isLoaded: isUserLoaded } = useUser()
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { signOut } = useClerk()
    const { getClient } = useSupabase()
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [myEntries, setMyEntries] = useState<EntryWithEvent[]>([])
    const [hostedEvents, setHostedEvents] = useState<any[]>([])
    const [entryCounts, setEntryCounts] = useState<Record<string, number>>({})
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

            const entries = entriesData as any[] || []
            setMyEntries(entries)

            // Fetch entry counts for all relevant raffles
            const raffleIds = [...new Set(entries.map(e => e.raffle_id))]
            if (raffleIds.length > 0) {
                const counts: Record<string, number> = {}
                for (const id of raffleIds) {
                    const { count } = await supabaseClient
                        .from('entries')
                        .select('*', { count: 'exact', head: true })
                        .eq('raffle_id', id)
                    counts[id] = count || 0
                }
                setEntryCounts(counts)
            }

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

    const handleShareFacebook = (event: any) => {
        const url = window.location.origin + '/event/' + event.id
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(`Check out this event: ${event.title} on 8TONBALL!`)}`
        window.open(shareUrl, '_blank', 'width=600,height=400')
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
        <div className="flex flex-col gap-6 -mx-6">
            {/* COMPACT HEADER */}
            <div className="px-6 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden shrink-0 shadow-inner">
                        {user?.imageUrl ? (
                            <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={24} className="text-primary" />
                        )}
                    </div>

                    {/* Name & Eligibility */}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-black tracking-tight text-foreground truncate uppercase">{profile.display_name || 'Guest'}</h2>

                        {/* Host Eligibility Line - Minimalist */}
                        <div className="mt-1.5 flex flex-col gap-0.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">Hosting Eligibility</span>
                            <div className="w-full max-w-[140px] h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
                                <div
                                    className="h-full bg-primary transition-all duration-1000 shadow-[0_0_8px_rgba(57,255,20,0.3)]"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                            </div>
                            {isHostEligible && (
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary mt-0.5 animate-pulse">Eligible</span>
                            )}
                        </div>
                    </div>

                    {/* Quick Balance & Spend (Beside Name) */}
                    <div className="flex flex-col gap-2 shrink-0">
                        <button
                            onClick={() => setShowPayoutModal(true)}
                            className="flex flex-col items-end bg-muted/40 hover:bg-muted/80 px-4 py-2 rounded-2xl border border-border/50 transition-all active:scale-95 text-right"
                        >
                            <span className="text-[10px] font-black uppercase text-primary tracking-widest leading-none mb-1">Balance</span>
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-black neon-text leading-none">{profile.tibs_balance.toLocaleString()}</span>
                                <span className="text-[8px] uppercase tracking-tighter text-muted-foreground font-bold">TIBS</span>
                            </div>
                        </button>
                        <div className="flex flex-col items-end px-4 py-2 rounded-2xl border border-transparent text-right">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1 opacity-50">Total Spend</span>
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-black text-foreground leading-none">{totalSpent.toLocaleString()}</span>
                                <span className="text-[8px] uppercase tracking-tighter text-muted-foreground font-bold">TIBS</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="px-6">
                <div className="flex bg-muted/30 p-1 rounded-2xl border border-border/50">
                    <button
                        onClick={() => setActiveTab('live')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'live' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Clock size={14} />
                        Live
                    </button>
                    <button
                        onClick={() => setActiveTab('archives')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'archives' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Trophy size={14} />
                        Archive
                    </button>
                    {isHostEligible && (
                        <button
                            onClick={() => setActiveTab('hosted')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'hosted' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Plus size={14} strokeWidth={3} />
                            Host
                        </button>
                    )}
                </div>
            </div>

            {/* EVENT MINI FEED */}
            <div className="flex flex-col">
                {activeTab === 'live' ? (
                    liveEntries.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                            No Active Entries
                        </div>
                    ) : (
                        liveEntries.map((entry) => (
                            <EventCard
                                key={entry.id}
                                event={entry.raffles}
                                entryCount={entryCounts[entry.raffle_id] || 0}
                                onShare={handleShareFacebook}
                                userId={userId}
                                variant="profile-live"
                            />
                        ))
                    )
                ) : activeTab === 'archives' ? (
                    archivedEntries.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                            No Archive History
                        </div>
                    ) : (
                        archivedEntries.map((entry) => (
                            <EventCard
                                key={entry.id}
                                event={entry.raffles}
                                entryCount={entryCounts[entry.raffle_id] || 0}
                                onShare={handleShareFacebook}
                                userId={userId}
                                variant="profile-archive"
                                isWinner={didWin(entry)}
                            />
                        ))
                    )
                ) : (
                    hostedEvents.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs mb-6">No Hosted Events</p>
                            <Link href="/admin" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-xl text-[10px] neon-border">
                                <Plus size={16} strokeWidth={3} /> Create One
                            </Link>
                        </div>
                    ) : (
                        hostedEvents.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                entryCount={entryCounts[event.id] || 0}
                                onShare={handleShareFacebook}
                                userId={userId}
                                variant={event.status === 'open' ? 'feed' : 'profile-archive'}
                                isWinner={false} // Host doesn't win their own event in this view
                            />
                        ))
                    )
                )}
            </div>

            {/* SETTINGS FOOTER */}
            <div className="px-6 py-8 flex flex-col gap-3">
                <Link
                    href="/profile/settings"
                    className="w-full h-14 bg-muted/40 rounded-2xl flex items-center px-6 gap-4 border border-border/50 hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground"
                >
                    <Settings size={20} />
                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">App Settings</span>
                </Link>
                <button
                    onClick={handleLogout}
                    className="w-full h-14 bg-red-500/5 rounded-2xl flex items-center px-6 gap-4 border border-red-500/10 hover:bg-red-500/10 transition-all text-red-500/50 hover:text-red-500"
                >
                    <LogOut size={20} />
                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">Log Out</span>
                </button>
            </div>

            {/* Payout Modal */}
            {showPayoutModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-sm rounded-[2.5rem] border border-border p-10 flex flex-col gap-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-black tracking-tight text-foreground uppercase italic">Request Payout</h3>
                            <button onClick={() => setShowPayoutModal(false)} className="w-10 h-10 bg-muted flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] flex flex-col items-center">
                            <p className="text-[10px] font-black uppercase text-primary/50 tracking-widest mb-1">Estimated Value</p>
                            <div className="text-4xl font-black neon-text mb-2">₱{(profile.tibs_balance / 8).toLocaleString()}</div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-black/20 rounded-full border border-white/5">
                                <span className="text-[11px] text-foreground font-black">{profile.tibs_balance.toLocaleString()}</span>
                                <span className="text-[8px] text-muted-foreground font-black uppercase">TIBS</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest">GCash or Bank Details</label>
                                <input
                                    type="text"
                                    value={gcashNumber}
                                    onChange={(e) => setGcashNumber(e.target.value)}
                                    placeholder="Account # (e.g. 0912...)"
                                    className="w-full h-14 bg-muted/50 border border-border rounded-2xl px-6 text-sm font-bold focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground/20"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest">Account Name</label>
                                <input
                                    type="text"
                                    value={gcashName}
                                    onChange={(e) => setGcashName(e.target.value)}
                                    placeholder="Full Name"
                                    className="w-full h-14 bg-muted/50 border border-border rounded-2xl px-6 text-sm font-bold focus:border-primary focus:outline-none uppercase text-foreground placeholder:text-muted-foreground/20"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleRequestPayout}
                            disabled={isSubmitting}
                            className="w-full h-16 bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 neon-border text-sm"
                        >
                            {isSubmitting ? 'Processing...' : 'Settle Now'}
                        </button>
                        <p className="text-[10px] text-center text-muted-foreground/30 font-medium px-4">
                            Your TIBS will be converted and sent to your account of choice within 48 hours.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
