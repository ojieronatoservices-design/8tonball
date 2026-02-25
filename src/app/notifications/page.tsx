"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { Bell, Trophy, Wallet, Info, Loader2, X, Mail, Clock, Users, MessageSquare, Reply, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useRouter } from 'next/navigation'

interface Notification {
    id: string
    message: string
    type: string
    is_read: boolean
    created_at: string
    raffle_id?: string
    comment_id?: string
    actor_id?: string
    metadata?: {
        total_actors?: number
        last_actor_name?: string
    }
    raffle?: {
        title: string
        media_urls?: string[]
    }
    actor?: {
        avatar_url?: string
    }
}

interface RaffleDetails {
    id: string
    title: string
    description?: string
    media_urls?: string[]
    entry_cost_tibs: number
    status: string
    drawn_at?: string
    winning_entry?: any
    host?: any
    entries?: any
}

const getFirst = <T,>(arr: T | T[] | undefined): T | undefined => {
    if (!arr) return undefined
    return Array.isArray(arr) ? arr[0] : arr
}

const stripEmojis = (str: string) => {
    return str.replace(/[\u1000-\uFFFF]+/g, '').replace(/\p{Emoji}/gu, '').replace(/(🎉|💰|🎟️|🎫|🥳)/g, '').trim()
}

