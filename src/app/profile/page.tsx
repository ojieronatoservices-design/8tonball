"use client"

import React, { useEffect, useState } from 'react'
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
                <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-1">Current Balance</p>
                        <div className="text-2xl font-black">{profile.tibs_balance.toLocaleString()}</div>
                        <p className="text-xs text-white/30 font-bold uppercase">TIBS</p>
                    </div>
                    {profile.tibs_balance > 0 && (
                        <button
                            onClick={() => setShowPayoutModal(true)}
                            className="mt-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all"
                        >
                            Settle Balance
                        </button>
                    )}
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
                        Live
                    </button>
                    <button
                        onClick={() => setActiveTab('archives')}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'archives' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        <Trophy size={14} />
                        Archive
                    </button>
                    {isHostEligible && (
                        <button
                            onClick={() => setActiveTab('hosted')}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'hosted' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
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
                                    className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl flex items-center gap-4 transition-colors"
                                >
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                        <img
                                            src={event.media_urls?.[0] || '/placeholder.png'}
                                            alt={event.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-sm truncate">{event.title}</h4>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${event.status === 'open'
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : 'bg-white/10 text-white/40'
                                                }`}>
                                                {event.status === 'open' ? 'LIVE' : 'ENDED'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                                            <span>{event.entry_cost_tibs} Tibs</span>
                                            <span>•</span>
                                            <CountdownTimer endsAt={event.ends_at} className="" />
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
            {/* Payout Modal */}
            {showPayoutModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-sm rounded-3xl border border-white/10 p-8 flex flex-col gap-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight">Request Payout</h3>
                            <button onClick={() => setShowPayoutModal(false)} className="p-2 bg-white/5 rounded-full text-white/40">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total to Settle</p>
                            <div className="text-2xl font-black text-white">₱{(profile.tibs_balance / 8).toLocaleString()}</div>
                            <p className="text-[10px] text-white/40 font-bold">{profile.tibs_balance.toLocaleString()} TIBS</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase font-black text-white/30 ml-1">GCash Number</label>
                                <input
                                    type="text"
                                    value={gcashNumber}
                                    onChange={(e) => setGcashNumber(e.target.value)}
                                    placeholder="0912 345 6789"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase font-black text-white/30 ml-1">Account Name</label>
                                <input
                                    type="text"
                                    value={gcashName}
                                    onChange={(e) => setGcashName(e.target.value)}
                                    placeholder="JUAN DELA CRUZ"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none uppercase"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleRequestPayout}
                            disabled={isSubmitting}
                            className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                        <p className="text-[10px] text-center text-white/20 italic">
                            Settlements are usually processed within 24-48 hours.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
