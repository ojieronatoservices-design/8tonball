"use client"

import React, { useState, useEffect, memo, useCallback } from 'react'
import { Plus, Check, X, LayoutDashboard, Loader2, CheckCircle2, Trophy, ShieldAlert, BarChart3, Users, Ticket, Coins, Image as ImageIcon, Edit, Trash2, Calendar, ChevronDown } from 'lucide-react'
import { useUser, useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { EventCard } from '@/components/EventCard'

// --- Performance Optimized Sub-components ---

const isVideo = (url: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.startsWith('data:video/')
}

const threshold = 8000;

const CreateEventModal = memo(({
    isAdmin,
    isHostEligible,
    onLaunch,
    getClient,
    userId,
    existingEventsCount,
    onClose
}: {
    isAdmin: boolean,
    isHostEligible: boolean,
    onLaunch: () => void,
    getClient: () => Promise<any>,
    userId: string | null | undefined,
    existingEventsCount: number,
    onClose: () => void
}) => {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [cost, setCost] = useState('')
    const [goal, setGoal] = useState('')
    const [drawTime, setDrawTime] = useState('')
    const [eventImages, setEventImages] = useState<File[]>([])
    const [eventPreviews, setEventPreviews] = useState<string[]>([])
    const [isLaunching, setIsLaunching] = useState(false)

    // Cleanup Object URLs on unmount
    useEffect(() => {
        return () => {
            eventPreviews.forEach(url => URL.revokeObjectURL(url))
        }
    }, [eventPreviews])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const newFiles = Array.from(files)
            const LIMIT = 200 * 1024 * 1024
            const oversized = newFiles.filter(f => f.size > LIMIT)
            if (oversized.length > 0) {
                alert('⚠️ FILE TOO LARGE: One or more files exceed the 200MB limit.')
                return
            }
            setEventImages(prev => [...prev, ...newFiles])
            const newPreviews = newFiles.map(file => URL.createObjectURL(file))
            setEventPreviews(prev => [...prev, ...newPreviews])
        }
    }

    const removeImage = (index: number) => {
        setEventImages(prev => prev.filter((_, i) => i !== index))
        setEventPreviews(prev => {
            const url = prev[index]
            if (url) URL.revokeObjectURL(url)
            return prev.filter((_, i) => i !== index)
        })
    }

    const handleLaunchEvent = async () => {
        if (isLaunching) return
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
            if (eventImages.length > 0) {
                for (const image of eventImages) {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`
                    const { error: uploadError } = await supabaseClient.storage.from('media').upload(filePath, image)
                    if (uploadError) throw uploadError
                    const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(filePath)
                    mediaUrls.push(publicUrl)
                }
            }

            const date = new Date()
            const monthLetter = date.toLocaleString('default', { month: 'short' })[0].toUpperCase()
            const yearShort = date.getFullYear().toString().slice(-2)
            const displayId = `#${monthLetter}${yearShort}.${existingEventsCount + 1}`

            const { error: insertError } = await supabaseClient.from('raffles').insert([{
                title,
                description,
                entry_cost_tibs: parseInt(cost),
                ends_at: new Date(drawTime).toISOString(),
                media_urls: mediaUrls,
                host_user_id: userId,
                status: 'open',
                goal_tibs: parseInt(goal) || 0,
                display_id: displayId
            }])

            if (insertError) throw insertError
            alert('Event launched successfully!')
            onLaunch()
            onClose()
        } catch (error: any) {
            alert(error.message || 'Error launching event.')
        } finally {
            setIsLaunching(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Plus className="text-primary" size={20} /> New Event
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-1.5" >
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Prize Title</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. iPhone 15 Pro"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Prize details..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label>
                        <input type="datetime-local" value={drawTime} onChange={(e) => setDrawTime(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs)</label>
                            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="100"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs)</label>
                            <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="5000"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media (Multiple allowed)</label>
                        <div className="grid grid-cols-4 gap-2">
                            {eventPreviews.map((preview: string, index: number) => (
                                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                    {isVideo(preview) ? <video src={preview} className="w-full h-full object-cover" /> : <img src={preview} alt="Preview" className="w-full h-full object-cover" />}
                                    <button onClick={() => removeImage(index)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X size={14} className="text-white" />
                                    </button>
                                </div>
                            ))}
                            <label className="aspect-square bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors group">
                                <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} />
                                <ImageIcon size={24} className="group-hover:scale-110 transition-transform" />
                            </label>
                        </div>
                    </div>
                    <button
                        onClick={handleLaunchEvent}
                        disabled={isLaunching || (!isAdmin && !isHostEligible)}
                        className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLaunching && <Loader2 size={18} className="animate-spin" />}
                        {isLaunching ? 'Launching...' : (!isAdmin && !isHostEligible) ? 'Eligibility Required' : 'Launch'}
                    </button>
                    {!isAdmin && !isHostEligible && (
                        <p className="text-[10px] text-red-500 font-black uppercase tracking-widest text-center">
                            ⚠️ Spending goal of 8,000 Tibs required to host.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
})

CreateEventModal.displayName = 'CreateEventModal'

const AnalyticsOverview = memo(({ analytics }: { analytics: any }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col gap-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 bg-primary/5 rounded-full -mr-4 -mt-4 group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-center gap-2 text-white/40">
                <Coins size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Total Revenue</span>
            </div>
            <div className="text-2xl font-black text-primary">₱{analytics.totalRevenuePHP.toLocaleString()}</div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">{analytics.totalTibsSpentInEvents.toLocaleString()} Tibs flow</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-white/40">
                <ShieldAlert size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Pending</span>
            </div>
            <div className="text-xl font-black">{analytics.pendingPayments} <span className="text-sm font-bold text-white/40">Receipts</span></div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Awaiting Approval</p>
        </div>
        <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-white/40">
                <Users size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Engagement</span>
            </div>
            <div className="text-xl font-black">{analytics.totalEntries.toLocaleString()} <span className="text-sm font-bold text-white/40">Entries</span></div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">{analytics.avgEntriesPerEvent} per event</p>
        </div>
        <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-white/40">
                <Trophy size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Market Size</span>
            </div>
            <div className="text-xl font-black">{analytics.totalUsers} <span className="text-sm font-bold text-white/40">Members</span></div>
            <div className="text-xl font-black text-primary">{analytics.totalEvents} <span className="text-sm font-bold text-white/40 italic">Live/Past Events</span></div>
        </div>
    </div>
))
AnalyticsOverview.displayName = 'AnalyticsOverview'

const PaymentsList = memo(({ payments, handleApprove, handleReject, isLoadingPayments, fetchPayments }: { payments: any[], handleApprove: (id: string) => void, handleReject: (id: string) => void, isLoadingPayments: boolean, fetchPayments: () => void }) => (
    <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest">Pending Payments</h2>
            <button onClick={fetchPayments} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <Loader2 size={18} className={isLoadingPayments ? "animate-spin" : ""} />
            </button>
        </div>
        <div className="flex flex-col gap-4">
            {payments.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-white/5">
                    <CheckCircle2 className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 font-black uppercase tracking-widest text-xs">All caught up!</p>
                </div>
            ) : (
                payments.map((payment) => (
                    <div key={payment.id} className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-20 h-20 bg-white/5 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => window.open(payment.receipt_url, '_blank')}>
                            <img src={payment.receipt_url} alt="Receipt" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <div className="font-black text-lg">{payment.profiles?.display_name || 'Anonymous'}</div>
                            <div className="text-white/40 text-xs mb-2">{payment.profiles?.email}</div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                                <Coins size={14} className="text-primary" />
                                <span className="text-primary font-black text-xs">{payment.requested_tibs} Tibs</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleApprove(payment.id)} className="px-6 py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs">Approve</button>
                            <button onClick={() => handleReject(payment.id)} className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase tracking-widest rounded-xl text-xs">Reject</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
))
PaymentsList.displayName = 'PaymentsList'

const PayoutsList = memo(({ payouts, handleApprovePayout, isLoadingPayouts, fetchPayoutRequests }: { payouts: any[], handleApprovePayout: (id: string) => void, isLoadingPayouts: boolean, fetchPayoutRequests: () => void }) => (
    <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest">Payout Requests</h2>
            <button onClick={fetchPayoutRequests} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <Loader2 size={18} className={isLoadingPayouts ? "animate-spin" : ""} />
            </button>
        </div>
        <div className="flex flex-col gap-4">
            {payouts.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-white/5">
                    <CheckCircle2 className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 font-black uppercase tracking-widest text-xs">No pending payouts.</p>
                </div>
            ) : (
                payouts.map((payout) => (
                    <div key={payout.id} className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex-1 text-center md:text-left">
                            <div className="font-black text-lg">{payout.profiles?.display_name || 'Anonymous'}</div>
                            <div className="text-white/40 text-xs mb-4">{payout.profiles?.email}</div>
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] uppercase font-black text-white/20 tracking-widest">GCash Details</div>
                                <div className="font-black text-primary text-sm">{payout.gcash_number}</div>
                                <div className="text-xs text-white/60">{payout.gcash_name}</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center md:items-end gap-2">
                            <div className="text-2xl font-black italic">₱{(payout.amount_tibs / 8).toLocaleString()}</div>
                            <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-2">{payout.amount_tibs.toLocaleString()} Tibs</div>
                            <button onClick={() => handleApprovePayout(payout.id)} className="px-8 py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs">Mark as Settled</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
))
PayoutsList.displayName = 'PayoutsList'

export default function AdminDashboard() {
    const { user } = useUser()
    const { userId } = useAuth()
    const { getClient } = useSupabase()
    const [activeTab, setActiveTab] = useState<'events' | 'archives' | 'payments' | 'payouts' | 'analytics'>('events')

    // Permission State
    const [isAdmin, setIsAdmin] = useState(false)
    const [isHostEligible, setIsHostEligible] = useState(false)
    const [totalSpentTib, setTotalSpentTib] = useState(0)
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(true)

    // Payments State
    const [payments, setPayments] = useState<any[]>([])
    const [isLoadingPayments, setIsLoadingPayments] = useState(false)

    // Payouts State
    const [payouts, setPayouts] = useState<any[]>([])
    const [isLoadingPayouts, setIsLoadingPayouts] = useState(false)

    // Manage Events State
    const [existingEvents, setExistingEvents] = useState<any[]>([])
    const [isLoadingEvents, setIsLoadingEvents] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<any>(null)
    const [editingEvent, setEditingEvent] = useState<any>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const [analytics, setAnalytics] = useState<{
        totalUsers: number
        totalEvents: number
        totalEntries: number
        totalTibsSpentInEvents: number
        totalRevenuePHP: number
        avgEntriesPerEvent: number
        pendingPayments: number
    } | null>(null)
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

    // Memoize handlers for child components
    const handleApproveMemo = useCallback(async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        try {
            const { error } = await supabaseClient.rpc('approve_transaction', { p_transaction_id: id, p_admin_id: userId })
            if (error) throw error
            alert('Payment approved and Tibs credited!')
            fetchPayments()
        } catch (error: any) { alert(error.message || 'Error approving payment') }
    }, [userId, getClient])

    const handleRejectMemo = useCallback(async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        try {
            const { error } = await supabaseClient.from('transactions').update({ status: 'rejected' }).eq('id', id)
            if (error) throw error
            alert('Payment rejected.')
            fetchPayments()
        } catch (error: any) { alert(error.message || 'Error rejecting payment') }
    }, [getClient])

    const handleApprovePayoutMemo = useCallback(async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        if (!confirm('Are you sure you have sent the GCash payment?')) return
        try {
            const { data: request } = await supabaseClient.from('payout_requests').select('user_id, amount_tibs').eq('id', id).single()
            if (!request) return
            const { data: profile } = await supabaseClient.from('profiles').select('tibs_balance').eq('id', request.user_id).single()
            if (!profile || profile.tibs_balance < request.amount_tibs) {
                alert('User has insufficient balance to fulfill this payout.')
                return
            }
            await supabaseClient.from('profiles').update({ tibs_balance: profile.tibs_balance - request.amount_tibs }).eq('id', request.user_id)
            await supabaseClient.from('payout_requests').update({ status: 'completed', processed_at: new Date().toISOString(), processed_by: userId }).eq('id', id)
            alert('Payout settled successfully!')
            fetchPayoutRequests()
        } catch (error: any) { alert(error.message || 'Error settling payout') }
    }, [userId, getClient])

    const fetchEventsMemo = useCallback(() => fetchEvents(), [userId])
    const fetchPaymentsMemo = useCallback(() => fetchPayments(), [userId])
    const fetchPayoutRequestsMemo = useCallback(() => fetchPayoutRequests(), [userId])

    const formatDisplayId = (id: string, displayId: string | null) => {
        if (displayId) {
            if (displayId.startsWith('#OLD.')) {
                const parts = displayId.split('.')
                if (parts.length > 1) return `#O-${parts[1].slice(0, 4)}`
            }
            return displayId
        }
        return `#${id.slice(0, 4)}`
    }

    // Check permissions on load
    useEffect(() => {
        const checkPermissions = async () => {
            if (!userId) { setIsCheckingPermissions(false); return }
            const supabaseClient = await getClient()
            if (!supabaseClient) { setIsCheckingPermissions(false); return }
            try {
                const { data: profile } = await supabaseClient.from('profiles').select('is_admin, is_host_eligible, total_tibs_spent').eq('id', userId).single()
                if (profile) {
                    setIsAdmin(profile.is_admin || false)
                    setIsHostEligible(profile.is_host_eligible || false)
                    setTotalSpentTib(profile.total_tibs_spent || 0)
                }
            } catch (err) { console.error('Error checking permissions:', err) }
            finally { setIsCheckingPermissions(false) }
        }
        checkPermissions()
    }, [userId, getClient])

    const fetchEvents = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingEvents(true)
        try {
            const { data, error } = await supabaseClient
                .from('raffles')
                .select(`*, entries:entries!entries_raffle_id_fkey(count), winner:profiles!winner_user_id(display_name, email), winning_entry:entries!raffles_winning_entry_id_fkey(ticket_number)`)
                .order('created_at', { ascending: false })
            if (error) throw error
            setExistingEvents(data || [])
        } catch (error) { console.error('Error fetching events:', error) }
        finally { setIsLoadingEvents(false) }
    }

    const fetchAnalytics = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingAnalytics(true)
        try {
            // Optimization: Use head: true for exact counts without fetching data
            // And only select the column we need for revenue calculation
            const [
                { count: usersCount },
                { data: eventsData },
                { count: entriesCount },
                { data: transactionData },
                { count: pendingCount }
            ] = await Promise.all([
                supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
                supabaseClient.from('raffles').select('entry_cost_tibs, entries:entries!entries_raffle_id_fkey(count)'), // Only fetch cost and entry count
                supabaseClient.from('entries').select('*', { count: 'exact', head: true }),
                supabaseClient.from('transactions').select('requested_tibs').eq('status', 'approved'), // Still necessary to fetch values for sum if no RPC
                supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
            ])

            const totalTibsInEvents = eventsData?.reduce((acc: number, curr: any) => acc + ((curr.entries?.[0]?.count || 0) * (curr.entry_cost_tibs || 0)), 0) || 0
            const totalTibsSold = transactionData?.reduce((acc: number, curr: any) => acc + (Number(curr.requested_tibs) || 0), 0) || 0
            const avgEntries = eventsData && eventsData.length > 0 ? (entriesCount || 0) / eventsData.length : 0

            setAnalytics({
                totalUsers: usersCount || 0,
                totalEvents: eventsData?.length || 0,
                totalEntries: entriesCount || 0,
                totalTibsSpentInEvents: totalTibsInEvents,
                totalRevenuePHP: totalTibsSold / 8,
                avgEntriesPerEvent: Math.round(avgEntries * 10) / 10,
                pendingPayments: pendingCount || 0
            })
        } catch (error) { console.error('Error fetching analytics:', error) }
        finally { setIsLoadingAnalytics(false) }
    }

    const fetchPayments = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingPayments(true)
        try {
            const { data, error } = await supabaseClient.from('transactions').select('*, profiles(email, display_name)').eq('status', 'pending').order('created_at', { ascending: false })
            if (error) throw error
            setPayments(data || [])
        } catch (error) { console.error('Error fetching payments:', error) }
        finally { setIsLoadingPayments(false) }
    }

    const fetchPayoutRequests = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingPayouts(true)
        try {
            const { data, error } = await supabaseClient.from('payout_requests').select('*, profiles(email, display_name)').eq('status', 'pending').order('created_at', { ascending: false })
            if (error) throw error
            setPayouts(data || [])
        } catch (error) { console.error('Error fetching payouts:', error) }
        finally { setIsLoadingPayouts(false) }
    }

    useEffect(() => {
        if (activeTab === 'payouts') fetchPayoutRequests()
        else if (activeTab === 'payments') fetchPayments()
        else if (activeTab === 'events' || activeTab === 'archives') fetchEvents()
        else if (activeTab === 'analytics') fetchAnalytics()
    }, [activeTab, userId])

    const handleDrawWinner = async (eventId: string, eventTitle: string, eventImage: string, currentTibs: number, goalTibs: number) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        if (goalTibs > 0 && currentTibs < goalTibs) {
            alert(`⚠️ GOAL NOT MET: Current progress is ${currentTibs.toLocaleString()} / ${goalTibs.toLocaleString()} TIBS.`)
            return
        }
        if (!confirm('Are you sure you want to draw a winner now?')) return
        try {
            const { data, error } = await supabaseClient.rpc('draw_winner_and_payout', { p_raffle_id: eventId, p_admin_id: userId })
            if (error) throw error
            if (!data.success) throw new Error(data.message)
            const { data: winnerProfile } = await supabaseClient.from('profiles').select('email, display_name').eq('id', data.winner_id).single()
            if (winnerProfile?.email) {
                await fetch('/api/send-winner-email', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: winnerProfile.email, winnerName: winnerProfile.display_name, eventTitle: eventTitle, eventImage: eventImage })
                })
            }
            alert(`Winner drawn! Ticket: ${data.ticket_number || 'Confirmed'}`)
            fetchEvents()
        } catch (error: any) { alert(error.message || 'Error drawing winner.') }
    }

    const handleRefund = async (eventId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        try {
            const { error } = await supabaseClient.rpc('refund_raffle', { p_raffle_id: eventId, p_admin_id: userId })
            if (error) throw error
            alert('Raffle refunded and closed.')
            fetchEvents()
        } catch (error: any) { alert(error.message || 'Error refunding raffle') }
    }

    const handleUpdateEvent = async (eventId: string, updatedData: any, newImages: File[]) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsUpdating(true)
        try {
            let mediaUrls = [...(updatedData.existingMediaUrls || [])]
            if (newImages.length > 0) {
                for (const image of newImages) {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`
                    const { error: uploadError } = await supabaseClient.storage.from('media').upload(filePath, image)
                    if (uploadError) throw uploadError
                    const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(filePath)
                    mediaUrls.push(publicUrl)
                }
            }
            const { error: updateError } = await supabaseClient.from('raffles').update({
                title: updatedData.title, description: updatedData.description, media_urls: mediaUrls,
                entry_cost_tibs: parseInt(updatedData.cost), ends_at: new Date(updatedData.drawTime).toISOString(),
                goal_tibs: parseInt(updatedData.goal) || 0
            }).eq('id', eventId)
            if (updateError) throw updateError
            alert('Event updated successfully!'); setEditingEvent(null); fetchEvents()
        } catch (error: any) { alert(error.message || 'Error updating event.') }
        finally { setIsUpdating(false) }
    }

    const handleDeleteEvent = async (eventId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        if (!confirm('Are you sure you want to delete this event?')) return
        try {
            await supabaseClient.from('entries').delete().eq('raffle_id', eventId)
            const { error } = await supabaseClient.from('raffles').delete().eq('id', eventId)
            if (error) throw error
            alert('Event deleted successfully.'); fetchEvents()
            if (selectedEvent?.id === eventId) setSelectedEvent(null)
        } catch (error: any) { alert(error.message || 'Error deleting event') }
    }

    const EventDetailsModal = memo(({ event, onClose, handleDrawWinner, handleRefund }: { event: any, onClose: () => void, handleDrawWinner: any, handleRefund: any }) => {
        const totalTibs = (event.entries?.[0]?.count || 0) * event.entry_cost_tibs
        const totalPeso = totalTibs / 8
        const goalMet = event.goal_tibs > 0 ? totalTibs >= event.goal_tibs : true
        const progress = event.goal_tibs > 0 ? Math.min((totalTibs / event.goal_tibs) * 100, 100) : 100

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="relative aspect-video w-full bg-white/5">
                        {event.media_urls?.[0] ? (
                            isVideo(event.media_urls[0]) ? <video src={event.media_urls[0]} className="w-full h-full object-cover" controls autoPlay muted loop />
                                : <img src={event.media_urls[0]} alt={event.title} className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center text-white/10"><ImageIcon size={48} /></div>}
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-8 flex flex-col gap-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 block">#{event.display_id || event.id.slice(0, 4)} • {event.status.toUpperCase()}</span>
                                <h3 className="text-2xl font-black tracking-tight">{event.title}</h3>
                            </div>
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 text-xs font-black">{event.entry_cost_tibs} TIBS</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] uppercase font-black text-white/30 mb-1">Total Made</p>
                                <div className="text-xl font-black text-primary">₱{totalPeso.toLocaleString()}</div>
                                <p className="text-[10px] text-white/20">{totalTibs.toLocaleString()} TIBS</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] uppercase font-black text-white/30 mb-1">Participants</p>
                                <div className="text-xl font-black">{event.entries?.[0]?.count || 0}</div>
                                <p className="text-[10px] text-white/20">Entries</p>
                            </div>
                        </div>

                        {event.status === 'drawn' && event.winner && (
                            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-primary">
                                    <Trophy size={18} />
                                    <span className="text-xs font-black uppercase tracking-widest">Official Winner</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-lg font-black">{event.winner.display_name}</div>
                                        <div className="text-[10px] text-white/40 uppercase font-black tracking-widest">{event.winner.email}</div>
                                    </div>
                                    <div className="bg-primary text-black px-3 py-1 rounded-xl text-xs font-black italic">
                                        #{event.winning_entry?.ticket_number || '---'}
                                    </div>
                                </div>
                                {!goalMet && (
                                    <div className="text-[9px] text-red-500 font-black uppercase tracking-widest bg-red-500/10 p-2 rounded-lg text-center border border-red-500/10">
                                        ⚠️ WARNING: This raffle was drawn without meeting the goal.
                                    </div>
                                )}
                            </div>
                        )}

                        {event.goal_tibs > 0 && event.status === 'open' && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className={goalMet ? "text-green-500" : "text-red-500"}>{goalMet ? '✓ Goal Met' : '⚠️ Goal Not Met'}</span>
                                    <span className="text-white/30">{totalTibs.toLocaleString()} / {event.goal_tibs.toLocaleString()} TIBS</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${goalMet ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}
                        <div className="flex gap-3">
                            {event.status === 'open' && (
                                <>
                                    {goalMet ? (
                                        <button onClick={() => { handleDrawWinner(event.id, event.title, event.media_urls?.[0], totalTibs, event.goal_tibs); onClose(); }} className="flex-1 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95">Draw Winner</button>
                                    ) : (
                                        <button onClick={() => { if (confirm('Goal not met. Refund all participants and close event?')) { handleRefund(event.id); onClose(); } }} className="flex-1 py-4 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase tracking-widest rounded-2xl transition-transform active:scale-95">Refund & Close</button>
                                    )}
                                </>
                            )}
                            <button onClick={onClose} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest rounded-2xl transition-all">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    })
    EventDetailsModal.displayName = 'EventDetailsModal'

    const EditEventModal = memo(({ event, onClose, handleUpdateEvent, isUpdating }: { event: any, onClose: () => void, handleUpdateEvent: any, isUpdating: boolean }) => {
        const [editTitle, setEditTitle] = useState(event.title)
        const [editDesc, setEditDesc] = useState(event.description || '')
        const [editCost, setEditCost] = useState(event.entry_cost_tibs.toString())
        const [editGoal, setEditGoal] = useState((event.goal_tibs || 0).toString())
        const [editDrawTime, setEditDrawTime] = useState(new Date(event.ends_at).toISOString().slice(0, 16))
        const [editMediaUrls, setEditMediaUrls] = useState<string[]>(event.media_urls || [])
        const [newFiles, setNewFiles] = useState<File[]>([])
        const [newPreviews, setNewPreviews] = useState<string[]>([])

        useEffect(() => { return () => { newPreviews.forEach(url => URL.revokeObjectURL(url)) } }, [newPreviews])

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h3 className="text-xl font-black tracking-tight">Edit Event</h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-8 flex flex-col gap-6">
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Title</label><input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" /></div>
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs)</label><input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" /></div>
                            <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs)</label><input type="number" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" /></div>
                        </div>
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label><input type="datetime-local" value={editDrawTime} onChange={(e) => setEditDrawTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]" /></div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media Management</label>
                            <div className="grid grid-cols-4 gap-2">
                                {editMediaUrls.map((url, idx) => (
                                    <div key={`old-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                        {isVideo(url) ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} className="w-full h-full object-cover" />}
                                        <button onClick={() => setEditMediaUrls(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} className="text-white" /></button>
                                    </div>
                                ))}
                                {newPreviews.map((preview, idx) => (
                                    <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-primary/20 group">
                                        {isVideo(preview) ? <video src={preview} className="w-full h-full object-cover" /> : <img src={preview} className="w-full h-full object-cover" />}
                                        <button onClick={() => { setNewFiles(prev => prev.filter((_, i) => i !== idx)); setNewPreviews(prev => { const url = prev[idx]; if (url) URL.revokeObjectURL(url); return prev.filter((_, i) => i !== idx) }) }} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} className="text-white" /></button>
                                    </div>
                                ))}
                                <label className="aspect-square bg-white/5 border border-dashed border-white/20 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors"><input type="file" className="hidden" accept="image/*,video/*" multiple onChange={(e) => { const files = Array.from(e.target.files || []); setNewFiles(prev => [...prev, ...files]); const previews = files.map(f => URL.createObjectURL(f)); setNewPreviews(prev => [...prev, ...previews]) }} /><Plus size={24} /></label>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => handleUpdateEvent(event.id, { title: editTitle, description: editDesc, cost: editCost, goal: editGoal, drawTime: editDrawTime, existingMediaUrls: editMediaUrls }, newFiles)} disabled={isUpdating} className="flex-1 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95 disabled:opacity-50">
                                {isUpdating ? 'Updating...' : 'Save Changes'}
                            </button>
                            <button onClick={onClose} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest rounded-2xl transition-all">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    })
    EditEventModal.displayName = 'EditEventModal'
    const AdminEventBar = memo(({
        event,
        isAdmin,
        userId,
        onSelectEvent,
        onEditEvent,
        onDeleteEvent
    }: {
        event: any,
        isAdmin: boolean,
        userId: string | null | undefined,
        onSelectEvent: (e: any) => void,
        onEditEvent: (e: any) => void,
        onDeleteEvent: (id: string) => void
    }) => {
        const [isExpanded, setIsExpanded] = useState(false)
        const entryCount = event.entries?.[0]?.count || 0
        const totalTibs = entryCount * event.entry_cost_tibs
        const goalMet = event.goal_tibs > 0 ? totalTibs >= event.goal_tibs : true
        const progress = event.goal_tibs > 0 ? Math.min((totalTibs / event.goal_tibs) * 100, 100) : 100

        return (
            <div className="bg-card rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
                {/* Bar Header */}
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                    <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 border border-white/5">
                        {event.media_urls?.[0] ? (
                            isVideo(event.media_urls[0]) ? <video src={event.media_urls[0]} className="w-full h-full object-cover" />
                                : <img src={event.media_urls[0]} alt="" className="w-full h-full object-cover" />
                        ) : <ImageIcon className="w-full h-full p-3 text-white/10" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-black text-xs uppercase tracking-tight truncate">{event.title}</h4>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${event.status === 'open' ? 'bg-green-500/10 text-green-500' : 'bg-white/10 text-white/40'
                                }`}>
                                {event.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/20">
                            <span>X{entryCount} ENTRIES</span>
                            <span>•</span>
                            <span className="truncate">{event.display_id || `#${event.id.slice(0, 4)}`}</span>
                            {event.goal_tibs > 0 && (
                                <>
                                    <span>•</span>
                                    <span className={goalMet ? "text-primary" : "text-white/20"}>{Math.round(progress)}% GOAL</span>
                                </>
                            )}
                            {event.status === 'drawn' && event.winner && (
                                <>
                                    <span>•</span>
                                    <span className="text-primary font-black flex items-center gap-1">
                                        <Trophy size={10} /> {event.winner.display_name} (#{event.winning_entry?.ticket_number})
                                    </span>
                                    {!goalMet && (
                                        <span className="text-[8px] bg-red-500/20 text-red-500 px-1 rounded border border-red-500/20 ml-1">UNMET GOAL</span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className={`p-2 rounded-full hover:bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={14} className="text-white/20" />
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-white/[0.01] animate-in slide-in-from-top-2 duration-300">
                        {event.description && (
                            <p className="text-[11px] text-white/40 leading-relaxed whitespace-pre-wrap mb-4 px-2">
                                {event.description}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-2 p-1">
                            <button
                                onClick={() => onSelectEvent(event)}
                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95"
                            >
                                Details
                            </button>
                            {event.status === 'open' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEditEvent(event); }}
                                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95"
                                >
                                    Edit
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all active:scale-95"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    })
    AdminEventBar.displayName = 'AdminEventBar'

    const ExistingEventsSection = memo(({
        activeTab,
        existingEvents,
        userId,
        isAdmin,
        isLoadingEvents,
        fetchEvents,
        onSelectEvent,
        onEditEvent,
        onDeleteEvent
    }: {
        activeTab: string,
        existingEvents: any[],
        userId: string | null | undefined,
        isAdmin: boolean,
        isLoadingEvents: boolean,
        fetchEvents: () => void,
        onSelectEvent: (e: any) => void,
        onEditEvent: (e: any) => void,
        onDeleteEvent: (id: string) => void
    }) => {
        const [dateFilter, setDateFilter] = useState('')
        const deferredDateFilter = React.useDeferredValue(dateFilter)

        const filteredEvents = React.useMemo(() => {
            return existingEvents.filter(e => {
                const matchesTab = activeTab === 'events' ? e.status === 'open' : (e.status === 'drawn' || e.status === 'closed');
                const matchesDate = deferredDateFilter ? e.created_at.startsWith(deferredDateFilter) : true;
                const matchesUser = isAdmin ? true : e.host_user_id === userId;
                return matchesTab && matchesDate && matchesUser;
            });
        }, [existingEvents, activeTab, deferredDateFilter, isAdmin, userId]);

        return (
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-white/5">
                        <Calendar size={14} className="ml-2 text-white/20" />
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 px-2 py-1.5 [color-scheme:dark]"
                        />
                        {dateFilter && (
                            <button onClick={() => setDateFilter('')} className="p-1 hover:bg-white/5 rounded-full mr-1 transition-colors">
                                <X size={12} className="text-white/40" />
                            </button>
                        )}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/20">
                        {filteredEvents.length} Events Found
                    </div>
                </div>

                {isLoadingEvents ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing Database...</span>
                    </div>
                ) : filteredEvents.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {filteredEvents.map((event) => (
                            <AdminEventBar
                                key={event.id}
                                event={event}
                                isAdmin={isAdmin}
                                userId={userId}
                                onSelectEvent={onSelectEvent}
                                onEditEvent={onEditEvent}
                                onDeleteEvent={onDeleteEvent}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-card rounded-3xl border border-dashed border-white/5">
                        <span className="text-sm font-bold text-white/20 uppercase tracking-widest">No Events Found</span>
                    </div>
                )}
            </div>
        )
    })

    ExistingEventsSection.displayName = 'ExistingEventsSection'

    if (isCheckingPermissions) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/20">Checking Permissions...</p>
            </div>
        </div>
    )

    if (!isAdmin && !isHostEligible) return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="bg-card w-full max-w-md p-10 rounded-[40px] border border-white/5 text-center flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto border border-primary/20">
                    <ShieldAlert size={40} className="text-primary" />
                </div>
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black tracking-tight">Access Denied</h2>
                    <p className="text-white/40 text-sm leading-relaxed">You do not have permission to access the administration panel.</p>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Requirements</p>
                        <p className="text-xs text-white/60 leading-relaxed">
                            You have already spent {totalSpentTib.toLocaleString()} tibs! {Math.max(0, threshold - totalSpentTib).toLocaleString()} more to go to be able to host! Keep trying your luck!
                        </p>
                    </div>
                    <button onClick={() => window.location.href = '/'} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl transition-all border border-white/10">Back to Home</button>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-background text-sm -mx-6">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-3">
                <div className="max-w-3xl mx-auto flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Admin Terminal</span>
                            <div className="w-1 h-1 rounded-full bg-green-500/50 animate-pulse" />
                        </div>
                        {(activeTab === 'events' || activeTab === 'archives') && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary/30 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <Plus size={12} /> Create Event
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-2 px-2">
                        {(['events', 'archives', 'payments', 'payouts', 'analytics'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto py-8 pb-32">
                {/* Content */}
                {activeTab === 'analytics' ? (
                    <div className="flex flex-col gap-10">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">Platform Analytics</h2>
                            <button onClick={fetchAnalytics} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-colors"><Loader2 size={14} className={isLoadingAnalytics ? "animate-spin" : ""} /> Refresh Data</button>
                        </div>
                        {analytics ? <AnalyticsOverview analytics={analytics} /> : null}
                    </div>
                ) : (activeTab === 'events' || activeTab === 'archives') ? (
                    <div className="flex flex-col gap-10">
                        {isCreateModalOpen && (
                            <CreateEventModal
                                isAdmin={isAdmin}
                                isHostEligible={isHostEligible}
                                onLaunch={fetchEventsMemo}
                                getClient={getClient}
                                userId={userId}
                                existingEventsCount={existingEvents?.length || 0}
                                onClose={() => setIsCreateModalOpen(false)}
                            />
                        )}
                        <ExistingEventsSection
                            activeTab={activeTab}
                            existingEvents={existingEvents}
                            userId={userId}
                            isAdmin={isAdmin}
                            isLoadingEvents={isLoadingEvents}
                            fetchEvents={fetchEventsMemo}
                            onSelectEvent={setSelectedEvent}
                            onEditEvent={setEditingEvent}
                            onDeleteEvent={handleDeleteEvent}
                        />
                    </div>
                ) : activeTab === 'payments' ? (
                    <PaymentsList payments={payments} handleApprove={handleApproveMemo} handleReject={handleRejectMemo} isLoadingPayments={isLoadingPayments} fetchPayments={fetchPaymentsMemo} />
                ) : activeTab === 'payouts' ? (
                    <PayoutsList payouts={payouts} handleApprovePayout={handleApprovePayoutMemo} isLoadingPayouts={isLoadingPayouts} fetchPayoutRequests={fetchPayoutRequestsMemo} />
                ) : null}
            </div>

            {selectedEvent && <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} handleDrawWinner={handleDrawWinner} handleRefund={handleRefund} />}
            {editingEvent && <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} handleUpdateEvent={handleUpdateEvent} isUpdating={isUpdating} />}
        </div>
    )
}

