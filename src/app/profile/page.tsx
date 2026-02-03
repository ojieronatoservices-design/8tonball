"use client"

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Ticket, ShieldCheck, Clock, Trophy, Loader2, User, LogOut, Wallet, CheckSquare, X, Settings, XCircle, Mail, ChevronDown } from 'lucide-react'
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

    const fetchProfile = async (silent = false) => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!silent) setIsLoading(true)
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
            if (!silent) setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchProfile()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId])

    // Safety timeout for loading state (mobile hangs)
    useEffect(() => {
        if (isLoading) {
            const timer = setTimeout(() => {
                console.warn('[ProfilePage] Loading safety timeout triggered')
                setIsLoading(false)
            }, 10000)
            return () => clearTimeout(timer)
        }
    }, [isLoading])

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

    const [scrollY, setScrollY] = useState(0)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        let ticking = false

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const current = window.scrollY
                    // Only update if it affects the header folding (up to 150px)
                    if (current <= 150) {
                        setScrollY(current)
                    } else if (scrollY !== 150) {
                        setScrollY(150)
                    }
                    ticking = false
                })
                ticking = true
            }
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [scrollY])

    const handleLogout = async () => {
        await signOut()
        window.location.href = '/'
    }

    const threshold = 8000
    const totalSpent = profile?.total_tibs_spent || 0
    const progress = (totalSpent / threshold) * 100
    const isHostEligible = profile?.is_host_eligible || false

    // Group entries by raffle_id (Memoized)
    const groupedEntries = useMemo(() => {
        return myEntries.reduce((acc, entry) => {
            const raffleId = entry.raffle_id
            if (!acc[raffleId]) {
                acc[raffleId] = {
                    event: entry.raffles,
                    entries: []
                }
            }
            acc[raffleId].entries.push(entry)
            return acc
        }, {} as Record<string, { event: any, entries: EntryWithEvent[] }>)
    }, [myEntries])

    const liveGroups = useMemo(() =>
        Object.values(groupedEntries).filter(g => g.event?.status === 'open'),
        [groupedEntries]
    )
    const archivedGroups = useMemo(() =>
        Object.values(groupedEntries).filter(g => g.event?.status !== 'open'),
        [groupedEntries]
    )

    // Check if user won an event (Memoized)
    const didWin = React.useCallback((group: { event: any, entries: EntryWithEvent[] }) => {
        return group.entries.some(e => e.id === group.event?.winning_entry_id)
    }, [])

    const handleEnterEvent = async (eventId: string, cost: number): Promise<boolean> => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return false

        try {
            const { data, error } = await supabaseClient.rpc('enter_raffle', {
                p_raffle_id: eventId,
                p_user_id: userId
            })

            if (error) throw error

            if (data.success) {
                // Dispatch balance update
                window.dispatchEvent(new CustomEvent('balanceUpdate', {
                    detail: { balance: data.new_balance }
                }))

                // Refresh profile data locally (silently)
                fetchProfile(true)
                return true
            } else {
                alert(data.message || 'Failed to enter event.')
                return false
            }
        } catch (error: any) {
            console.error('Error entering event:', error)
            alert(error.message || 'Error entering event.')
            return false
        }
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
        // If user is logged in but profile didn't load, show retry option
        if (userId) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <User size={48} className="text-muted-foreground/20" />
                    <p className="text-muted-foreground">Loading your profile...</p>
                    <button
                        onClick={() => {
                            setIsLoading(true)
                            fetchProfile()
                        }}
                        className="px-6 py-2 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-xl text-xs neon-border shadow-md"
                    >
                        Retry
                    </button>
                </div>
            )
        }
        // User is actually not logged in
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

    const isFolded = scrollY > 40

    return (
        <div className="flex flex-col gap-6 -mx-6">
            {/* STICKY FOLDING HEADER */}
            <div className={`sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-500 px-6 pt-6 pb-4 ${isFolded ? 'translate-y-0 shadow-lg' : 'translate-y-0'}`}>
                <div className="flex flex-col gap-4">
                    {/* Top Row: User Info & Metrics */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div className={`rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden shrink-0 shadow-inner transition-all duration-500 ${isFolded ? 'w-10 h-10' : 'w-14 h-14'}`}>
                                {user?.imageUrl ? (
                                    <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={isFolded ? 20 : 28} className="text-primary" />
                                )}
                            </div>

                            {/* Name & Email */}
                            <div className="flex-1 min-w-0">
                                <h2 className={`font-black tracking-tight text-foreground truncate uppercase transition-all duration-500 ${isFolded ? 'text-base' : 'text-xl'}`}>
                                    {profile.display_name || 'Guest'}
                                </h2>
                                {!isFolded && (
                                    <div className="text-[10px] font-bold text-muted-foreground/60 truncate italic mt-0.5 lowercase flex items-center gap-1.5 animate-in fade-in slide-in-from-left duration-500">
                                        <Mail size={10} className="text-primary/40" />
                                        {profile.email}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Metrics: Side-by-side */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setShowPayoutModal(true)}
                                className={`flex flex-col items-center bg-muted/40 hover:bg-muted/80 rounded-2xl border border-border/50 transition-all active:scale-95 text-center ${isFolded ? 'px-3 py-1.5' : 'px-5 py-2.5'}`}
                            >
                                <span className="text-[8px] font-black uppercase text-primary tracking-widest leading-none mb-1">Balance</span>
                                <div className="flex items-center gap-1 leading-none">
                                    <span className={`${isFolded ? 'text-xs' : 'text-base'} font-black neon-text`}>{profile.tibs_balance.toLocaleString()}</span>
                                    <span className="text-[7px] uppercase tracking-tighter text-muted-foreground font-bold">TIBS</span>
                                </div>
                            </button>
                            <div className={`flex flex-col items-center bg-card/40 rounded-2xl border border-border/50 text-center ${isFolded ? 'px-3 py-1.5' : 'px-5 py-2.5'}`}>
                                <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1 opacity-50">Spent</span>
                                <div className="flex items-center gap-1 leading-none">
                                    <span className={`${isFolded ? 'text-xs' : 'text-base'} font-black text-foreground`}>{totalSpent.toLocaleString()}</span>
                                    <span className="text-[7px] uppercase tracking-tighter text-muted-foreground font-bold">TIBS</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Hosting Eligibility (Full Width) */}
                    {!isFolded && (
                        <div className="flex flex-col gap-1.5 animate-in slide-in-from-top fade-in duration-500">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                <span>Hosting Eligibility</span>
                                <span className="text-primary font-black italic">{totalSpent.toLocaleString()} / {threshold.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/50 relative shadow-inner">
                                <div
                                    className="h-full bg-primary transition-all duration-1000 shadow-[0_0_12px_rgba(57,255,20,0.4)] relative z-10"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                                {isHostEligible && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                                        <span className="text-[7px] font-black uppercase tracking-[0.5em] text-primary-foreground drop-shadow-md animate-pulse">ELIGIBLE FOR HOSTING</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="px-6">
                <div className="flex bg-muted/30 p-1 rounded-2xl border border-border/50">
                    <button
                        onClick={() => setActiveTab('live')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'live' ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Clock size={14} />
                        Live
                    </button>
                    <button
                        onClick={() => setActiveTab('archives')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'archives' ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Trophy size={14} />
                        Archive
                    </button>
                    {isHostEligible && (
                        <button
                            onClick={() => setActiveTab('hosted')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'hosted' ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Plus size={14} strokeWidth={3} />
                            Host
                        </button>
                    )}
                </div>
            </div>

            {/* EVENT MINI FEED */}
            <div className="flex flex-col gap-2 px-6">
                {activeTab === 'live' ? (
                    liveGroups.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                            No Active Entries
                        </div>
                    ) : (
                        liveGroups.map((group) => {
                            const isExpanded = expandedId === group.event.id;
                            return (
                                <div key={group.event.id} className={`flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/20 shadow-lg' : 'hover:bg-muted/30'}`}>
                                    {/* Collapsed Bar */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : group.event.id)}
                                        className="flex items-center justify-between p-4 text-left group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border">
                                                <img src={group.event.media_urls?.[0]} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <h4 className="text-sm font-black truncate uppercase tracking-tight">{group.event.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">x{group.entries.length} Entries</span>
                                                    <span className="w-1 h-1 rounded-full bg-primary/30" />
                                                    <div className="flex items-center gap-1 text-[10px] font-black bg-primary text-black px-2 py-0.5 rounded-md uppercase animate-pulse">
                                                        <Clock size={10} /> Live
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="animate-in slide-in-from-top-4 fade-in duration-300 border-t border-border/50">
                                            <EventCard
                                                event={group.event}
                                                entryCount={entryCounts[group.event.id] || 0}
                                                onEnter={handleEnterEvent}
                                                onShare={handleShareFacebook}
                                                userId={userId}
                                                variant="profile-live"
                                                entryNumbers={group.entries.map(e => e.ticket_number).filter(Boolean) as string[]}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )
                ) : activeTab === 'archives' ? (
                    archivedGroups.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                            No Archive History
                        </div>
                    ) : (
                        archivedGroups.map((group) => {
                            const isExpanded = expandedId === group.event.id;
                            const won = didWin(group);
                            return (
                                <div key={group.event.id} className={`flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/20 shadow-lg' : 'hover:bg-muted/30'}`}>
                                    {/* Collapsed Bar */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : group.event.id)}
                                        className="flex items-center justify-between p-4 text-left group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border grayscale-[0.5]">
                                                <img src={group.event.media_urls?.[0]} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <h4 className="text-sm font-black truncate uppercase tracking-tight text-muted-foreground/80">{group.event.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">x{group.entries.length} Entries</span>
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    {won ? (
                                                        <div className="flex items-center gap-1 text-[10px] font-black bg-green-500 text-black px-2 py-0.5 rounded-md uppercase">
                                                            <Trophy size={10} /> Won
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/40 uppercase">
                                                            <XCircle size={10} /> Missed
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="animate-in slide-in-from-top-4 fade-in duration-300 border-t border-border/50">
                                            <EventCard
                                                event={group.event}
                                                entryCount={entryCounts[group.event.id] || 0}
                                                onEnter={handleEnterEvent}
                                                onShare={handleShareFacebook}
                                                userId={userId}
                                                variant="profile-archive"
                                                isWinner={won}
                                                entryNumbers={group.entries.map(e => e.ticket_number).filter(Boolean) as string[]}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })
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
                        hostedEvents.map((event) => {
                            const isExpanded = expandedId === event.id;
                            const isLive = event.status === 'open';
                            return (
                                <div key={event.id} className={`flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/20 shadow-lg' : 'hover:bg-muted/30'}`}>
                                    {/* Collapsed Bar */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                                        className="flex items-center justify-between p-4 text-left group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-border">
                                                <img src={event.media_urls?.[0]} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <h4 className="text-sm font-black truncate uppercase tracking-tight">{event.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{entryCounts[event.id] || 0} Entries</span>
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    {isLive ? (
                                                        <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase animate-pulse">
                                                            <Clock size={10} /> Live
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/40 uppercase">
                                                            <XCircle size={10} /> Closed
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="animate-in slide-in-from-top-4 fade-in duration-300 border-t border-border/50">
                                            <EventCard
                                                event={event}
                                                entryCount={entryCounts[event.id] || 0}
                                                onEnter={handleEnterEvent}
                                                onShare={handleShareFacebook}
                                                userId={userId}
                                                variant={isLive ? 'feed' : 'profile-archive'}
                                                isWinner={false}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )
                )}
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
                            className="w-full h-16 bg-primary text-black font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 neon-border text-sm"
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
