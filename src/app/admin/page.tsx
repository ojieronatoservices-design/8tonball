"use client"

import React, { useState, useEffect } from 'react'
import { Plus, Check, X, LayoutDashboard, Loader2, CheckCircle2, Trophy, ShieldAlert, BarChart3, Users, Ticket, Coins } from 'lucide-react'
import { useUser, useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

export default function AdminDashboard() {
    const { user } = useUser()
    const { userId } = useAuth()
    const { getClient } = useSupabase()
    const [activeTab, setActiveTab] = useState<'events' | 'payments' | 'analytics'>('events')
    const [eventImages, setEventImages] = useState<File[]>([])
    const [eventPreviews, setEventPreviews] = useState<string[]>([])
    const [isLaunching, setIsLaunching] = useState(false)

    // Permission State
    const [isAdmin, setIsAdmin] = useState(false)
    const [isHostEligible, setIsHostEligible] = useState(false)
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(true)

    // Form State
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [cost, setCost] = useState('')
    const [drawTime, setDrawTime] = useState('')

    // Payments State
    const [payments, setPayments] = useState<any[]>([])
    const [isLoadingPayments, setIsLoadingPayments] = useState(false)

    // Manage Events State
    const [existingEvents, setExistingEvents] = useState<any[]>([])
    const [isLoadingEvents, setIsLoadingEvents] = useState(false)

    // Analytics State
    const [analytics, setAnalytics] = useState<{
        totalUsers: number
        totalEvents: number
        totalEntries: number
        totalTibsSpent: number
        pendingPayments: number
    } | null>(null)
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

    // Check permissions on load
    useEffect(() => {
        const checkPermissions = async () => {
            if (!userId) {
                setIsCheckingPermissions(false)
                return
            }

            const supabaseClient = await getClient()
            if (!supabaseClient) {
                setIsCheckingPermissions(false)
                return
            }

            try {
                const { data: profile, error } = await supabaseClient
                    .from('profiles')
                    .select('is_admin, is_host_eligible')
                    .eq('id', userId)
                    .single()

                if (profile) {
                    setIsAdmin(profile.is_admin || false)
                    setIsHostEligible(profile.is_host_eligible || false)
                }
            } catch (err) {
                console.error('Error checking permissions:', err)
            } finally {
                setIsCheckingPermissions(false)
            }
        }

        checkPermissions()
    }, [userId])

    const fetchEvents = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoadingEvents(true)
        try {
            const { data, error } = await supabaseClient
                .from('raffles')
                .select('*, entries(count)')
                .order('created_at', { ascending: false })

            if (error) throw error
            setExistingEvents(data || [])
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setIsLoadingEvents(false)
        }
    }

    const fetchAnalytics = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoadingAnalytics(true)
        try {
            const [
                { count: usersCount },
                { count: eventsCount },
                { count: entriesCount },
                { data: profilesData },
                { count: pendingCount }
            ] = await Promise.all([
                supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
                supabaseClient.from('raffles').select('*', { count: 'exact', head: true }),
                supabaseClient.from('entries').select('*', { count: 'exact', head: true }),
                supabaseClient.from('profiles').select('total_tibs_spent'),
                supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
            ])

            const totalSpent = profilesData?.reduce((acc, curr) => acc + (curr.total_tibs_spent || 0), 0) || 0

            setAnalytics({
                totalUsers: usersCount || 0,
                totalEvents: eventsCount || 0,
                totalEntries: entriesCount || 0,
                totalTibsSpent: totalSpent,
                pendingPayments: pendingCount || 0
            })
        } catch (error) {
            console.error('Error fetching analytics:', error)
        } finally {
            setIsLoadingAnalytics(false)
        }
    }

    const fetchPayments = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoadingPayments(true)
        try {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*, profiles(email, display_name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            setPayments(data || [])
        } catch (error) {
            console.error('Error fetching payments:', error)
        } finally {
            setIsLoadingPayments(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'payments') {
            fetchPayments()
        } else if (activeTab === 'events') {
            fetchEvents()
        } else if (activeTab === 'analytics') {
            fetchAnalytics()
        }
    }, [activeTab, userId])

    const handleDrawWinner = async (eventId: string, eventTitle: string, eventImage: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!confirm('Are you sure you want to draw a winner now?')) return

        try {
            // 1. Get all entries for this event
            const { data: entries, error: entriesError } = await supabaseClient
                .from('entries')
                .select('user_id, id')
                .eq('raffle_id', eventId)

            if (entriesError) throw entriesError
            if (!entries || entries.length === 0) {
                alert('No entries found for this event.')
                return
            }

            // 2. Randomly select a winner
            const winner = entries[Math.floor(Math.random() * entries.length)]

            // 3. Get winner's email
            const { data: winnerProfile } = await supabaseClient
                .from('profiles')
                .select('email, display_name')
                .eq('id', winner.user_id)
                .single()

            // 4. Update event status and winner
            const { error: updateError } = await supabaseClient
                .from('raffles')
                .update({
                    status: 'drawn',
                    winner_user_id: winner.user_id,
                    winning_entry_id: winner.id,
                    drawn_at: new Date().toISOString()
                })
                .eq('id', eventId)

            if (updateError) throw updateError

            // 5. Create notification for the winner
            await supabaseClient.from('notifications').insert([{
                user_id: winner.user_id,
                message: `🎉 Congratulations! You won "${eventTitle}"! Check your email for details.`,
                type: 'win'
            }])

            // 6. Send winner email
            if (winnerProfile?.email) {
                await fetch('/api/send-winner-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: winnerProfile.email,
                        winnerName: winnerProfile.display_name,
                        eventTitle: eventTitle,
                        eventImage: eventImage
                    })
                })
            }

            alert('Winner drawn successfully! Email notification sent.')
            fetchEvents()
        } catch (error: any) {
            console.error('Error drawing winner:', error)
            alert(error.message || 'Error drawing winner.')
        }
    }

    const handleApprove = async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { data, error } = await supabaseClient.rpc('approve_transaction', {
                p_transaction_id: id,
                p_admin_id: userId
            })

            if (error) throw error

            alert('Payment approved and Tibs credited!')
            fetchPayments()
        } catch (error: any) {
            alert(error.message || 'Error approving payment')
        }
    }

    const handleReject = async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { error } = await supabaseClient
                .from('transactions')
                .update({ status: 'rejected' })
                .eq('id', id)

            if (error) throw error

            alert('Payment rejected.')
            fetchPayments()
        } catch (error: any) {
            alert(error.message || 'Error rejecting payment')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const newFiles = Array.from(files)
            setEventImages((prev: File[]) => [...prev, ...newFiles])

            const newPreviews = newFiles.map(file => URL.createObjectURL(file))
            setEventPreviews((prev: string[]) => [...prev, ...newPreviews])
        }
    }

    const removeImage = (index: number) => {
        setEventImages((prev: File[]) => prev.filter((_: File, i: number) => i !== index))
        setEventPreviews((prev: string[]) => prev.filter((_: string, i: number) => i !== index))
    }

    const handleLaunchEvent = async () => {
        if (!title || !cost || !drawTime) {
            alert('Please fill in all required fields (Title, Cost, Draw Time)')
            return
        }

        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) {
            alert('You must be logged in to launch an event.')
            return
        }

        setIsLaunching(true)
        try {
            const mediaUrls: string[] = []

            // 1. Upload Images to Supabase Storage
            if (eventImages.length > 0) {
                for (const image of eventImages) {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`

                    const { error: uploadError } = await supabaseClient.storage
                        .from('media')
                        .upload(filePath, image)

                    if (uploadError) throw uploadError

                    const { data: { publicUrl } } = supabaseClient.storage
                        .from('media')
                        .getPublicUrl(filePath)

                    mediaUrls.push(publicUrl)
                }
            }

            // 2. Insert Event into Database
            const { error: insertError } = await supabaseClient
                .from('raffles')
                .insert([{
                    title,
                    description,
                    entry_cost_tibs: parseInt(cost),
                    ends_at: new Date(drawTime).toISOString(),
                    media_urls: mediaUrls,
                    host_user_id: userId,
                    status: 'open'
                }])

            if (insertError) throw insertError

            alert('Event launched successfully!')
            // Reset form
            setTitle('')
            setDescription('')
            setCost('')
            setDrawTime('')
            setEventImages([])
            setEventPreviews([])
            fetchEvents()

        } catch (error: any) {
            console.error('Error launching event:', error)
            alert(error.message || 'Error launching event.')
        } finally {
            setIsLaunching(false)
        }
    }

    // Show loading while checking permissions
    if (isCheckingPermissions) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-white/40 text-sm">Checking permissions...</p>
            </div>
        )
    }

    // Block access if not admin or host eligible
    if (!isAdmin && !isHostEligible) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center px-8">
                <div className="bg-red-500/20 p-4 rounded-2xl border border-red-500/30">
                    <ShieldAlert className="text-red-500" size={48} />
                </div>
                <h2 className="text-2xl font-black">Access Denied</h2>
                <p className="text-white/40 text-sm max-w-xs">
                    You need to spend at least <span className="text-primary font-bold">8,000 Tibs</span> to become eligible to host events.
                </p>
                <a href="/wallet" className="mt-4 px-6 py-3 bg-primary text-black font-black uppercase tracking-widest rounded-2xl text-sm">
                    Go to Wallet
                </a>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight">
                        {isAdmin ? 'Admin Hub' : 'Host Dashboard'}
                    </h2>
                    <p className="text-white/40 text-sm">
                        {isAdmin ? 'Control center for 8TONBALL.' : 'Launch and manage your events.'}
                    </p>
                </div>
                <div className="bg-primary/20 p-2 rounded-xl border border-primary/30">
                    <LayoutDashboard className="text-primary" size={24} />
                </div>
            </div>

            {/* Admin Tabs - Only show Payments tab for admins */}
            {isAdmin ? (
                <div className="flex bg-card p-1.5 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'events' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        Manage Events
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'payments' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        Payments Queue
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        Analytics
                    </button>
                </div>
            ) : null}

            {activeTab === 'analytics' ? (
                <div className="flex flex-col gap-6">
                    {isLoadingAnalytics ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : analytics ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Users size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Total Users</span>
                                </div>
                                <div className="text-3xl font-black">{analytics.totalUsers}</div>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Trophy size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Total Events</span>
                                </div>
                                <div className="text-3xl font-black">{analytics.totalEvents}</div>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Ticket size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Total Entries</span>
                                </div>
                                <div className="text-3xl font-black">{analytics.totalEntries}</div>
                            </div>
                            <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-white/40">
                                    <Coins size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Tibs Spent</span>
                                </div>
                                <div className="text-3xl font-black text-primary">{analytics.totalTibsSpent.toLocaleString()}</div>
                            </div>
                            <div className="col-span-2 bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-white/40">
                                    <ShieldAlert size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Pending Payments</span>
                                </div>
                                <div className="text-3xl font-black">{analytics.pendingPayments}</div>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : activeTab === 'events' ? (
                <div className="flex flex-col gap-10">
                    {/* Create Event Card */}
                    <div className="bg-card p-8 rounded-3xl border border-dashed border-primary/30 flex flex-col gap-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Plus className="text-primary" size={20} />
                            New Event
                        </h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Prize Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. iPhone 15 Pro"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Prize details..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label>
                                <input
                                    type="datetime-local"
                                    value={drawTime}
                                    onChange={(e) => setDrawTime(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs)</label>
                                    <input
                                        type="number"
                                        value={cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        placeholder="100"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media (Multiple allowed)</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {eventPreviews.map((preview: string, index: number) => (
                                            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={14} className="text-white" />
                                                </button>
                                            </div>
                                        ))}

                                        <label className="aspect-square bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors group">
                                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                                            <Plus size={18} className="group-hover:text-primary transition-colors" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleLaunchEvent}
                                disabled={isLaunching}
                                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLaunching && <Loader2 size={18} className="animate-spin" />}
                                {isLaunching ? 'Launching...' : 'Launch'}
                            </button>
                        </div>
                    </div>

                    {/* Active Events List */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-bold px-2">
                            {isAdmin ? 'Manage Active Events' : 'Your Events'}
                        </h3>
                        {isLoadingEvents ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : existingEvents
                            .filter((e: any) => e.status === 'open')
                            .filter((e: any) => isAdmin || e.host_user_id === userId) // Hosts only see their own
                            .length === 0 ? (
                            <p className="text-white/20 text-center py-10 text-sm font-bold uppercase tracking-widest">
                                {isAdmin ? 'No active events to draw.' : 'You haven\'t launched any events yet.'}
                            </p>
                        ) : (
                            existingEvents
                                .filter((e: any) => e.status === 'open')
                                .filter((e: any) => isAdmin || e.host_user_id === userId)
                                .map((event: any) => (
                                    <div key={event.id} className="bg-card p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                                        <div className="w-16 h-16 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                                            <img src={event.media_urls?.[0] || 'https://via.placeholder.com/150'} alt="proof" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <h4 className="font-bold text-sm truncate">{event.title}</h4>
                                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                                {event.entries?.[0]?.count || 0} Entries
                                            </p>
                                        </div>
                                        {/* Admins or the Event Host can draw winners */}
                                        {(isAdmin || (isHostEligible && event.host_user_id === userId)) && (
                                            <button
                                                onClick={() => handleDrawWinner(event.id, event.title, event.media_urls?.[0])}
                                                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                                            >
                                                Draw Winner
                                            </button>
                                        )}
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {isLoadingPayments ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4 bg-card rounded-3xl border border-white/5">
                            <CheckCircle2 size={48} />
                            <p className="font-bold">Queue is clear!</p>
                        </div>
                    ) : (
                        payments.map((pmt: any) => (
                            <div key={pmt.id} className="bg-card p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10 group relative cursor-zoom-in">
                                    <img src={pmt.proof_image_url} alt="proof" className="w-full h-full object-cover" />
                                    <a href={pmt.proof_image_url} target="_blank" className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-tighter">View Full</a>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-bold text-sm truncate">{pmt.profiles?.display_name || pmt.profiles?.email || 'Unknown User'}</h4>
                                    <p className="text-primary text-xs font-black">{pmt.requested_tibs} Tibs</p>
                                    <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                                        {new Date(pmt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReject(pmt.id)}
                                        className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleApprove(pmt.id)}
                                        className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center border border-green-500/20 hover:bg-green-500 hover:text-white transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
