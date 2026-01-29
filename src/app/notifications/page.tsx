"use client"

import React, { useEffect, useState } from 'react'
import { Bell, Trophy, Wallet, Info, Loader2, X, Mail, Clock, Users, ExternalLink } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

interface Notification {
    id: string
    message: string
    type: string
    is_read: boolean
    created_at: string
    // We'll add raffle_id to notifications for win types
    raffle_id?: string
}

interface RaffleDetails {
    id: string
    title: string
    description?: string
    media_urls?: string[]
    entry_cost_tibs: number
    status: string
    drawn_at?: string
    winning_entry?: { ticket_number: string }
    host?: { display_name: string, email: string }
    entries?: { count: number }[]
}

export default function NotificationsPage() {
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { getClient } = useSupabase()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null)
    const [selectedRaffle, setSelectedRaffle] = useState<RaffleDetails | null>(null)
    const [isLoadingRaffle, setIsLoadingRaffle] = useState(false)

    // Mark all notifications as read when page loads
    const markAllAsRead = async () => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        await supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)
    }

    const fetchNotifications = async () => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoading(true)
        try {
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotifications(data || [])

            // Mark all as read after fetching
            await markAllAsRead()
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Fetch raffle details when a win notification is clicked
    const handleNotificationClick = async (notif: Notification) => {
        setSelectedNotif(notif)

        // For win notifications, try to find the related raffle
        if (notif.type === 'win') {
            setIsLoadingRaffle(true)
            try {
                const supabaseClient = await getClient()
                if (!supabaseClient) return

                // Find raffles where this user won
                const { data: raffles } = await supabaseClient
                    .from('raffles')
                    .select(`
                        id, title, description, media_urls, entry_cost_tibs, status, drawn_at,
                        winning_entry:entries!raffles_winning_entry_id_fkey(ticket_number),
                        host:profiles!host_user_id(display_name, email),
                        entries:entries!entries_raffle_id_fkey(count)
                    `)
                    .eq('winner_user_id', userId)
                    .eq('status', 'drawn')
                    .order('drawn_at', { ascending: false })
                    .limit(1)

                if (raffles && raffles.length > 0) {
                    setSelectedRaffle(raffles[0] as RaffleDetails)
                }
            } catch (err) {
                console.error('Error fetching raffle:', err)
            } finally {
                setIsLoadingRaffle(false)
            }
        }
    }

    const closeModal = () => {
        setSelectedNotif(null)
        setSelectedRaffle(null)
    }

    const handleContactHost = () => {
        if (!selectedRaffle?.host?.email) return

        const ticketNum = selectedRaffle.winning_entry?.ticket_number || 'N/A'
        const subject = encodeURIComponent(`8TONBALL Winner: ${selectedRaffle.title} (Ticket #${ticketNum})`)
        const body = encodeURIComponent(`Hi ${selectedRaffle.host.display_name},\n\nI won your event "${selectedRaffle.title}" with ticket #${ticketNum}.\n\nPlease let me know how to claim my prize.\n\nThank you!`)

        window.open(`mailto:${selectedRaffle.host.email}?subject=${subject}&body=${body}`, '_blank')
    }

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchNotifications()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId])

    const getIcon = (type: string) => {
        switch (type) {
            case 'win': return <Trophy className="text-primary" size={18} />
            case 'payment': return <Wallet className="text-green-500" size={18} />
            default: return <Info className="text-blue-400" size={18} />
        }
    }

    const getRelativeTime = (date: string) => {
        const now = new Date()
        const d = new Date(date)
        const diff = Math.floor((now.getTime() - d.getTime()) / 1000)

        if (diff < 60) return 'Just now'
        if (diff < 3600) return `${Math.floor(diff / 60)}m`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    // Group notifications by time
    const groupNotifications = () => {
        const now = new Date()
        const today: Notification[] = []
        const earlier: Notification[] = []

        notifications.forEach(n => {
            const d = new Date(n.created_at)
            const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
            if (diffHours < 24) {
                today.push(n)
            } else {
                earlier.push(n)
            }
        })

        return { today, earlier }
    }

    const { today, earlier } = groupNotifications()

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">Activity</h2>
            </div>

            {/* Notifications List - Minimal Style */}
            <div className="flex flex-col">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : notifications.length > 0 ? (
                    <>
                        {/* Today Section */}
                        {today.length > 0 && (
                            <>
                                <div className="px-1 py-3">
                                    <span className="text-xs font-black uppercase tracking-widest text-white/30">Today</span>
                                </div>
                                {today.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`flex items-start gap-3 px-3 py-4 rounded-xl cursor-pointer transition-all hover:bg-white/5 active:scale-[0.98] ${!notif.is_read ? 'bg-primary/5' : ''
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug ${!notif.is_read ? 'text-white font-semibold' : 'text-white/70'}`}>
                                                {notif.message}
                                            </p>
                                            <span className="text-xs text-white/30 mt-0.5">{getRelativeTime(notif.created_at)}</span>
                                        </div>
                                        {!notif.is_read && (
                                            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                        )}
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Earlier Section */}
                        {earlier.length > 0 && (
                            <>
                                <div className="px-1 py-3 mt-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-white/30">Earlier</span>
                                </div>
                                {earlier.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className="flex items-start gap-3 px-3 py-4 rounded-xl cursor-pointer transition-all hover:bg-white/5 active:scale-[0.98] opacity-60"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm leading-snug text-white/70">
                                                {notif.message}
                                            </p>
                                            <span className="text-xs text-white/30 mt-0.5">{getRelativeTime(notif.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                            <Bell size={28} className="text-white/20" />
                        </div>
                        <p className="text-white/30 text-sm font-medium">No activity yet</p>
                    </div>
                )}
            </div>

            {/* Event Details Modal */}
            {selectedNotif && (
                <div
                    className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={closeModal}
                >
                    <div
                        className="w-full max-w-md bg-[#0A0A0B] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <div className="absolute top-4 right-4 z-10">
                            <button
                                onClick={closeModal}
                                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {isLoadingRaffle ? (
                            <div className="p-12 flex items-center justify-center">
                                <Loader2 className="animate-spin text-primary" size={32} />
                            </div>
                        ) : selectedRaffle ? (
                            <>
                                {/* Event Image */}
                                <div className="aspect-video relative">
                                    <img
                                        src={selectedRaffle.media_urls?.[0] || 'https://via.placeholder.com/400x225?text=Event'}
                                        alt={selectedRaffle.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent" />

                                    {/* Winner Badge */}
                                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-primary rounded-full flex items-center gap-1.5">
                                        <Trophy size={14} className="text-black" />
                                        <span className="text-xs font-black uppercase text-black">You Won!</span>
                                    </div>
                                </div>

                                {/* Event Info */}
                                <div className="p-6 -mt-8 relative">
                                    <h3 className="text-xl font-black tracking-tight mb-2">{selectedRaffle.title}</h3>

                                    {selectedRaffle.description && (
                                        <p className="text-white/50 text-sm mb-4 line-clamp-2">{selectedRaffle.description}</p>
                                    )}

                                    {/* Stats */}
                                    <div className="flex gap-4 mb-6 text-sm">
                                        <div className="flex items-center gap-1.5 text-white/40">
                                            <Users size={14} />
                                            <span>{selectedRaffle.entries?.[0]?.count || 0} entries</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-white/40">
                                            <Clock size={14} />
                                            <span>{selectedRaffle.drawn_at ? new Date(selectedRaffle.drawn_at).toLocaleDateString() : 'Ended'}</span>
                                        </div>
                                    </div>

                                    {/* Winning Ticket */}
                                    {selectedRaffle.winning_entry?.ticket_number && (
                                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase tracking-widest text-primary/60">Winning Ticket</span>
                                                <span className="text-lg font-black text-primary">#{selectedRaffle.winning_entry.ticket_number}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Host Info */}
                                    {selectedRaffle.host && (
                                        <div className="bg-white/5 rounded-2xl p-4 mb-6 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/40">
                                                {selectedRaffle.host.display_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{selectedRaffle.host.display_name}</p>
                                                <p className="text-xs text-white/40">Event Host</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact Host Button */}
                                    <button
                                        onClick={handleContactHost}
                                        disabled={!selectedRaffle.host?.email}
                                        className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Mail size={18} />
                                        Contact Host
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Generic notification view */
                            <div className="p-8">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                                    {getIcon(selectedNotif.type)}
                                </div>
                                <p className="text-center text-white/80 leading-relaxed">{selectedNotif.message}</p>
                                <p className="text-center text-white/30 text-xs mt-3">{getRelativeTime(selectedNotif.created_at)}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
