"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, LayoutDashboard } from 'lucide-react'
import { useUser, useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useToast } from '@/components/Toast'

// Extracted Components
import { CreateEventModal } from './components/CreateEventModal'
import { AnalyticsOverview } from './components/AnalyticsOverview'
import { PaymentsList } from './components/PaymentsList'
import { CampaignsManager } from './components/CampaignsManager'
import { KYCList } from './components/KYCList'
import { PayoutsList } from './components/PayoutsList'
import { EventDetailsModal } from './components/EventDetailsModal'
import { EditEventModal } from './components/EditEventModal'
import { ExistingEventsSection } from './components/ExistingEventsSection'

export default function AdminDashboard({ initialSearchQuery = '' }: { initialSearchQuery?: string }) {
    const { showToast } = useToast()
    const { user: clerkUser } = useUser()
    const { userId } = useAuth()
    const { getClient } = useSupabase()
    const [activeTab, setActiveTab] = useState<'events' | 'archives' | 'campaigns' | 'payments' | 'payouts' | 'kyc' | 'analytics'>('events')

    // Permission State
    const [isAdmin, setIsAdmin] = useState(false)
    const [isHostEligible, setIsHostEligible] = useState(false)
    const [kycStatus, setKycStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified')
    const [totalSpentTib, setTotalSpentTib] = useState(0)
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(true)

    // Payments State
    const [payments, setPayments] = useState<any[]>([])
    const [isLoadingPayments, setIsLoadingPayments] = useState(false)

    // Payouts State
    const [payouts, setPayouts] = useState<any[]>([])
    const [isLoadingPayouts, setIsLoadingPayouts] = useState(false)

    // KYC State
    const [kycRequests, setKycRequests] = useState<any[]>([])
    const [isLoadingKYC, setIsLoadingKYC] = useState(false)

    // Campaigns State
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)

    // Unread Notifications State (Red Dot Logic)
    const [unreadNotifications, setUnreadNotifications] = useState<Record<string, number>>({})

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
        pendingPayoutRequests: number
        pendingKYCRequests: number
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
            fetchAnalytics()
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
            fetchAnalytics()
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
            fetchAnalytics()
        } catch (error: any) { alert(error.message || 'Error settling payout') }
    }, [userId, getClient])

    const fetchEventsMemo = useCallback(() => fetchEvents(), [userId])
    const fetchPaymentsMemo = useCallback(() => fetchPayments(), [userId])
    const fetchPayoutRequestsMemo = useCallback(() => fetchPayoutRequests(), [userId])
    const fetchCampaignsMemo = useCallback(() => fetchCampaigns(), [userId])

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

                    // Also check KYC status
                    const { data: kycData } = await supabaseClient
                        .from('kyc_requests')
                        .select('status')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()
                    if (kycData) setKycStatus(kycData.status as any)
                }
            } catch (err) { console.error('Error checking permissions:', err) }
            finally { setIsCheckingPermissions(false) }
        }
        checkPermissions()
    }, [userId, getClient])

    // Consolidate all fetching into one effect
    useEffect(() => {
        if (!userId) return

        // Always fetch analytics for badges
        fetchAnalytics()
        fetchUnreadNotifications()

        // Tab-specific fetching
        if (activeTab === 'events' || activeTab === 'archives') {
            fetchEvents()
            fetchCampaigns()
        }
        else if (activeTab === 'payments') fetchPayments()
        else if (activeTab === 'payouts') fetchPayoutRequests()
        else if (activeTab === 'kyc' && isAdmin) fetchKYCRequests()
        else if (activeTab === 'campaigns') fetchCampaigns()
    }, [activeTab, userId, isAdmin]) // Re-fetch if permissions change

    const fetchEvents = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingEvents(true)
        try {
            const { data, error } = await supabaseClient
                .from('raffles')
                .select(`*, host:profiles!host_user_id(display_name, avatar_url, is_host_eligible), entries:entries!entries_raffle_id_fkey(count), winner:profiles!winner_user_id(display_name, email), winning_entry:entries!raffles_winning_entry_id_fkey(ticket_number)`)
                .order('created_at', { ascending: false })
                .limit(100)
            if (error) throw error
            setExistingEvents(data || [])
        } catch (error) { console.error('Error fetching events:', error) }
        finally { setIsLoadingEvents(false) }
    }

    const fetchCampaigns = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) return
        setIsLoadingCampaigns(true)
        setFetchError(null)
        try {
            let query = supabaseClient
                .from('campaigns')
                .select('*, host:profiles!campaigns_host_user_id_fkey(display_name, email), campaign_codes(count)')

            // Filter for host's own campaigns if not admin
            if (!isAdmin) {
                query = query.eq('host_user_id', userId)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })

            if (error) throw error
            setCampaigns(data || [])
        } catch (error: any) {
            console.error('Error fetching campaigns:', error)
            setFetchError(error.message || 'Failed to load campaigns')
        } finally {
            setIsLoadingCampaigns(false)
        }
    }

    const fetchAnalytics = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingAnalytics(true)
        try {
            // Optimization: Use head: true for exact counts without fetching data
            // And only select the column we need for revenue calculation
            const entriesQuery = supabaseClient.from('entries').select('*', { count: 'exact', head: true })
            const pendingPaymentsQuery = supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
            const pendingPayoutsQuery = supabaseClient.from('payout_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
            const rafflesQuery = supabaseClient.from('raffles').select('entry_cost_tibs, id, entries:entries!entries_raffle_id_fkey(count)').limit(500)
            const revenueQuery = supabaseClient.from('transactions').select('requested_tibs').eq('status', 'approved').limit(1000)

            if (!isAdmin) {
                rafflesQuery.eq('host_user_id', userId)
                revenueQuery.eq('user_id', userId)
                pendingPaymentsQuery.eq('user_id', userId)
                pendingPayoutsQuery.eq('user_id', userId)
            }

            const [
                { count: usersCount },
                { data: eventsData },
                { count: entriesCount },
                { data: revenueData },
                { count: pendingPaymentsCount },
                { count: pendingPayoutsCount },
                { count: kycPendingCount }
            ] = await Promise.all([
                supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
                rafflesQuery,
                entriesQuery,
                revenueQuery,
                pendingPaymentsQuery,
                pendingPayoutsQuery,
                isAdmin ? supabaseClient.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending') : { count: 0 }
            ])

            const entriesCountCalculated = eventsData?.reduce((acc: number, curr: any) => acc + (curr.entries?.[0]?.count || 0), 0) || 0
            const totalTibsInEvents = eventsData?.reduce((acc: number, curr: any) => acc + ((curr.entries?.[0]?.count || 0) * (curr.entry_cost_tibs || 0)), 0) || 0
            const totalTibsSold = revenueData?.reduce((acc: number, curr: any) => acc + (Number(curr.requested_tibs) || 0), 0) || 0
            const avgEntries = eventsData && eventsData.length > 0 ? entriesCountCalculated / eventsData.length : 0

            setAnalytics({
                totalUsers: usersCount || 0,
                totalEvents: eventsData?.length || 0,
                totalEntries: entriesCountCalculated,
                totalTibsSpentInEvents: totalTibsInEvents,
                totalRevenuePHP: totalTibsSold / 8,
                avgEntriesPerEvent: Math.round(avgEntries * 10) / 10,
                pendingPayments: pendingPaymentsCount || 0,
                pendingPayoutRequests: pendingPayoutsCount || 0,
                pendingKYCRequests: kycPendingCount || 0
            })
        } catch (error) { console.error('Error fetching analytics:', error) }
        finally { setIsLoadingAnalytics(false) }
    }

    const fetchUnreadNotifications = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) return

        try {
            // Fetch all unread notifications for this user that have a raffle_id
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('raffle_id')
                .eq('user_id', userId)
                .eq('is_read', false)
                .not('raffle_id', 'is', null)

            if (error) throw error

            // Group by raffle_id
            const counts: Record<string, number> = {}
            data?.forEach((n: any) => {
                const rId = n.raffle_id
                counts[rId] = (counts[rId] || 0) + 1
            })
            setUnreadNotifications(counts)
        } catch (err) {
            console.error('Error fetching unread notifications:', err)
        }
    }

    const fetchPayments = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingPayments(true)
        try {
            let query = supabaseClient.from('transactions').select('*, profiles(email, display_name)').eq('status', 'pending')
            if (!isAdmin) query = query.eq('user_id', userId)
            const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
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
            let query = supabaseClient.from('payout_requests').select('*, profiles(email, display_name)').eq('status', 'pending')
            if (!isAdmin) query = query.eq('user_id', userId)
            const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
            if (error) throw error
            setPayouts(data || [])
        } catch (error) { console.error('Error fetching payouts:', error) }
        finally { setIsLoadingPayouts(false) }
    }

    const fetchKYCRequests = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsLoadingKYC(true)
        try {
            const { data, error } = await supabaseClient
                .from('kyc_requests')
                .select('*, profiles(email, display_name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(50)
            if (error) throw error
            setKycRequests(data || [])
        } catch (error) { console.error('Error fetching KYC:', error) }
        finally { setIsLoadingKYC(false) }
    }

    const handleDrawWinner = async (eventId: string, eventTitle: string, eventImage: string, currentTibs: number, goalTibs: number) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        if (goalTibs > 0 && currentTibs < goalTibs) {
            if (!confirm(`⚠️ GOAL NOT MET: Current progress is ${currentTibs.toLocaleString()} / ${goalTibs.toLocaleString()} TIBS.\n\nAre you sure you want to close this event? (Participants will be refunded and no winner drawn).`)) return
        } else {
            if (!confirm('Are you sure you want to draw a winner now?')) return
        }
        try {
            const { data, error } = await supabaseClient.rpc('draw_winner_and_payout', { p_raffle_id: eventId, p_admin_id: userId })
            if (error) throw error
            if (!data.success) throw new Error(data.message)
            if (data.outcome === 'unsuccessful') {
                alert(data.message)
                fetchEvents()
                return
            }
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

    const handleApproveKYC = async (requestId: string, targetUserId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        if (!confirm('Approve this host application?')) return
        try {
            // 1. Update Profile (Grant Eligibility)
            const { error: profileError } = await supabaseClient
                .from('profiles')
                .update({ is_host_eligible: true })
                .eq('id', targetUserId)
            if (profileError) throw profileError

            // 2. Update Request Status
            const { error: requestError } = await supabaseClient
                .from('kyc_requests')
                .update({ status: 'verified' })
                .eq('id', requestId)
            if (requestError) throw requestError

            alert('Host approved and verified!')
            fetchKYCRequests()
            fetchAnalytics()
        } catch (error: any) { alert(error.message || 'Error approving KYC') }
    }

    const handleRejectKYC = async (requestId: string) => {
        const reason = prompt('Reason for rejection:')
        if (!reason) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        try {
            const { error } = await supabaseClient
                .from('kyc_requests')
                .update({ status: 'rejected', rejection_reason: reason })
                .eq('id', requestId)
            if (error) throw error
            alert('Application rejected.')
            fetchKYCRequests()
            fetchAnalytics()
        } catch (error: any) { alert(error.message || 'Error rejecting KYC') }
    }

    const handleUpdateEvent = async (eventId: string, updatedData: any, newImages: File[]) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return
        setIsUpdating(true)
        try {
            let mediaUrls = [...(updatedData.existingMediaUrls || [])]
            if (newImages.length > 0) {
                const uploadPromises = newImages.map(async (image) => {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`
                    const { error: uploadError } = await supabaseClient.storage.from('media').upload(filePath, image)
                    if (uploadError) throw uploadError
                    const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(filePath)
                    return publicUrl
                })
                const results = await Promise.all(uploadPromises)
                mediaUrls.push(...results)
            }
            const { error: updateError } = await supabaseClient.from('raffles').update({
                title: updatedData.title,
                description: updatedData.description,
                media_urls: mediaUrls,
                entry_cost_tibs: parseInt(updatedData.cost),
                ends_at: new Date(updatedData.drawTime).toISOString(),
                goal_tibs: parseInt(updatedData.goal) || 0,
                requires_code: updatedData.requiresCode,
                campaign_id: updatedData.requiresCode ? updatedData.campaignId : null
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

    const handleMarkRead = async (raffleId: string) => {
        // Optimistic update
        setUnreadNotifications(prev => {
            const next = { ...prev }
            delete next[raffleId]
            return next
        })

        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) return

        try {
            await supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('raffle_id', raffleId)
                .eq('is_read', false)
        } catch (err) {
            console.error('Error marking notifications as read:', err)
        }
    }

    const handleMarkNotificationsReadByType = async (types: string[]) => {
        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) return
        try {
            await supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .in('type', types)
                .eq('is_read', false)
        } catch (err) {
            console.error('Error clearing notifications by type:', err)
        }
    }

    if (isCheckingPermissions) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/20">Checking Permissions...</p>
            </div>
        </div>
    )

    if (!isAdmin && !isHostEligible) return (
        <div className="min-h-screen flex items-start justify-center p-6 pt-24 md:pt-32 bg-background">
            <div className="bg-card w-full max-w-md p-10 rounded-[40px] border border-white/5 text-center flex flex-col gap-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                <div className="flex flex-col gap-6">
                    <div className="w-40 h-40 mx-auto relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75 group-hover:scale-100 transition-transform duration-700" />
                        <img
                            src="/future_host.png"
                            alt="Future Host"
                            className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">
                            {kycStatus === 'pending' ? 'Verification in Progress' : 'Head\'s up future Host!'}
                        </h2>
                        <p className="text-white/40 text-sm leading-relaxed font-medium px-4">
                            {kycStatus === 'pending'
                                ? "Our team is currently reviewing your application. This typicaly takes 2-6 hours. We'll notify you once you're approved!"
                                : kycStatus === 'rejected'
                                    ? "Your previous verification was rejected. Please head to your profile to try again with clearer photos."
                                    : "Unlock hosting capabilities by completing account verification (KYC) on your profile page!"}
                        </p>
                    </div>

                    <button
                        onClick={() => window.location.href = '/profile'}
                        className="w-full py-5 bg-primary text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] hover:scale-[1.02] active:scale-95 mt-2"
                    >
                        {kycStatus === 'pending' ? 'View Profile Status' : 'Go to Profile for KYC'}
                    </button>
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
                            <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">{isAdmin ? 'Admin Terminal' : 'Host Dashboard'}</span>
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
                        {(['events', 'archives', 'campaigns', 'payments', 'payouts', 'kyc', 'analytics'] as const)
                            .filter(tab => isAdmin || tab !== 'kyc')
                            .map((tab) => {
                                const label = tab === 'payments' ? 'Purchases' : tab === 'payouts' ? 'Cash Outs' : tab
                                const count = (tab === 'payments' ? analytics?.pendingPayments :
                                    tab === 'payouts' ? analytics?.pendingPayoutRequests :
                                        tab === 'kyc' ? analytics?.pendingKYCRequests : 0) || 0

                                return (
                                    <button
                                        key={tab}
                                        onClick={() => {
                                            setActiveTab(tab)
                                            // Auto-clear related notifications
                                            if (tab === 'payments') handleMarkNotificationsReadByType(['payment'])
                                            if (tab === 'kyc') handleMarkNotificationsReadByType(['kyc'])
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
                                    >
                                        {label}
                                        {count > 0 && (
                                            <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-primary text-black text-[8px] font-black animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.5)]">
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto py-8 pb-32">
                {/* Content */}
                {activeTab === 'analytics' ? (
                    <div className="flex flex-col gap-10">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black uppercase tracking-widest">{isAdmin ? 'Platform Analytics' : 'My Analytics'}</h2>
                            <button onClick={fetchAnalytics} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-colors"><Loader2 size={14} className={isLoadingAnalytics ? "animate-spin" : ""} /> Refresh Data</button>
                        </div>
                        {analytics ? <AnalyticsOverview analytics={analytics} isAdmin={isAdmin} /> : null}
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
                                campaigns={campaigns}
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
                            unreadNotifications={unreadNotifications}
                            handleMarkRead={handleMarkRead}
                            initialSearchQuery={initialSearchQuery}
                        />
                    </div>
                ) : activeTab === 'payments' ? (
                    <PaymentsList payments={payments} handleApprove={handleApproveMemo} handleReject={handleRejectMemo} isLoadingPayments={isLoadingPayments} fetchPayments={fetchPaymentsMemo} />
                ) : activeTab === 'payouts' ? (
                    <PayoutsList payouts={payouts} handleApprovePayout={handleApprovePayoutMemo} isLoadingPayouts={isLoadingPayouts} fetchPayoutRequests={fetchPayoutRequestsMemo} />
                ) : activeTab === 'kyc' ? (
                    <KYCList requests={kycRequests} handleApprove={handleApproveKYC} handleReject={handleRejectKYC} isLoadingKYC={isLoadingKYC} fetchKYC={fetchKYCRequests} />
                ) : activeTab === 'campaigns' ? (
                    <CampaignsManager
                        campaigns={campaigns}
                        isLoading={isLoadingCampaigns}
                        fetchError={fetchError}
                        fetchCampaigns={fetchCampaignsMemo}
                        getClient={getClient}
                        userId={userId}
                        isAdmin={isAdmin}
                        showToast={showToast}
                    />
                ) : null}
            </div>

            {selectedEvent && <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} handleDrawWinner={handleDrawWinner} handleRefund={handleRefund} getClient={getClient} />}
            {editingEvent && <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} campaigns={campaigns} handleUpdateEvent={handleUpdateEvent} isUpdating={isUpdating} />}
        </div>
    )
}
