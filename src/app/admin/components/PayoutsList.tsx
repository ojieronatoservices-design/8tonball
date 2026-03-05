"use client"

import { memo } from 'react'
import { CheckCircle2, Loader2, Coins } from 'lucide-react'

const PayoutsList = memo(({ payouts, handleApprovePayout, isLoadingPayouts, fetchPayoutRequests }: { payouts: any[], handleApprovePayout: (id: string) => void, isLoadingPayouts: boolean, fetchPayoutRequests: () => void }) => (
    <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest">Pending Cash Outs</h2>
            <button onClick={fetchPayoutRequests} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <Loader2 size={18} className={isLoadingPayouts ? "animate-spin" : ""} />
            </button>
        </div>
        <div className="flex flex-col gap-4">
            {payouts.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-white/5">
                    <CheckCircle2 className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 font-black uppercase tracking-widest text-xs">No pending requests</p>
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

export { PayoutsList }
