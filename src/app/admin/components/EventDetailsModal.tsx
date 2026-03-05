"use client"

import React, { useState, useEffect, memo } from 'react'
import { X, Loader2, Trophy, Image as ImageIcon, Users, Key, Link, FileText, ChevronRight } from 'lucide-react'
import { ManageCodesModal } from '@/components/ManageCodesModal'
import { isVideo } from '../utils'

const EventDetailsModal = memo(({ event, onClose, handleDrawWinner, handleRefund, getClient }: { event: any, onClose: () => void, handleDrawWinner: any, handleRefund: any, getClient: () => Promise<any> }) => {
    const totalTibs = (event.entries?.[0]?.count || 0) * event.entry_cost_tibs
    const totalPeso = totalTibs / 8
    const goalMet = event.goal_tibs > 0 ? totalTibs >= event.goal_tibs : true
    const progress = event.goal_tibs > 0 ? Math.min((totalTibs / event.goal_tibs) * 100, 100) : 100
    const [showManageCodes, setShowManageCodes] = useState(false)
    const [participants, setParticipants] = useState<any[]>([])
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
    const [fulfillmentStatus, setFulfillmentStatus] = useState(event.fulfillment_status || 'unclaimed')
    const [isUpdatingFulfillment, setIsUpdatingFulfillment] = useState(false)

    const updateFulfillment = async (newStatus: string) => {
        setIsUpdatingFulfillment(true)
        const supabaseClient = await getClient()
        try {
            const { error } = await supabaseClient
                .from('raffles')
                .update({ fulfillment_status: newStatus })
                .eq('id', event.id)
            if (error) throw error
            setFulfillmentStatus(newStatus)
            // Refresh local event object if needed or just trust state
            event.fulfillment_status = newStatus
        } catch (err) {
            alert('Error updating fulfillment status')
            console.error(err)
        } finally {
            setIsUpdatingFulfillment(false)
        }
    }
    const fetchParticipants = async () => {
        setIsLoadingParticipants(true)
        const supabaseClient = await getClient()
        try {
            const { data, error } = await supabaseClient
                .from('entries')
                .select(`
                    id,
                    ticket_number,
                    created_at,
                    profiles!user_id (
                        email,
                        display_name,
                        id
                    )
                `)
                .eq('raffle_id', event.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setParticipants(data || [])
        } catch (err) {
            console.error('Error fetching participants:', err)
        } finally {
            setIsLoadingParticipants(false)
        }
    }

    useEffect(() => {
        fetchParticipants()
    }, [event.id])

    const exportParticipants = () => {
        if (participants.length === 0) return
        const csvContent = "Ticket,Name,Email,Entered At\n" +
            participants.map(p => `"${p.ticket_number}","${p.profiles?.display_name || 'Unknown'}","${p.profiles?.email || ''}","${new Date(p.created_at).toLocaleString()}"`).join("\n")
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `Participants_${event.display_id || event.id.slice(0, 4)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    const copyPromoLink = () => {
        const url = `${window.location.origin}/event/${event.id}`
        navigator.clipboard.writeText(url)
        alert('Promo link copied to clipboard!')
    }

    // +X New Participants Badge
    const currentCount = event.entries?.[0]?.count || 0
    const storageKey = `lastSeenCount_${event.id}`
    const lastSeen = typeof window !== 'undefined' ? parseInt(localStorage.getItem(storageKey) || '0', 10) : 0
    const newParticipants = Math.max(0, currentCount - lastSeen)
    const [showNewBadge, setShowNewBadge] = useState(newParticipants > 0)

    useEffect(() => {
        // Save current count to localStorage on modal open
        localStorage.setItem(storageKey, String(currentCount))
        // Auto-fade the badge after 3 seconds
        if (newParticipants > 0) {
            const timer = setTimeout(() => setShowNewBadge(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [storageKey, currentCount, newParticipants])

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
                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 text-xs font-black">{event.entry_cost_tibs === 0 ? 'FREE' : `${event.entry_cost_tibs} TIBS`}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <p className="text-[10px] uppercase font-black text-white/30 mb-1">Total Made</p>
                            <div className="text-xl font-black text-primary">₱{totalPeso.toLocaleString()}</div>
                            <p className="text-[10px] text-white/20">{totalTibs.toLocaleString()} TIBS</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative">
                            <p className="text-[10px] uppercase font-black text-white/30 mb-1">Participants</p>
                            <div className="text-xl font-black">{currentCount}</div>
                            <p className="text-[10px] text-white/20">Entries</p>
                            {showNewBadge && newParticipants > 0 && (
                                <div className="absolute -top-2 -right-2 bg-green-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow-lg shadow-green-500/30 animate-in zoom-in-50 fade-in duration-300" style={{ animation: 'fadeInOut 3s ease-in-out forwards' }}>
                                    +{newParticipants}
                                </div>
                            )}
                        </div>
                    </div>

                    {event.requires_code && (
                        <button
                            onClick={() => setShowManageCodes(true)}
                            className="w-full bg-white/5 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center gap-2"
                        >
                            <Key size={14} className="text-primary" /> Manage Campaign Codes
                        </button>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={copyPromoLink}
                            className="flex-1 bg-white/5 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center gap-2"
                        >
                            <Link size={14} className="text-primary" /> Copy Promo Link
                        </button>
                        <button
                            onClick={exportParticipants}
                            disabled={participants.length === 0}
                            className="flex-1 bg-white/5 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <FileText size={14} className="text-primary" /> Export CSV
                        </button>
                    </div>

                    {/* Recent Participants List */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Recent Participants</span>
                            <Users size={12} className="text-white/20" />
                        </div>
                        <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden max-h-[180px] overflow-y-auto no-scrollbar">
                            {isLoadingParticipants ? (
                                <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-primary/30" /></div>
                            ) : participants.length > 0 ? (
                                <div className="flex flex-col divide-y divide-white/5">
                                    {participants.map((p) => (
                                        <div key={p.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[11px] font-black truncate">{p.profiles?.display_name || 'Anonymous'}</span>
                                                <span className="text-[9px] text-white/30 truncate">{p.profiles?.email || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <div className="bg-white/5 px-2 py-1 rounded text-[10px] font-black italic color-primary">#{p.ticket_number}</div>
                                                <ChevronRight size={12} className="text-white/10" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-[10px] font-black uppercase tracking-widest text-white/10">No entries yet</div>
                            )}
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

                            {/* Fulfillment Controls */}
                            <div className="mt-4 pt-4 border-t border-primary/20 flex flex-col gap-3">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/50">Fulfillment Status</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${fulfillmentStatus === 'claimed' ? 'text-green-500' :
                                        fulfillmentStatus === 'shipped' ? 'text-blue-400' : 'text-primary'
                                        }`}>{fulfillmentStatus}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => updateFulfillment('unclaimed')}
                                        disabled={isUpdatingFulfillment || fulfillmentStatus === 'unclaimed'}
                                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${fulfillmentStatus === 'unclaimed' ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10'
                                            }`}
                                    >Unclaimed</button>
                                    <button
                                        onClick={() => updateFulfillment('shipped')}
                                        disabled={isUpdatingFulfillment || fulfillmentStatus === 'shipped'}
                                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${fulfillmentStatus === 'shipped' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10'
                                            }`}
                                    >Shipped</button>
                                    <button
                                        onClick={() => updateFulfillment('claimed')}
                                        disabled={isUpdatingFulfillment || fulfillmentStatus === 'claimed'}
                                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${fulfillmentStatus === 'claimed' ? 'bg-green-500/20 border-green-500/40 text-green-500' : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10'
                                            }`}
                                    >Claimed</button>
                                </div>
                            </div>

                            {!goalMet && (
                                <div className="text-[9px] text-red-500 font-black uppercase tracking-widest bg-red-500/10 p-2 rounded-lg text-center border border-red-500/10">
                                    ⚠️ WARNING: This raffle was drawn without meeting the goal.
                                </div>
                            )}
                        </div>
                    )}

                    {event.status === 'closed' && !event.winner && (
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col gap-2">
                            <div className="flex items-center justify-center gap-2 text-white/50 py-2">
                                <span className="text-xs font-black uppercase tracking-widest text-center">Event Unsuccessful — No Winner Selected</span>
                            </div>
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
            {showManageCodes && (
                <ManageCodesModal
                    raffleId={event.id}
                    displayId={event.display_id || event.id.slice(0, 4)}
                    onClose={() => setShowManageCodes(false)}
                />
            )}
        </div>
    )
})
EventDetailsModal.displayName = 'EventDetailsModal'

export { EventDetailsModal }
