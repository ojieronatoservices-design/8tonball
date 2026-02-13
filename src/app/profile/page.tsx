"use client"

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Ticket, ShieldCheck, Clock, Trophy, Loader2, User, LogOut, Wallet, CheckSquare, X, Settings, Image as ImageIcon, XCircle, Mail, ChevronDown, Bell, Coins, Search, LayoutDashboard } from 'lucide-react'
import { useUser, useAuth, useClerk } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { CountdownTimer } from '@/components/CountdownTimer'
import Link from 'next/link'
import AdminDashboard from '../admin/page'

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
        entry_cost_tibs: number
        goal_tibs: number
        all_entries?: { count: number }[]
    }
    ticket_number?: string
}

import { EventCard } from '@/components/EventCard'

// Global cache for instant tab switching
let globalProfileCache: any = null
let globalEntriesCache: any[] | null = null
let globalCountsCache: any = null
let globalHostedCache: any = null

export default function ProfilePage() {
    const { user, isLoaded: isUserLoaded } = useUser()
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { signOut } = useClerk()

    // Initialize with cached data if available
    const [isLoading, setIsLoading] = useState(!globalProfileCache)
    const [profile, setProfile] = useState<any>(globalProfileCache)
    const [myEntries, setMyEntries] = useState<EntryWithEvent[]>(globalEntriesCache || [])
    const [entryCounts, setEntryCounts] = useState<Record<string, number>>(globalCountsCache || {})
    const { getClient } = useSupabase()

    // Main Tabs: 'participant' | 'host'
    const [activeMainTab, setActiveMainTab] = useState<'participant' | 'host'>('participant')

    // Participant Sub-tabs
    const [activeTab, setActiveTab] = useState<'live' | 'archives'>('live')

    const [notifications, setNotifications] = useState<any[]>([])
    const [isLoadingNotifs, setIsLoadingNotifs] = useState(false)
    const [unreadHostCount, setUnreadHostCount] = useState(0)
    const [unreadParticipantCount, setUnreadParticipantCount] = useState(0)

    const [archiveSearch, setArchiveSearch] = useState('')
    const deferredArchiveSearch = React.useDeferredValue(archiveSearch)

    // KYC State
    const [showKYCModal, setShowKYCModal] = useState(false)
    const [kycForm, setKycForm] = useState({
        fullName: '',
        address: '',
        phoneNumber: ''
    })
    const [kycIDFile, setKycIDFile] = useState<File | null>(null)
    const [kycIDPreview, setKycIDPreview] = useState<string | null>(null)
    const [kycSelfieFile, setKycSelfieFile] = useState<File | null>(null)
    const [kycSelfiePreview, setKycSelfiePreview] = useState<string | null>(null)
    const [isSubmittingKYC, setIsSubmittingKYC] = useState(false)
    const [kycStatus, setKycStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified')

    const fetchProfile = async (silent = false) => {
        if (!userId) return

        // If we have cache, don't show loading spinner, but still fetch in background to update
        if (!globalProfileCache && !silent) setIsLoading(true)

        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            // PHASE 1: Fetch profile and entries in parallel
            const [profileResult, entriesResult] = await Promise.all([
                supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single(),
                supabaseClient
                    .from('entries')
                    .select(`
                        id, 
                        raffle_id, 
                        created_at, 
                        ticket_number, 
                        raffles:raffles!entries_raffle_id_fkey(
                            *,
                            host:profiles!host_user_id(email, display_name, is_host_eligible),
                            all_entries:entries!entries_raffle_id_fkey(count)
                        )
                    `)
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
            ])

            if (profileResult.error) throw profileResult.error

            // Update cache and state
            globalProfileCache = profileResult.data
            setProfile(profileResult.data)

            // End loading state early - show profile immediately
            if (!silent) setIsLoading(false)

            if (entriesResult.error) {
                console.error('Entries Fetch Error:', entriesResult.error)
            }

            const entries = entriesResult.data as any[] || []
            globalEntriesCache = entries
            setMyEntries(entries)

            // PHASE 2: Fetch entry counts in PARALLEL (not sequential loop)
            const raffleIds = [...new Set(entries.map(e => e.raffle_id))]
            if (raffleIds.length > 0) {
                const countPromises = raffleIds.map(id =>
                    supabaseClient
                        .from('entries')
                        .select('*', { count: 'exact', head: true })
                        .eq('raffle_id', id)
                        .then(({ count }: { count: number | null }) => ({ id, count: count || 0 }))
                )
                const countResults = await Promise.all(countPromises)
                const counts: Record<string, number> = {}
                countResults.forEach(({ id, count }) => { counts[id] = count })
                globalCountsCache = counts
                setEntryCounts(counts)
            }

            // PHASE 4: Check KYC Status
            const { data: kycData } = await supabaseClient
                .from('kyc_requests')
                .select('status')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (kycData) {
                setKycStatus(kycData.status as any)
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
            if (!silent) setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchProfile()
            fetchUnreadCounts()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId])

    const fetchUnreadCounts = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) return
        const { data } = await supabaseClient.from('notifications').select('type').eq('user_id', userId).eq('is_read', false)
        if (data) {
            let host = 0, participant = 0
            data.forEach((n: any) => {
                if (n.type === 'entry') host++
                else participant++
            })
            setUnreadHostCount(host)
            setUnreadParticipantCount(participant)
        }
    }

    const handleKYCSubmit = async () => {
        if (!userId || !kycIDFile || !kycSelfieFile || !kycForm.fullName || !kycForm.address || !kycForm.phoneNumber) {
            alert('Please complete all fields and upload both photos.')
            return
        }

        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsSubmittingKYC(true)
        try {
            // 1. Upload ID
            const idExt = kycIDFile.name.split('.').pop()
            const idPath = `kyc/${userId}-id-${Date.now()}.${idExt}`
            const { error: idError } = await supabaseClient.storage.from('media').upload(idPath, kycIDFile)
            if (idError) throw idError

            // 2. Upload Selfie
            const selfieExt = kycSelfieFile.name.split('.').pop()
            const selfiePath = `kyc/${userId}-selfie-${Date.now()}.${selfieExt}`
            const { error: selfieError } = await supabaseClient.storage.from('media').upload(selfiePath, kycSelfieFile)
            if (selfieError) throw selfieError

            const { data: { publicUrl: idUrl } } = supabaseClient.storage.from('media').getPublicUrl(idPath)
            const { data: { publicUrl: selfieUrl } } = supabaseClient.storage.from('media').getPublicUrl(selfiePath)

            // 3. Create Request
            const { error: insertError } = await supabaseClient
                .from('kyc_requests')
                .insert([{
                    user_id: userId,
                    full_name: kycForm.fullName,
                    address: kycForm.address,
                    phone_number: kycForm.phoneNumber,
                    id_image_url: idUrl,
                    selfie_image_url: selfieUrl,
                    status: 'pending'
                }])

            if (insertError) throw insertError

            setKycStatus('pending')
            setShowKYCModal(false)
            alert('Verification request submitted! We will review it shortly.')
        } catch (error: any) {
            console.error('KYC Error:', error)
            alert(error.message || 'Error submitting verification')
        } finally {
            setIsSubmittingKYC(false)
        }
    }

    const handleIDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setKycIDFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setKycIDPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setKycSelfieFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setKycSelfiePreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

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
                    setProfile((prev: any) => prev ? { ...prev, ...payload.new } : payload.new)
                })
                .subscribe()

            // Subscribe to raffle updates (for when events user entered are drawn)
            rafflesChannel = supabaseClient
                .channel('raffles-profile-realtime')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'raffles'
                }, (payload: any) => {
                    setMyEntries((prev: EntryWithEvent[]) => prev.map(entry =>
                        entry.raffle_id === payload.new?.id
                            ? { ...entry, raffles: { ...entry.raffles, ...payload.new } }
                            : entry
                    ))
                })
                .subscribe()
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


    const [expandedId, setExpandedId] = useState<string | null>(null)


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
    const archivedGroups = useMemo(() => {
        const groups = Object.values(groupedEntries).filter(g => g.event?.status !== 'open')
        if (!deferredArchiveSearch) return groups

        const search = deferredArchiveSearch.toLowerCase()
        return groups.filter(g => {
            const matchesTitle = g.event?.title?.toLowerCase().includes(search)
            const matchesTicket = g.entries.some(e => e.ticket_number?.toLowerCase().includes(search))
            return matchesTitle || matchesTicket
        })
    }, [groupedEntries, deferredArchiveSearch])

    // Check if user won an event (Memoized)
    const didWin = React.useCallback((group: { event: any, entries: EntryWithEvent[] }) => {
        // Robust check: user ID match OR ticket number match OR entry ID match
        const isWinnerById = group.event?.winner_user_id === userId
        const isWinnerByTicket = group.entries.some(e => e.ticket_number === group.event?.winning_ticket_number)
        const isWinnerByEntryId = group.entries.some(e => e.id === group.event?.winning_entry_id)

        return isWinnerById || isWinnerByTicket || isWinnerByEntryId
    }, [userId])

    // Load read wins from local storage
    const [readWinIds, setReadWinIds] = useState<Set<string>>(new Set())
    useEffect(() => {
        const stored = localStorage.getItem('read_wins')
        if (stored) {
            setReadWinIds(new Set(JSON.parse(stored)))
        }
    }, [])

    const markWinAsRead = (id: string) => {
        if (!readWinIds.has(id)) {
            const newSet = new Set(readWinIds)
            newSet.add(id)
            setReadWinIds(newSet)
            localStorage.setItem('read_wins', JSON.stringify(Array.from(newSet)))
        }
    }

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

    const handleClaim = async (raffleId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { error } = await supabaseClient
                .from('raffles')
                .update({ status: 'claimed' })
                .eq('id', raffleId)

            if (error) throw error

            // Refresh data silently
            fetchProfile(true)
        } catch (error) {
            console.error('Error claiming prize:', error)
            alert('Error marking as claimed. Please try again.')
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
        <div className="flex flex-col gap-6 -mx-6 min-h-[85vh]">

            {/* KYC BANNER (Sticky at top) */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-300">
                {kycStatus !== 'verified' && (
                    <div className="w-full bg-primary/10 border-b border-primary/20 px-6 py-2 flex justify-between items-center animate-in slide-in-from-top fade-in duration-500">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={14} className="text-primary animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                                {kycStatus === 'pending' ? 'KYC Pending Review' :
                                    kycStatus === 'rejected' ? 'KYC Rejected' :
                                        'Verify Account to Host'}
                            </span>
                        </div>
                        {kycStatus === 'unverified' || kycStatus === 'rejected' ? (
                            <button
                                onClick={() => setShowKYCModal(true)}
                                className="text-[9px] font-black uppercase tracking-widest bg-primary text-black px-3 py-1 rounded-full hover:scale-105 active:scale-95 transition-transform"
                            >
                                Verify Now
                            </button>
                        ) : (
                            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">in progress</span>
                        )}
                    </div>
                )}

                {/* MAIN TAB SWITCHER */}
                <div className="px-6 py-4">
                    <div className="flex bg-muted/30 p-1 rounded-2xl border border-border/50">
                        <button
                            onClick={() => setActiveMainTab('participant')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 relative ${activeMainTab === 'participant' ? 'bg-white text-black shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <User size={14} strokeWidth={3} />
                            Participant
                            {unreadParticipantCount > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveMainTab('host')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 relative ${activeMainTab === 'host' ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <LayoutDashboard size={14} strokeWidth={3} />
                            Host
                            {unreadHostCount > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            {activeMainTab === 'host' ? (
                // Host Dashboard (Embedded)
                <div className="px-6 pb-20 animate-in fade-in slide-in-from-right-4 duration-300">
                    <AdminDashboard />
                </div>
            ) : (
                // Participant Profile
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4 duration-300">

                    {/* Participant Sub-tabs */}
                    <div className="px-6 w-full max-w-3xl mx-auto">
                        <div className="flex bg-muted/30 p-1 rounded-2xl border border-border/50">
                            <button
                                onClick={() => setActiveTab('live')}
                                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'live' ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Clock size={12} /> Live
                            </button>
                            <button
                                onClick={() => setActiveTab('archives')}
                                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 relative ${activeTab === 'archives' ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Trophy size={12} /> Archive
                                {archivedGroups.some(g => didWin(g) && !g.event.is_read && !readWinIds.has(g.event.id)) && (
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* EVENT MINI FEED */}
                    <div className="flex flex-col pb-24">
                        {activeTab === 'live' ? (
                            liveGroups.length === 0 ? (
                                <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                                    No Active Entries
                                </div>
                            ) : (
                                liveGroups.map((group) => {
                                    const isExpanded = expandedId === group.event.id;
                                    return (
                                        <div key={group.event.id} className="w-full">
                                            <div className={`flex flex-col bg-card border-b border-border transition-all duration-300 ${isExpanded ? 'bg-muted/30' : 'hover:bg-muted/10'}`}>
                                                {/* Collapsed Bar */}
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : group.event.id)}
                                                    className="flex items-center justify-between p-4 text-left group"
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border bg-muted/20">
                                                            <img src={group.event.media_urls?.[0]} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0 gap-0.5">
                                                            <h4 className="text-sm font-black truncate uppercase tracking-tight leading-none">{group.event.title}</h4>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">x{group.entries.length} Entries</span>
                                                                <span className="w-0.5 h-0.5 rounded-full bg-border" />
                                                                <div className="flex items-center gap-1 text-[9px] font-black text-primary uppercase animate-pulse">
                                                                    <Clock size={10} /> Live
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <ChevronDown size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                                    </div>
                                                </button>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="animate-in slide-in-from-top-2 fade-in duration-300 border-t border-border/50 bg-black/20">
                                                        <EventCard
                                                            event={group.event}
                                                            entryCount={entryCounts[group.event.id] || 0}
                                                            onEnter={handleEnterEvent}
                                                            onShare={handleShareFacebook}
                                                            userId={userId}
                                                            variant="profile-live"
                                                            onClaim={handleClaim}
                                                            entryNumbers={group.entries.map(e => e.ticket_number).filter(Boolean) as string[]}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )
                        ) : activeTab === 'archives' ? (
                            <div className="flex flex-col">
                                {Object.values(groupedEntries).filter(g => g.event?.status !== 'open').length > 0 && (
                                    <div className="relative group px-6 mb-4">
                                        <Search size={14} className="absolute left-10 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search by raffle title or ticket number..."
                                            value={archiveSearch}
                                            onChange={(e) => setArchiveSearch(e.target.value)}
                                            className="w-full bg-muted/20 border border-border/50 rounded-2xl pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/30"
                                        />
                                        {archiveSearch && (
                                            <button
                                                onClick={() => setArchiveSearch('')}
                                                className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {archivedGroups.length === 0 ? (
                                    <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                                        {archiveSearch ? 'No matching tickets found' : 'No Archive History'}
                                    </div>
                                ) : (
                                    archivedGroups.map((group) => {
                                        const isExpanded = expandedId === group.event.id;
                                        const won = didWin(group);
                                        const totalEntries = group.event.all_entries?.[0]?.count || 0
                                        const currentTibs = totalEntries * group.event.entry_cost_tibs
                                        const goalMet = group.event.goal_tibs > 0 ? currentTibs >= group.event.goal_tibs : true
                                        return (
                                            <div key={group.event.id} className="w-full">
                                                <div className={`flex flex-col bg-card border-b border-border transition-all duration-300 ${isExpanded ? 'bg-muted/30' : 'hover:bg-muted/10'}`}>
                                                    {/* Collapsed Bar */}
                                                    <button
                                                        onClick={() => {
                                                            const isExpanded = expandedId === group.event.id
                                                            setExpandedId(isExpanded ? null : group.event.id)
                                                            if (!isExpanded && won) {
                                                                markWinAsRead(group.event.id)
                                                            }
                                                        }}
                                                        className="flex items-center justify-between p-4 text-left group"
                                                    >
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border grayscale-[0.5] bg-muted/20">
                                                                <img src={group.event.media_urls?.[0]} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="flex flex-col min-w-0 gap-0.5">
                                                                <h4 className="text-sm font-black truncate uppercase tracking-tight text-muted-foreground/80 leading-none">{group.event.title}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">x{group.entries.length} Entries</span>
                                                                    <span className="w-0.5 h-0.5 rounded-full bg-border" />
                                                                    {won && goalMet ? (
                                                                        <div className="flex items-center gap-1 text-[9px] font-black bg-green-500 text-black px-2 py-0.5 rounded-md uppercase">
                                                                            <Trophy size={10} /> Won
                                                                        </div>
                                                                    ) : won && !goalMet ? (
                                                                        <div className="flex items-center gap-1 text-[9px] font-black bg-orange-500 text-black px-2 py-0.5 rounded-md uppercase">
                                                                            <Coins size={10} /> Tibs Refunded
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/40 uppercase">
                                                                            <XCircle size={10} /> Missed
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {won && !group.event.is_read && !readWinIds.has(group.event.id) && (
                                                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                                            )}
                                                            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                                <ChevronDown size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {/* Expanded Content */}
                                                    {isExpanded && (
                                                        <div className="animate-in slide-in-from-top-2 fade-in duration-300 border-t border-border/50 bg-black/20">
                                                            <EventCard
                                                                event={group.event}
                                                                entryCount={entryCounts[group.event.id] || 0}
                                                                onEnter={handleEnterEvent}
                                                                onShare={handleShareFacebook}
                                                                userId={userId}
                                                                variant="profile-archive"
                                                                isWinner={won && goalMet}
                                                                isRefunded={won && !goalMet}
                                                                onClaim={handleClaim}
                                                                entryNumbers={group.entries.map(e => e.ticket_number).filter(Boolean) as string[]}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )
                                }
                            </div>
                        ) : (
                            <div className="px-6 w-full max-w-3xl mx-auto flex flex-col gap-4">
                                {isLoadingNotifs ? (
                                    <div className="py-20 flex justify-center">
                                        <Loader2 className="animate-spin text-primary" />
                                    </div>
                                ) : notifications.length > 0 ? (
                                    notifications.map((n) => (
                                        <div key={n.id} className="p-4 bg-muted/20 border border-border rounded-2xl flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                {n.type === 'win' ? <Trophy size={18} className="text-primary" /> : <Bell size={18} className="text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{n.message}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-[0.2em] text-xs">
                                        No Activity Yet
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {/* KYC Modal */}
            {
                showKYCModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-300 overflow-auto">
                        <div className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border p-10 flex flex-col gap-6 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-black tracking-tight text-foreground uppercase italic">Account Verification</h3>
                                <button onClick={() => setShowKYCModal(false)} className="w-10 h-10 bg-muted flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest">Full Legal Name</label>
                                    <input
                                        type="text"
                                        value={kycForm.fullName}
                                        onChange={(e) => setKycForm(prev => ({ ...prev, fullName: e.target.value }))}
                                        placeholder="as shown on ID"
                                        className="w-full h-12 bg-muted/50 border border-border rounded-xl px-6 text-sm font-bold focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground/20"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest">Home Address</label>
                                    <input
                                        type="text"
                                        value={kycForm.address}
                                        onChange={(e) => setKycForm(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="Current Residence"
                                        className="w-full h-12 bg-muted/50 border border-border rounded-xl px-6 text-sm font-bold focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground/20"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest">Mobile Number</label>
                                    <input
                                        type="tel"
                                        value={kycForm.phoneNumber}
                                        onChange={(e) => setKycForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                        placeholder="+63 9XX XXX XXXX"
                                        className="w-full h-12 bg-muted/50 border border-border rounded-xl px-6 text-sm font-bold focus:border-primary focus:outline-none text-foreground placeholder:text-muted-foreground/20"
                                    />
                                    {!user?.primaryPhoneNumber && (
                                        <p className="text-[9px] text-primary/70 font-bold px-2 italic">Note: Make sure this matches the number verified in your account settings.</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    {/* ID Upload */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest text-center">ID Photo</label>
                                        <button
                                            onClick={() => document.getElementById('id-upload')?.click()}
                                            className={`aspect-video w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden bg-muted/30 transition-all ${kycIDPreview ? 'border-primary/50' : 'border-border hover:border-primary/30'}`}
                                        >
                                            {kycIDPreview ? (
                                                <img src={kycIDPreview} alt="ID" className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <ImageIcon size={24} className="text-muted-foreground/30" />
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/50">Upload ID</span>
                                                </>
                                            )}
                                        </button>
                                        <input type="file" id="id-upload" hidden accept="image/*" onChange={handleIDChange} />
                                    </div>

                                    {/* Selfie Upload */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] uppercase font-black text-muted-foreground/50 ml-2 tracking-widest text-center">Selfie Photo</label>
                                        <button
                                            onClick={() => document.getElementById('selfie-upload')?.click()}
                                            className={`aspect-video w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden bg-muted/30 transition-all ${kycSelfiePreview ? 'border-primary/50' : 'border-border hover:border-primary/30'}`}
                                        >
                                            {kycSelfiePreview ? (
                                                <img src={kycSelfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <User size={24} className="text-muted-foreground/30" />
                                                    <span className="text-[8px] font-black uppercase text-muted-foreground/50">Upload Selfie</span>
                                                </>
                                            )}
                                        </button>
                                        <input type="file" id="selfie-upload" hidden accept="image/*" onChange={handleSelfieChange} />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleKYCSubmit}
                                disabled={isSubmittingKYC || !kycIDFile || !kycSelfieFile || !kycForm.fullName}
                                className="w-full h-16 bg-primary text-black font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 neon-border text-sm mt-4"
                            >
                                {isSubmittingKYC ? 'Uploading Photos...' : 'Submit Verification'}
                            </button>
                            <p className="text-[9px] text-center text-muted-foreground/40 font-medium px-4 leading-normal">
                                By submitting, you agree to our host terms. Verification typically takes 2-6 hours. Your data is encrypted and stored securely.
                            </p>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
