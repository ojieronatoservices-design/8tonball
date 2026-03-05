"use client"

import { memo } from 'react'
import { CheckCircle2, Loader2, Phone, MapPin } from 'lucide-react'

const KYCList = memo(({ requests, handleApprove, handleReject, isLoadingKYC, fetchKYC }: { requests: any[], handleApprove: (id: string, uid: string) => void, handleReject: (id: string) => void, isLoadingKYC: boolean, fetchKYC: () => void }) => (
    <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest">Host Applications</h2>
            <button onClick={fetchKYC} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <Loader2 size={18} className={isLoadingKYC ? "animate-spin" : ""} />
            </button>
        </div>
        <div className="flex flex-col gap-4">
            {requests.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-white/5">
                    <CheckCircle2 className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 font-black uppercase tracking-widest text-xs">No pending applications</p>
                </div>
            ) : (
                requests.map((req) => (
                    <div key={req.id} className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                            <div className="grid grid-cols-2 gap-4 w-full md:w-[320px] shrink-0">
                                <div className="flex flex-col gap-2">
                                    <span className="text-[8px] font-black uppercase text-white/20 tracking-widest text-center">ID PHOTO</span>
                                    <div className="aspect-video bg-white/5 rounded-xl overflow-hidden cursor-zoom-in" onClick={() => window.open(req.id_image_url, '_blank')}>
                                        <img src={req.id_image_url} alt="ID" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-[8px] font-black uppercase text-white/20 tracking-widest text-center">SELFIE PHOTO</span>
                                    <div className="aspect-video bg-white/5 rounded-xl overflow-hidden cursor-zoom-in" onClick={() => window.open(req.selfie_image_url, '_blank')}>
                                        <img src={req.selfie_image_url} alt="Selfie" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="font-black text-lg uppercase italic">{req.full_name}</div>
                                <div className="text-white/40 text-[10px] mt-1 font-bold tracking-wider">{req.profiles?.email}</div>
                                <div className="flex flex-col gap-1.5 mt-4">
                                    <div className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg w-fit">
                                        <Phone size={10} className="text-primary" /> {req.phone_number || 'No Phone Provided'}
                                    </div>
                                    <div className="flex items-start gap-2 text-white/40 text-[10px] font-medium leading-relaxed px-1">
                                        <MapPin size={10} className="shrink-0 mt-0.5" /> {req.address}
                                    </div>
                                </div>
                                <div className="text-white/20 text-[10px] mt-4 font-black uppercase tracking-widest border-t border-white/5 pt-2">Applied {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString()}</div>
                            </div>
                            <div className="flex gap-2 shrink-0 self-center">
                                <button onClick={() => handleApprove(req.id, req.user_id)} className="px-6 py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs shadow-lg shadow-primary/10">Approve</button>
                                <button onClick={() => handleReject(req.id)} className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase tracking-widest rounded-xl text-xs">Reject</button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
))
KYCList.displayName = 'KYCList'

export { KYCList }