export default function NotificationsPage() {
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { getClient } = useSupabase()
    const router = useRouter()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null)
    const [selectedRaffle, setSelectedRaffle] = useState<RaffleDetails | null>(null)
    const [isLoadingRaffle, setIsLoadingRaffle] = useState(false)

    const fetchNotifications = useCallback(async () => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoading(true)
        try {
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*, raffle:raffles(title, media_urls), actor:profiles!actor_id(avatar_url)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotifications(data || [])

            // Mark visible unread ones as read
            const unreadIds = (data || []).filter((n: any) => !n.is_read).map((n: any) => n.id)
            if (unreadIds.length > 0) {
                await supabaseClient
                    .from('notifications')
                    .update({ is_read: true })
                    .in('id', unreadIds)
                // Notify Shell to clear the red dot
                window.dispatchEvent(new CustomEvent('notificationsRead'))
            }
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setIsLoading(false)
        }
    }, [userId, getClient])

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchNotifications()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId, fetchNotifications])

    const handleNotificationClick = async (notif: Notification) => {
        // Social types or Entry types -> Redirect to raffle on home page
        if (['comment', 'reply', 'entry', 'vote_up', 'vote_down'].includes(notif.type) && notif.raffle_id) {
            const url = `/?raffleId=${notif.raffle_id}`
            router.push(url)
            return
        }

        // Win notifications -> Open modal (existing logic)
        if (notif.type === 'win') {
            setSelectedNotif(notif)
            setIsLoadingRaffle(true)
            try {
                const supabaseClient = await getClient()
                if (!supabaseClient) return

                let query = supabaseClient
                    .from('raffles')
                    .select(`
                        id, title, description, media_urls, entry_cost_tibs, status, drawn_at,
                        winning_entry:entries!raffles_winning_entry_id_fkey(ticket_number),
                        host:profiles!host_user_id(display_name, email),
                        entries:entries!entries_raffle_id_fkey(count)
                    `)
                    .eq('status', 'drawn')

                if (notif.raffle_id) {
                    query = query.eq('id', notif.raffle_id)
                } else {
                    const match = notif.message.match(/You won (.+?)(!|$)/i)
                    if (match && match[1]) {
                        query = query.ilike('title', `%${match[1]}%`)
                    } else {
                        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
                    }
                }

                const { data: raffles } = await query.order('drawn_at', { ascending: false }).limit(1)
                if (raffles && raffles.length > 0) {
                    setSelectedRaffle(raffles[0] as unknown as RaffleDetails)
                }
            } catch (err) {
                console.error('Error fetching raffle:', err)
            } finally {
                setIsLoadingRaffle(false)
            }
        } else {
            // Generic modal for other types (e.g. payment) or if we want extra info
            setSelectedNotif(notif)
        }
    }

    const closeModal = () => {
        setSelectedNotif(null)
        setSelectedRaffle(null)
    }

    const handleContactHost = () => {
        const host = getFirst(selectedRaffle?.host)
        const winningEntry = getFirst(selectedRaffle?.winning_entry)
        if (!host?.email) return

        const ticketNum = winningEntry?.ticket_number || 'N/A'
        const subject = encodeURIComponent(`8TONBALL Winner: ${selectedRaffle?.title} (Ticket #${ticketNum})`)
        const body = encodeURIComponent(`Hi ${host.display_name},\n\nI won your event "${selectedRaffle?.title}" with ticket #${ticketNum}.\n\nPlease let me know how to claim my prize.\n\nThank you!`)
        window.open(`mailto:${host.email}?subject=${subject}&body=${body}`, '_blank')
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'win': return <Trophy className="text-primary" size={18} />
            case 'payment': return <Wallet className="text-green-500" size={18} />
            case 'comment': return <MessageSquare className="text-blue-400" size={18} />
            case 'reply': return <Reply className="text-indigo-400" size={18} />
            case 'entry': return <Users className="text-orange-400" size={18} />
            case 'vote_up': return <ChevronUp className="text-primary" size={18} />
            case 'vote_down': return <ChevronDown className="text-red-500" size={18} />
            default: return <Info className="text-white/40" size={18} />
        }
    }

    const getRelativeTime = (date: string) => {
        const now = new Date()
        const d = new Date(date)
        const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
        if (diff < 60) return `${diff}s`
        if (diff < 3600) return `${Math.floor(diff / 60)}m`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`
        return `${Math.floor(diff / 604800)}w`
    }

    const groupNotifications = () => {
        const now = new Date()
        const today: Notification[] = []
        const earlier: Notification[] = []
        notifications.forEach(n => {
            const d = new Date(n.created_at)
            const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
            if (diffHours < 24) today.push(n)
            else earlier.push(n)
        })
        return { today, earlier }
    }

    const { today, earlier } = groupNotifications()

    const renderNotificationItem = (notif: Notification) => {
        const isWin = notif.type === 'win'
        const isEntry = notif.type === 'entry'
        const isSystem = ['payment', 'system', 'payout'].includes(notif.type)
        const hasThumbnail = isWin && notif.raffle?.media_urls?.[0]

        return (
            <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-start gap-4 px-6 py-5 cursor-pointer transition-all hover:bg-white/5 active:bg-white/10 border-b border-white/5 -mx-6 ${!notif.is_read ? 'bg-primary/5' : ''}`}
            >
                {/* Left Icon Area */}
                <div className="shrink-0 relative">
                    {isWin ? (
                        <div className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.3)] shrink-0">
                            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
                                <svg viewBox="0 0 100 100" className="w-full h-full text-black">
                                    <path id={`circlePath-${notif.id}`} d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
                                    <text className="text-[10px] font-black tracking-[0.2em]" fill="currentColor">
                                        <textPath href={`#circlePath-${notif.id}`} startOffset="0%">
                                            CONGRATULATIONS! CONGRATULATIONS!
                                        </textPath>
                                    </text>
                                </svg>
                            </div>
                            <span className="text-black font-black text-2xl z-10 italic">8T</span>
                        </div>
                    ) : isEntry && notif.actor?.avatar_url ? (
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10">
                            <img src={notif.actor.avatar_url} alt="User" className="w-full h-full object-cover" />
                        </div>
                    ) : isSystem ? (
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-black font-black text-3xl italic">8</span>
                        </div>
                    ) : (
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${!notif.is_read ? 'border-primary/20 bg-primary/10' : 'border-white/5 bg-white/5'}`}>
                            {getIcon(notif.type)}
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    <p className={`text-[14px] leading-snug ${!notif.is_read ? 'text-white font-black' : 'text-white/80 font-medium'}`}>
                        {stripEmojis(notif.message)}
                    </p>

                    {hasThumbnail && (
                        <div className="mt-3 flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10 w-fit">
                            <img src={notif.raffle!.media_urls![0]} alt="Thumbnail" className="w-12 h-12 rounded-lg object-cover" />
                            <div className="pr-2 max-w-[200px]">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Event Won</p>
                                <p className="text-xs font-black text-white truncate">{notif.raffle!.title}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${!notif.is_read ? 'text-primary' : 'text-white/30'}`}>{getRelativeTime(notif.created_at)}</span>
                        {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_primary]" />}
                    </div>
                </div>

                {/* Right Action Area */}
                {['comment', 'reply', 'entry', 'vote_up', 'vote_down'].includes(notif.type) && (
                    <div className="text-primary/20 flex flex-col items-center self-center pl-2">
                        <CheckCircle2 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black tracking-tight italic uppercase underline decoration-primary decoration-4 underline-offset-4">Activity Center</h2>
                    <p className="text-[10px] uppercase font-black tracking-widest text-white/30 mt-1">Updates, Social & Wins</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Bell size={20} className="text-primary" />
                </div>
            </div>

            {/* Notifications List */}
            <div className="flex flex-col">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : notifications.length > 0 ? (
                    <>
                        {today.length > 0 && (
                            <div className="flex flex-col">
                                <div className="px-1 py-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Recently</span>
                                </div>
                                {today.map(renderNotificationItem)}
                            </div>
                        )}

                        {earlier.length > 0 && (
                            <div className="flex flex-col mt-4">
                                <div className="px-1 py-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Previous Activities</span>
                                </div>
                                {earlier.map(renderNotificationItem)}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center gap-6 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-dashed border-white/10">
                            <Bell size={40} className="text-white/10" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-white font-black text-lg italic uppercase">No Activity Detected</p>
                            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">Join an event or start a conversation!</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Event Details Modal (Win/Payment) */}
            {selectedNotif && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200" onClick={closeModal}>
                    <div className="w-full max-w-md bg-[#0A0A0B] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-6 right-6 z-10">
                            <button onClick={closeModal} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5">
                                <X size={20} />
                            </button>
                        </div>

                        {isLoadingRaffle ? (
                            <div className="p-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="animate-spin text-primary" size={40} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Checking records...</span>
                            </div>
                        ) : selectedRaffle ? (
                            <>
                                <div className="aspect-[16/9] relative">
                                    <img src={selectedRaffle.media_urls?.[0] || 'https://via.placeholder.com/800x450'} alt={selectedRaffle.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent" />
                                    <div className="absolute top-6 left-6 px-4 py-2 bg-primary rounded-full flex items-center gap-2 shadow-[0_0_20px_primary]">
                                        <Trophy size={16} className="text-black" />
                                        <span className="text-xs font-black uppercase text-black tracking-tight">Main Prize Winner!</span>
                                    </div>
                                </div>

                                <div className="p-8 -mt-10 relative">
                                    <h3 className="text-2xl font-black tracking-tighter mb-2 italic underline decoration-primary decoration-2 underline-offset-4">{selectedRaffle.title}</h3>
                                    {selectedRaffle.description && <p className="text-white/50 text-xs mb-6 leading-relaxed line-clamp-2">{selectedRaffle.description}</p>}

                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                                            <Users size={16} className="text-white/30" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Total Entries</span>
                                                <span className="font-black text-white">{selectedRaffle.entries?.[0]?.count || 0}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                                            <Clock size={16} className="text-white/30" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Drawn Date</span>
                                                <span className="font-black text-white">{selectedRaffle.drawn_at ? new Date(selectedRaffle.drawn_at).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {getFirst(selectedRaffle.winning_entry)?.ticket_number && (
                                        <div className="bg-primary/10 border border-primary/20 rounded-[1.5rem] p-6 mb-8 text-center ring-1 ring-primary/30">
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60 block mb-1">Your Lucky Ticket</span>
                                            <span className="text-4xl font-black text-primary tracking-tighter">#{getFirst(selectedRaffle.winning_entry)?.ticket_number}</span>
                                        </div>
                                    )}

                                    {getFirst(selectedRaffle.host) && (
                                        <div className="bg-white/5 rounded-2xl p-5 mb-8 flex items-center gap-4 border border-white/5">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xl border border-primary/20">
                                                {getFirst(selectedRaffle.host)?.display_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-white/30 font-black uppercase tracking-widest">Event Host</p>
                                                <p className="text-lg font-black">{getFirst(selectedRaffle.host)?.display_name}</p>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleContactHost}
                                        disabled={!getFirst(selectedRaffle.host)?.email}
                                        className="w-full h-16 bg-white text-black font-black uppercase tracking-widest text-sm rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-30"
                                    >
                                        <Mail size={20} />
                                        Contact Host Now
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="p-12 flex flex-col items-center text-center">
                                <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                                    {getIcon(selectedNotif.type)}
                                </div>
                                <h4 className="text-xl font-black italic uppercase mb-4">{selectedNotif.type} Confirmation</h4>
                                <p className="text-white/70 text-sm leading-relaxed mb-8">{selectedNotif.message}</p>
                                <div className="w-full h-px bg-white/5 mb-6" />
                                <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">{getRelativeTime(selectedNotif.created_at)}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
