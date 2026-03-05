"use client"

import { memo } from 'react'
import { Coins, ShieldAlert, Trophy, Users } from 'lucide-react'

const AnalyticsOverview = memo(({ analytics, isAdmin }: { analytics: any, isAdmin: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col gap-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 bg-primary/5 rounded-full -mr-4 -mt-4 group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-center gap-2 text-white/40">
                <Coins size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{isAdmin ? 'Total Revenue' : 'My Revenue'}</span>
            </div>
            <div className="text-2xl font-black text-primary">₱{analytics.totalRevenuePHP.toLocaleString()}</div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">{analytics.totalTibsSpentInEvents.toLocaleString()} Tibs flow</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-white/40">
                <ShieldAlert size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Pending</span>
            </div>
            <div className="text-xl font-black">{analytics.pendingPayments} <span className="text-sm font-bold text-white/40">{isAdmin ? 'Purchases' : 'Entries'}</span></div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Awaiting Verification</p>
        </div>
        <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-white/40">
                <Coins size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">{isAdmin ? 'Payouts' : 'Cash Outs'}</span>
            </div>
            <div className="text-xl font-black">{analytics.pendingPayoutRequests} <span className="text-sm font-bold text-white/40">Requests</span></div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Awaiting Payout</p>
        </div>
        <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-white/40">
                <Trophy size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">{isAdmin ? 'Engagement' : 'Event Stats'}</span>
            </div>
            <div className="text-xl font-black">{analytics.totalEntries.toLocaleString()} <span className="text-sm font-bold text-white/40">Entries</span></div>
            <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">{analytics.totalEvents} Total Events</p>
        </div>

        {isAdmin && (
            <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-white/40">
                    <Users size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Platform Market</span>
                </div>
                <div className="text-xl font-black">{analytics.totalUsers} <span className="text-sm font-bold text-white/40">Members</span></div>
                <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Global Reach</p>
            </div>
        )}
    </div>
))
AnalyticsOverview.displayName = 'AnalyticsOverview'

export { AnalyticsOverview }
