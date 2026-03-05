"use client"

import { useState, memo } from 'react'
import { Trash2, Trophy, ChevronDown, Image as ImageIcon } from 'lucide-react'
import { isVideo } from '../utils'

const AdminEventBar = memo(({
    event,
    isAdmin,
    userId,
    onSelectEvent,
    onEditEvent,
    onDeleteEvent,
    unreadCount,
    onMarkRead
}: {
    event: any,
    isAdmin: boolean,
    userId: string | null | undefined,
    onSelectEvent: (e: any) => void,
    onEditEvent: (e: any) => void,
    onDeleteEvent: (id: string) => void,
    unreadCount: number,
    onMarkRead: (id: string) => void
}) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const entryCount = event.entries?.[0]?.count || 0
    const totalTibs = entryCount * event.entry_cost_tibs
    const goalMet = event.goal_tibs > 0 ? totalTibs >= event.goal_tibs : true
    const progress = event.goal_tibs > 0 ? Math.min((totalTibs / event.goal_tibs) * 100, 100) : 100

    return (
        <div className={`bg-card border-b border-white/5 transition-all duration-300 ${isExpanded ? 'bg-white/[0.02]' : 'hover:bg-white/[0.01]'}`}>
            {/* Bar Header */}
            <div
                onClick={() => {
                    setIsExpanded(!isExpanded)
                    if (!isExpanded && unreadCount > 0) {
                        onMarkRead(event.id)
                    }
                }}
                className="flex items-center gap-4 p-4 cursor-pointer"
            >
                <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 border border-white/5 relative">
                    {event.media_urls?.[0] ? (
                        isVideo(event.media_urls[0]) ? <video src={event.media_urls[0]} className="w-full h-full object-cover" />
                            : <img src={event.media_urls[0]} alt="" className="w-full h-full object-cover" />
                    ) : <ImageIcon className="w-full h-full p-3 text-white/10" />}
                    {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-card animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                    )}
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
                                    <Trophy size={10} /> {event.winner.display_name} (#{event.winning_entry?.ticket_number || '---'})
                                </span>
                                {!goalMet && (
                                    <span className="text-[8px] bg-red-500/20 text-red-500 px-1 rounded border border-red-500/20 ml-1">UNMET GOAL</span>
                                )}
                            </>
                        )}
                        {event.status === 'closed' && !event.winner && (
                            <>
                                <span>•</span>
                                <span className="text-white/40 font-black flex items-center gap-1">
                                    NO WINNER
                                </span>
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

export { AdminEventBar }
