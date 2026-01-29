"use client"

import React, { useState, useEffect } from 'react'
import { Plus, Check, X, LayoutDashboard, Loader2, CheckCircle2, Trophy, ShieldAlert, BarChart3, Users, Ticket, Coins, Image as ImageIcon, Edit, Trash2 } from 'lucide-react'
import { useUser, useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

export default function AdminDashboard() {
    const { user } = useUser()
    const { userId } = useAuth()
    const { getClient } = useSupabase()
    const [activeTab, setActiveTab] = useState<'events' | 'archives' | 'payments' | 'payouts' | 'analytics'>('events')
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
    const [goal, setGoal] = useState('')
    const [drawTime, setDrawTime] = useState('')

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
    const [dateFilter, setDateFilter] = useState('')

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

    const formatDisplayId = (id: string, displayId: string | null) => {
        if (displayId) {
            if (displayId.startsWith('#OLD.')) {
                // Shorten UUID from #OLD.uuid-format to #O-uuidShort
                const parts = displayId.split('.')
                if (parts.length > 1) {
                    return `#O-${parts[1].slice(0, 4)}`
                }
            }
            return displayId
        }
        return `#${id.slice(0, 4)}`
    }

    const isVideo = (url: string) => {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
        return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.startsWith('data:video/')
    }

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
                .select(`
                    *,
                    entries:entries!entries_raffle_id_fkey(count),
                    winner:profiles!winner_user_id(display_name, email),
                    winning_entry:entries!raffles_winning_entry_id_fkey(ticket_number)
                `)
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
                { data: eventsData },
                { count: entriesCount },
                { data: transactionData },
                { count: pendingCount }
            ] = await Promise.all([
                supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
                supabaseClient.from('raffles').select('*, entries:entries!entries_raffle_id_fkey(count)'),
                supabaseClient.from('entries').select('*', { count: 'exact', head: true }),
                supabaseClient.from('transactions').select('requested_tibs').eq('status', 'approved'),
                supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
            ])

            // Calculate Tibs Spent in Events
            const totalTibsInEvents = eventsData?.reduce((acc: number, curr: any) => {
                const count = curr.entries?.[0]?.count || 0
                return acc + (count * curr.entry_cost_tibs)
            }, 0) || 0

            const totalTibsSold = transactionData?.reduce((acc: number, curr: any) => acc + (Number(curr.requested_tibs) || 0), 0) || 0
            const totalRevenue = totalTibsSold / 8
            const avgEntries = eventsData && eventsData.length > 0 ? (entriesCount || 0) / eventsData.length : 0

            setAnalytics({
                totalUsers: usersCount || 0,
                totalEvents: eventsData?.length || 0,
                totalEntries: entriesCount || 0,
                totalTibsSpentInEvents: totalTibsInEvents,
                totalRevenuePHP: totalRevenue,
                avgEntriesPerEvent: Math.round(avgEntries * 10) / 10,
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

    const fetchPayoutRequests = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoadingPayouts(true)
        try {
            const { data, error } = await supabaseClient
                .from('payout_requests')
                .select('*, profiles(email, display_name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            setPayouts(data || [])
        } catch (error) {
            console.error('Error fetching payouts:', error)
        } finally {
            setIsLoadingPayouts(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'payouts') {
            fetchPayoutRequests()
        } else if (activeTab === 'payments') {
            fetchPayments()
        } else if (activeTab === 'events' || activeTab === 'archives') {
            fetchEvents()
        } else if (activeTab === 'analytics') {
            fetchAnalytics()
        }
    }, [activeTab, userId])

    const handleDrawWinner = async (eventId: string, eventTitle: string, eventImage: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!confirm('Are you sure you want to draw a winner now? This will also transfer the pot (minus fees) to the host.')) return

        try {
            // CRITICAL: Using draw_winner_and_payout - the ONLY working function in the database
            const { data, error } = await supabaseClient.rpc('draw_winner_and_payout', {
                p_raffle_id: eventId,
                p_admin_id: userId
            })

            if (error) throw error
            if (!data.success) throw new Error(data.message)

            // Get winner profile for email
            const { data: winnerProfile } = await supabaseClient
                .from('profiles')
                .select('email, display_name')
                .eq('id', data.winner_id)
                .single()

            // Send winner email
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

            alert(`Winner drawn! Ticket: ${data.ticket_number || 'Confirmed'}`)

            // Sync UI instantly
            if (selectedEvent && selectedEvent.id === eventId) {
                setSelectedEvent((prev: any) => prev ? {
                    ...prev,
                    status: 'drawn',
                    winner: winnerProfile,
                    winning_entry: { ticket_number: data.ticket_number },
                    drawn_at: new Date().toISOString()
                } : null)
            }

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

    const handleApprovePayout = async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!confirm('Are you sure you have sent the GCash payment? This will finalize the settlement.')) return

        try {
            const { data: request } = await supabaseClient
                .from('payout_requests')
                .select('user_id, amount_tibs')
                .eq('id', id)
                .single()

            if (!request) return

            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('tibs_balance')
                .eq('id', request.user_id)
                .single()

            if (!profile || profile.tibs_balance < request.amount_tibs) {
                alert('User has insufficient balance to fulfill this payout.')
                return
            }

            // Deduct balance and update request
            await supabaseClient.from('profiles').update({
                tibs_balance: profile.tibs_balance - request.amount_tibs
            }).eq('id', request.user_id)

            await supabaseClient.from('payout_requests').update({
                status: 'completed',
                processed_at: new Date().toISOString(),
                processed_by: userId
            }).eq('id', id)

            alert('Payout settled successfully!')
            fetchPayoutRequests()
        } catch (error: any) {
            alert(error.message || 'Error settling payout')
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

            // 2. Generate Display ID
            const date = new Date()
            const monthLetter = date.toLocaleString('default', { month: 'short' })[0].toUpperCase()
            const yearShort = date.getFullYear().toString().slice(-2)
            const eventCount = (existingEvents?.length || 0) + 1
            const displayId = `#${monthLetter}${yearShort}.${eventCount}`

            // 3. Insert Event into Database
            const insertPayload: any = {
                title,
                description,
                entry_cost_tibs: parseInt(cost),
                ends_at: new Date(drawTime).toISOString(),
                media_urls: mediaUrls,
                host_user_id: userId,
                status: 'open'
            }

            // Only add these columns if they exist (or use try/catch)
            // But better to just include them and handle the potential error gracefully
            insertPayload.goal_tibs = parseInt(goal) || 0
            insertPayload.display_id = displayId

            const { error: insertError } = await supabaseClient
                .from('raffles')
                .insert([insertPayload])

            if (insertError) throw insertError

            alert('Event launched successfully!')
            // Reset form
            setTitle('')
            setDescription('')
            setCost('')
            setGoal('')
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

    const EventDetailsModal = ({ event, onClose }: { event: any, onClose: () => void }) => {
        const totalTibs = (event.entries?.[0]?.count || 0) * event.entry_cost_tibs
        const totalPeso = totalTibs / 8
        const goalMet = event.goal_tibs > 0 ? totalTibs >= event.goal_tibs : true
        const progress = event.goal_tibs > 0 ? Math.min((totalTibs / event.goal_tibs) * 100, 100) : 100

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="relative aspect-video w-full bg-white/5">
                        {event.media_urls?.[0] ? (
                            isVideo(event.media_urls[0]) ? (
                                <video src={event.media_urls[0]} className="w-full h-full object-cover" controls autoPlay muted loop />
                            ) : (
                                <img src={event.media_urls[0]} alt={event.title} className="w-full h-full object-cover" />
                            )
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10">
                                <ImageIcon size={48} />
                            </div>
                        )}
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-8 flex flex-col gap-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 block">
                                    {formatDisplayId(event.id, event.display_id)} • {event.status.toUpperCase()}
                                </span>
                                <h3 className="text-2xl font-black tracking-tight">{event.title}</h3>
                            </div>
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 text-xs font-black">
                                {event.entry_cost_tibs} TIBS
                            </div>
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

                        {event.goal_tibs > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className={goalMet ? "text-green-500" : "text-white/30"}>
                                        Goal: {goalMet ? 'MET' : 'IN PROGRESS'}
                                    </span>
                                    <span className="text-white/30">{totalTibs.toLocaleString()} / {event.goal_tibs.toLocaleString()} TIBS</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {event.status === 'drawn' && (
                            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-2xl flex flex-col gap-1">
                                <span className="text-[10px] font-black text-green-500/60 uppercase tracking-widest">🏆 Winner Drawn</span>
                                <div className="flex flex-col gap-0.5 mt-1">
                                    <div className="font-bold text-sm text-white">{event.winner?.display_name || 'Unknown Winner'}</div>
                                    <div className="text-[10px] text-white/40">{event.winner?.email || 'No email available'}</div>
                                    {event.winning_entry?.ticket_number && (
                                        <div className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Ticket # {event.winning_entry.ticket_number}</div>
                                    )}
                                </div>
                                <div className="text-[10px] text-white/40 mt-2 italic">Drawn at {new Date(event.drawn_at).toLocaleString()}</div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            {event.status === 'open' && (
                                <>
                                    {goalMet ? (
                                        <button
                                            onClick={() => { handleDrawWinner(event.id, event.title, event.media_urls?.[0]); onClose(); }}
                                            className="flex-1 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95"
                                        >
                                            Draw Winner
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { if (confirm('Goal not met. Refund all participants and close event?')) { handleRefund(event.id); onClose(); } }}
                                            className="flex-1 py-4 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase tracking-widest rounded-2xl transition-transform active:scale-95"
                                        >
                                            Refund & Close
                                        </button>
                                    )}
                                </>
                            )}
                            <button onClick={onClose} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest rounded-2xl transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const handleUpdateEvent = async (eventId: string, updatedData: any, newImages: File[]) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsUpdating(true)
        try {
            let mediaUrls = [...(updatedData.existingMediaUrls || [])]

            // 1. Upload new images if any
            if (newImages.length > 0) {
                for (const image of newImages) {
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

            // 2. Update raffle record
            const { error: updateError } = await supabaseClient
                .from('raffles')
                .update({
                    title: updatedData.title,
                    description: updatedData.description,
                    media_urls: mediaUrls,
                    entry_cost_tibs: parseInt(updatedData.cost),
                    ends_at: new Date(updatedData.drawTime).toISOString(),
                    goal_tibs: parseInt(updatedData.goal) || 0
                })
                .eq('id', eventId)

            if (updateError) throw updateError

            alert('Event updated successfully!')
            setEditingEvent(null)
            fetchEvents()
        } catch (error: any) {
            console.error('Error updating event:', error)
            alert(error.message || 'Error updating event.')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteEvent = async (eventId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!confirm('Are you sure you want to delete this event? This will also delete all entries associated with it.')) return

        try {
            await supabaseClient.from('entries').delete().eq('raffle_id', eventId)
            const { error } = await supabaseClient.from('raffles').delete().eq('id', eventId)

            if (error) throw error

            alert('Event deleted successfully.')
            fetchEvents()
            if (selectedEvent?.id === eventId) setSelectedEvent(null)
        } catch (error: any) {
            alert(error.message || 'Error deleting event')
        }
    }

    const EditEventModal = ({ event, onClose }: { event: any, onClose: () => void }) => {
        const [editTitle, setEditTitle] = useState(event.title)
        const [editDesc, setEditDesc] = useState(event.description || '')
        const [editCost, setEditCost] = useState(event.entry_cost_tibs.toString())
        const [editGoal, setEditGoal] = useState((event.goal_tibs || 0).toString())
        const [editDrawTime, setEditDrawTime] = useState(new Date(event.ends_at).toISOString().slice(0, 16))
        const [editMediaUrls, setEditMediaUrls] = useState<string[]>(event.media_urls || [])
        const [newFiles, setNewFiles] = useState<File[]>([])
        const [newPreviews, setNewPreviews] = useState<string[]>([])

        const handleNewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files
            if (files && files.length > 0) {
                const addedFiles = Array.from(files)
                setNewFiles(prev => [...prev, ...addedFiles])
                const addedPreviews = addedFiles.map(file => URL.createObjectURL(file))
                setNewPreviews(prev => [...prev, ...addedPreviews])
            }
        }

        const removeExistingMedia = (index: number) => {
            setEditMediaUrls(prev => prev.filter((_, i) => i !== index))
        }

        const removeNewMedia = (index: number) => {
            setNewFiles(prev => prev.filter((_, i) => i !== index))
            setNewPreviews(prev => prev.filter((_, i) => i !== index))
        }

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h3 className="text-xl font-black tracking-tight">Edit Event</h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-8 flex flex-col gap-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Title</label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label>
                            <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs)</label>
                                <input
                                    type="number"
                                    value={editCost}
                                    onChange={(e) => setEditCost(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs)</label>
                                <input
                                    type="number"
                                    value={editGoal}
                                    onChange={(e) => setEditGoal(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label>
                            <input
                                type="datetime-local"
                                value={editDrawTime}
                                onChange={(e) => setEditDrawTime(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media Management</label>
                            <div className="grid grid-cols-4 gap-2">
                                {/* Existing Media */}
                                {editMediaUrls.map((url, idx) => (
                                    <div key={`old-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                        {isVideo(url) ? (
                                            <video src={url} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={url} className="w-full h-full object-cover" />
                                        )}
                                        <button
                                            onClick={() => removeExistingMedia(idx)}
                                            className="absolute inset-0 bg-red-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} className="text-white" />
                                        </button>
                                    </div>
                                ))}
                                {/* New Media Previews */}
                                {newPreviews.map((preview, idx) => (
                                    <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-primary/20 group">
                                        {isVideo(preview) ? (
                                            <video src={preview} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={preview} className="w-full h-full object-cover" />
                                        )}
                                        <button
                                            onClick={() => removeNewMedia(idx)}
                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={16} className="text-white" />
                                        </button>
                                        <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                                    </div>
                                ))}
                                {/* Add More Button */}
                                <label className="aspect-square bg-white/5 border border-white/10 border-dashed rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors group">
                                    <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleNewFileChange} />
                                    <Plus size={18} />
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={() => handleUpdateEvent(event.id, {
                                title: editTitle,
                                description: editDesc,
                                cost: editCost,
                                goal: editGoal,
                                drawTime: editDrawTime,
                                existingMediaUrls: editMediaUrls
                            }, newFiles)}
                            disabled={isUpdating}
                            className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isUpdating && <Loader2 size={18} className="animate-spin" />}
                            {isUpdating ? 'Updating...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const handleRefund = async (eventId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            // 1. Get all entries
            const { data: entries, error: fetchError } = await supabaseClient
                .from('entries')
                .select('user_id, raffles!raffle_id(entry_cost_tibs)')
                .eq('raffle_id', eventId)

            if (fetchError) throw fetchError

            // 2. Process refunds (In a real app, this should be an RPC to ensure atomicity)
            // But for now we'll do it manually since it's a small app
            for (const entry of entries || []) {
                const cost = (entry.raffles as any).entry_cost_tibs
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('tibs_balance')
                    .eq('id', entry.user_id)
                    .single()

                if (profile) {
                    await supabaseClient
                        .from('profiles')
                        .update({ tibs_balance: profile.tibs_balance + cost })
                        .eq('id', entry.user_id)
                }
            }

            // 3. Close raffle as 'closed' (not drawn)
            await supabaseClient
                .from('raffles')
                .update({ status: 'closed' })
                .eq('id', eventId)

            alert('Event closed and Tibs refunded successfully.')
            fetchEvents()
        } catch (error: any) {
            console.error('Refund error:', error)
            alert('Error processing refunds: ' + error.message)
        }
    }
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

            {/* Admin Tabs */}
            <div className="flex bg-card p-1.5 rounded-2xl border border-white/5">
                <button
                    onClick={() => setActiveTab('events')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'events' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                >
                    Active
                </button>
                <button
                    onClick={() => setActiveTab('archives')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'archives' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                >
                    Archive
                </button>
                {isAdmin && (
                    <>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'payments' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Payments
                        </button>
                        <button
                            onClick={() => setActiveTab('payouts')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'payouts' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Payouts
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Stats
                        </button>
                    </>
                )}
            </div>

            {
                activeTab === 'analytics' ? (
                    <div className="flex flex-col gap-6">
                        {isLoadingAnalytics ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="animate-spin text-primary" size={32} />
                            </div>
                        ) : analytics ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Coins size={18} />
                                        <span className="text-xs font-bold uppercase tracking-widest">Gross Revenue</span>
                                    </div>
                                    <div className="text-3xl font-black text-primary">₱{analytics.totalRevenuePHP.toLocaleString()}</div>
                                    <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Total from Tibs Sales</p>
                                </div>
                                <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-white/40">
                                        <Ticket size={18} />
                                        <span className="text-xs font-bold uppercase tracking-widest">Event Volume</span>
                                    </div>
                                    <div className="text-3xl font-black">{analytics.totalTibsSpentInEvents.toLocaleString()}</div>
                                    <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Tibs spent in events</p>
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
                        ) : null}
                    </div>
                ) : (activeTab === 'events' || activeTab === 'archives') ? (
                    <div className="flex flex-col gap-10">
                        {/* Create Event Card - ONLY SHOW ON "ACTIVE" TAB */}
                        {activeTab === 'events' && (
                            <div className="bg-card p-8 rounded-3xl border border-dashed border-primary/30 flex flex-col gap-6">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Plus className="text-primary" size={20} />
                                    New Event
                                </h3>
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1.5" >
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
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs)</label>
                                            <input
                                                type="number"
                                                value={goal}
                                                onChange={(e) => setGoal(e.target.value)}
                                                placeholder="5000"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5 col-span-2">
                                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media (Multiple allowed)</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {eventPreviews.map((preview: string, index: number) => (
                                                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                                        {isVideo(preview) ? (
                                                            <video src={preview} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setEventImages(prev => prev.filter((_, i) => i !== index))
                                                                setEventPreviews(prev => prev.filter((_, i) => i !== index))
                                                            }}
                                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={14} className="text-white" />
                                                        </button>
                                                    </div>
                                                ))}

                                                <label className="aspect-square bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors group">
                                                    <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={(e) => {
                                                        const files = Array.from(e.target.files || [])
                                                        setEventImages(prev => [...prev, ...files])
                                                        const previews = files.map(f => URL.createObjectURL(f))
                                                        setEventPreviews(prev => [...prev, ...previews])
                                                    }} />
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
                        )}

                        {/* Events List Wrapper */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-lg font-bold">
                                    {activeTab === 'archives' ? 'Event Archives' : 'Manage Active Events'}
                                </h3>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 focus:outline-none focus:border-primary [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {isLoadingEvents ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="animate-spin text-primary" size={24} />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {existingEvents
                                        .filter((e: any) => {
                                            const isMyEvent = isAdmin || e.host_user_id === userId;
                                            if (!isMyEvent) return false;

                                            // Filter by status based on tab
                                            if (activeTab === 'archives') return e.status !== 'open';
                                            return e.status === 'open';
                                        })
                                        .filter((e: any) => !dateFilter || e.created_at.startsWith(dateFilter))
                                        .length === 0 ? (
                                        <p className="text-white/20 text-center py-10 text-sm font-bold uppercase tracking-widest">
                                            {activeTab === 'archives' ? 'No archived events found.' : 'No active events.'}
                                        </p>
                                    ) : (
                                        existingEvents
                                            .filter((e: any) => {
                                                const isMyEvent = isAdmin || e.host_user_id === userId;
                                                if (!isMyEvent) return false;
                                                if (activeTab === 'archives') return e.status !== 'open';
                                                return e.status === 'open';
                                            })
                                            .filter((e: any) => !dateFilter || e.created_at.startsWith(dateFilter))
                                            .map((event: any) => (
                                                <div
                                                    key={event.id}
                                                    onClick={() => setSelectedEvent(event)}
                                                    className="bg-card p-5 rounded-3xl border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors group"
                                                >
                                                    <div className="w-16 h-16 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10 group-hover:border-primary/30 transition-colors">
                                                        <img src={event.media_urls?.[0] || 'https://via.placeholder.com/150'} alt="event" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                                    {formatDisplayId(event.id, event.display_id)}
                                                                </span>
                                                                <h4 className="font-bold text-sm truncate">{event.title}</h4>
                                                            </div>
                                                            {event.status !== 'open' && (
                                                                <span className="text-[9px] font-black bg-white/5 text-white/40 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-tighter">
                                                                    {event.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                                                {event.entries?.[0]?.count || 0} Entries
                                                            </p>
                                                            <span className="text-white/10">•</span>
                                                            {event.status === 'drawn' ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                                                        <Trophy size={10} className="text-green-500" />
                                                                    </div>
                                                                    <p className="text-green-500/60 text-[10px] font-bold truncate max-w-[120px]">
                                                                        {event.winner?.display_name || 'Winner Drawn'}
                                                                        {event.winning_entry?.ticket_number && (
                                                                            <span className="ml-1.5 px-1 bg-green-500/10 rounded group-hover:bg-green-500/20 transition-colors">
                                                                                #{event.winning_entry.ticket_number}
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                                                    {new Date(event.created_at).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingEvent(event); }}
                                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-primary transition-all"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-red-500 transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedEvent && <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
                        {editingEvent && <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} />}
                    </div>
                ) : activeTab === 'payouts' ? (
                    <div className="flex flex-col gap-4">
                        {isLoadingPayouts ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="animate-spin text-primary" size={32} />
                            </div>
                        ) : payouts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4 bg-card rounded-3xl border border-white/5">
                                <CheckCircle2 size={48} />
                                <p className="font-bold">No pending payouts!</p>
                            </div>
                        ) : (
                            payouts.map((pmt: any) => (
                                <div key={pmt.id} className="bg-card p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                                        <Ticket size={24} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className="font-bold text-sm truncate">{pmt.profiles?.display_name || 'Guest User'}</h4>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white text-xs font-black">₱{(pmt.amount_tibs / 8).toLocaleString()}</p>
                                            <span className="text-white/20 text-[10px]">•</span>
                                            <p className="text-primary text-[10px] font-black uppercase tracking-widest">{pmt.amount_tibs.toLocaleString()} Tibs</p>
                                        </div>
                                        <div className="mt-1 flex flex-col gap-0.5">
                                            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.1em]">{pmt.gcash_name}</p>
                                            <p className="text-[10px] text-primary font-bold">{pmt.gcash_number}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprovePayout(pmt.id)}
                                            className="px-4 py-3 bg-green-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-400 transition-all flex items-center gap-2"
                                        >
                                            <Check size={14} /> Settle
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
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
                )
            }

            {/* Event Details Modal */}
            {
                selectedEvent && (
                    <EventDetailsModal
                        event={selectedEvent}
                        onClose={() => setSelectedEvent(null)}
                    />
                )
            }
        </div >
    )
}
