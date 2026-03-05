"use client"

import { memo } from 'react'
import { CheckCircle2, Loader2, Coins } from 'lucide-react'
import { cn } from '../utils'

const PaymentsList = memo(({ payments, handleApprove, handleReject, isLoadingPayments, fetchPayments }: { payments: any[], handleApprove: (id: string) => void, handleReject: (id: string) => void, isLoadingPayments: boolean, fetchPayments: () => void }) => (
    <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest">Pending Purchases</h2>
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
                payments.map((payment) => {
                    const aiData = payment.metadata?.ai_extracted
                    const failureReason = payment.metadata?.failure_reason
                    const isMismatched = failureReason && failureReason.includes('Amount mismatch')

                    return (
                        <div key={payment.id} className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-24 h-32 bg-white/5 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer border border-white/10" onClick={() => window.open(payment.proof_image_url, '_blank')}>
                                <img src={payment.proof_image_url} alt="Receipt" className="w-full h-full object-cover" />
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm py-1 text-[8px] text-center font-bold uppercase tracking-widest">Click to Zoom</div>
                            </div>
                            <div className="flex-1 w-full">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <div className="font-black text-lg uppercase italic leading-none">{payment.profiles?.display_name || 'Anonymous'}</div>
                                        <div className="text-white/40 text-[10px] font-bold mt-1 tracking-wider uppercase">{payment.profiles?.email}</div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                                            <Coins size={12} className="text-primary" />
                                            <span className="text-primary font-black text-xs">{payment.requested_tibs} TIBS</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-white/20 mt-1 uppercase tracking-widest">Expected ₱{payment.requested_tibs / 8}</div>
                                    </div>
                                </div>

                                {aiData && (
                                    <div className="mt-4 grid grid-cols-2 gap-2 p-3 bg-white/[0.02] rounded-2xl border border-white/5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">AI Extracted Ref</span>
                                            <span className="text-[11px] font-mono text-white/70">{aiData.reference_number || 'NOT FOUND'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">AI Extracted Amount</span>
                                            <span className={cn(
                                                "text-[11px] font-black uppercase tracking-tight",
                                                isMismatched ? "text-red-500" : "text-primary"
                                            )}>
                                                ₱{aiData.amount || '0'}
                                                {isMismatched && <span className="ml-1 text-[8px] animate-pulse">(! MISMATCH)</span>}
                                            </span>
                                        </div>
                                        {failureReason && (
                                            <div className="col-span-2 mt-2 pt-2 border-t border-white/5">
                                                <div className="text-[8px] font-black text-red-500/60 uppercase tracking-widest mb-1">AI Audit Result</div>
                                                <p className="text-[10px] text-red-400 italic">⚠️ {failureReason}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 w-full md:w-auto">
                                <button onClick={() => handleApprove(payment.id)} className="w-full px-6 py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs shadow-lg shadow-primary/10 active:scale-95 transition-all">Approve</button>
                                <button onClick={() => handleReject(payment.id)} className="w-full px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase tracking-widest rounded-xl text-xs hover:bg-red-500/20 active:scale-95 transition-all">Reject</button>
                            </div>
                        </div>
                    )
                })
            )}
        </div>
    </div>
))
PaymentsList.displayName = 'PaymentsList'

export { PaymentsList }
