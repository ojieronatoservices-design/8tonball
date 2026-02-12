"use client"

import React, { useState } from 'react'
import { Camera, X, Loader2, Banknote, Coins } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useSearchParams } from 'next/navigation'
import { TibsDisplay } from '@/components/TibsDisplay'

export default function WalletPage() {
    const searchParams = useSearchParams()
    const { userId } = useAuth()
    const [selectedPackage, setSelectedPackage] = useState<{ tibs: number, price: number, label: string } | null>(null)
    const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false)
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null)

    const packages = [
        { tibs: 80, price: 10, label: 'Starter' },
        { tibs: 400, price: 50, label: 'Popular' },
        { tibs: 800, price: 100, label: 'Best Value' },
        { tibs: 8000, price: 1000, label: 'TONBALL' },
    ]

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedPackage || !userId) return

        setReceiptPreview(URL.createObjectURL(file))
        setIsVerifyingReceipt(true)
        setMessage(null)

        try {
            const formData = new FormData()
            formData.append('image', file)
            formData.append('userId', userId)
            formData.append('tibs', selectedPackage.tibs.toString())
            formData.append('price', selectedPackage.price.toString())

            const res = await fetch('/api/verify-receipt', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (data.success) {
                setMessage({ text: `SUCCESS! AI verified your ₱${selectedPackage.price} payment. Tibs added!`, type: 'success' })
                setSelectedPackage(null)
                setReceiptPreview(null)
            } else {
                setMessage({ text: data.message || 'Verification failed. Admin will review manually.', type: 'info' })
            }
        } catch (err) {
            console.error('Receipt upload error:', err)
            setMessage({ text: 'Error connecting to AI. Please try again.', type: 'error' })
        } finally {
            setIsVerifyingReceipt(false)
        }
    }

    return (
        <div className="flex flex-col gap-10 max-w-lg mx-auto pb-20">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-4">Top Up Tibs</h2>
                <p className="text-white/40 text-sm font-medium mt-2">Get Tibs instantly with AI-verified manual payments.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl border text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' :
                    message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                    {message.text}
                </div>
            )}

            {!selectedPackage ? (
                <div className="grid grid-cols-2 gap-4">
                    {packages.map((pkg) => (
                        <button
                            key={pkg.tibs}
                            onClick={() => setSelectedPackage(pkg)}
                            className="p-6 rounded-[2rem] border border-white/5 bg-card hover:border-primary/30 text-left transition-all active:scale-95 group relative overflow-hidden"
                        >
                            <div className="text-[10px] uppercase tracking-widest font-black text-primary mb-2">{pkg.label}</div>
                            <div className="text-3xl font-black mb-1">
                                <TibsDisplay amount={pkg.tibs} showUnit={false} />
                            </div>
                            <div className="text-xs font-bold text-white/40">₱{pkg.price} PHP</div>
                            <div className="absolute top-0 right-0 p-6 bg-primary/5 rounded-full -mr-6 -mt-6 group-hover:bg-primary/10 transition-colors" />
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in slide-in-from-right duration-500 pb-10">
                    <button
                        onClick={() => { setSelectedPackage(null); setReceiptPreview(null); setMessage(null); }}
                        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:opacity-70 w-fit"
                    >
                        <X size={14} /> Back to Packages
                    </button>

                    <div className="p-6 bg-muted rounded-[2rem] border border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black text-white/30 tracking-widest">{selectedPackage.label} Bundle</span>
                            <span className="text-3xl font-black">₱{selectedPackage.price} <span className="text-sm font-bold text-white/20 uppercase">PHP</span></span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-black text-primary tracking-widest">You Receive</span>
                            <div className="text-2xl font-black italic">{selectedPackage.tibs} Tibs</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-6 p-8 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-56 h-56 bg-white rounded-[2rem] p-3 shadow-2xl relative z-10 border border-white/10">
                                <img src="/insta_pay_qr.png" alt="InstaPay QR" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-center space-y-2 relative z-10">
                                <h4 className="text-xl font-black uppercase italic tracking-tight">Step 1: Send Payment</h4>
                                <p className="text-xs text-white/40 px-4">Scan QR code and send exactly <span className="text-foreground font-bold italic underline">₱{selectedPackage.price}</span>.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <h4 className="text-xs font-black uppercase tracking-widest">Step 2: Upload Receipt</h4>
                            </div>

                            <div className="relative">
                                {receiptPreview ? (
                                    <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                                        <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
                                        {isVerifyingReceipt ? (
                                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6">
                                                <div className="relative">
                                                    <Loader2 size={48} className="animate-spin text-primary" />
                                                    <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <p className="text-sm font-black uppercase tracking-[0.2em] text-primary animate-pulse">AI Reading Receipt</p>
                                                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Verifying transaction details...</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setReceiptPreview(null); }}
                                                className="absolute top-6 right-6 w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/90 transition-all border border-white/10 shadow-xl"
                                            >
                                                <X size={20} />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <label className="group relative flex flex-col items-center justify-center gap-6 py-16 px-6 bg-card border-2 border-dashed border-white/5 rounded-[3rem] cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all active:scale-[0.98] overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-white/5">
                                            <Camera size={48} className="text-primary opacity-40 group-hover:opacity-100 group-hover:drop-shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all" />
                                        </div>

                                        <div className="text-center space-y-2 relative z-10">
                                            <p className="text-sm font-black uppercase tracking-widest group-hover:text-primary transition-colors">Select Screenshot</p>
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter leading-relaxed">
                                                Upload your GCash or Maya <br /> confirmation receipt
                                            </p>
                                        </div>

                                        <input type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10 flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <Coins size={16} className="text-primary" />
                            </div>
                            <p className="text-[10px] text-white/50 leading-relaxed font-medium italic">
                                Our AI system will extract the Reference Number and Amount. Once verified, your Tibs will be added to your wallet automatically. Please ensure the screenshot is clear and unedited.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
