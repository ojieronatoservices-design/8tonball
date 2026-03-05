"use client"

import React, { useState, memo } from 'react'
import { X, Loader2, Calendar, Search } from 'lucide-react'
import { AdminEventBar } from './AdminEventBar'

const ExistingEventsSection = memo(({
    activeTab,
    existingEvents,
    userId,
    isAdmin,
    isLoadingEvents,
    fetchEvents,
    onSelectEvent,
    onEditEvent,
    onDeleteEvent,
    unreadNotifications,
    handleMarkRead,
    initialSearchQuery = ''
}: {
    activeTab: string,
    existingEvents: any[],
    userId: string | null | undefined,
    isAdmin: boolean,
    isLoadingEvents: boolean,
    fetchEvents: () => void,
    onSelectEvent: (e: any) => void,
    onEditEvent: (e: any) => void,
    onDeleteEvent: (id: string) => void,
    unreadNotifications: Record<string, number>,
    handleMarkRead: (id: string) => void,
    initialSearchQuery?: string
}) => {
    const [dateFilter, setDateFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
    const deferredDateFilter = React.useDeferredValue(dateFilter)
    const deferredSearchQuery = React.useDeferredValue(searchQuery)

    const filteredEvents = React.useMemo(() => {
        return existingEvents.filter(e => {
            const matchesTab = activeTab === 'events' ? e.status === 'open' : (e.status === 'drawn' || e.status === 'closed');
            const matchesDate = deferredDateFilter ? e.created_at.startsWith(deferredDateFilter) : true;
            const matchesUser = isAdmin ? true : e.host_user_id === userId;

            let matchesSearch = true;
            if (deferredSearchQuery) {
                const search = deferredSearchQuery.toLowerCase();
                const matchesTitle = e.title?.toLowerCase().includes(search);
                const matchesWinner = e.winner_user_id?.toLowerCase().includes(search);
                const matchesWinningTicket = e.winning_ticket_number?.toLowerCase().includes(search);
                matchesSearch = matchesTitle || matchesWinner || matchesWinningTicket;
            }

            return matchesTab && matchesDate && matchesUser && matchesSearch;
        });
    }, [existingEvents, activeTab, deferredDateFilter, deferredSearchQuery, isAdmin, userId]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-white/5 w-full md:w-auto">
                        <Calendar size={14} className="ml-2 text-white/20" />
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 px-2 py-1.5 [color-scheme:dark] w-full"
                        />
                        {dateFilter && (
                            <button onClick={() => setDateFilter('')} className="p-1 hover:bg-white/5 rounded-full mr-1 transition-colors">
                                <X size={12} className="text-white/40" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-white/5 w-full md:w-auto min-w-[300px]">
                        <Search size={14} className="ml-2 text-white/20" />
                        <input
                            type="text"
                            placeholder="Search by title, winner ID, or ticket..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 px-2 py-1.5 flex-1 placeholder:text-white/10"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-white/5 rounded-full mr-1 transition-colors">
                                <X size={12} className="text-white/40" />
                            </button>
                        )}
                    </div>
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
                <div className="flex flex-col">
                    {filteredEvents.map((event) => (
                        <AdminEventBar
                            key={event.id}
                            event={event}
                            isAdmin={isAdmin}
                            userId={userId}
                            onSelectEvent={onSelectEvent}
                            onEditEvent={onEditEvent}
                            onDeleteEvent={onDeleteEvent}
                            unreadCount={unreadNotifications[event.id] || 0}
                            onMarkRead={handleMarkRead}
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

export { ExistingEventsSection }
