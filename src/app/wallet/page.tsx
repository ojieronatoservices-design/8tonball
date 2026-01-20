"use client"

import React, { useState } from 'react'
import { QrCode, Upload, Info, CheckCircle2, Camera, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

export default function WalletPage() {
    const [selectedPackage, setSelectedPackage] = useState<number | null>(null)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { userId, isSignedIn } = useAuth()
    const { getClient } = useSupabase()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setProofFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setProofPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmitProof = async () => {
        if (!proofFile || !selectedPackage || !userId) return

        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsSubmitting(true)
        try {
            // 1. Upload Proof to Supabase Storage
            const fileExt = proofFile.name.split('.').pop()
            const fileName = `${userId}-${Date.now()}.${fileExt}`
            const filePath = `proofs/${fileName}`

            const { error: uploadError } = await supabaseClient.storage
                .from('media')
                .upload(filePath, proofFile)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabaseClient.storage
                .from('media')
                .getPublicUrl(filePath)

            // 2. Create Transaction record
            const { error: insertError } = await supabaseClient
                .from('transactions')
                .insert([{
                    user_id: userId,
                    requested_tibs: selectedPackage,
                    proof_image_url: publicUrl,
                    status: 'pending'
                }])

            if (insertError) throw insertError

            alert('Payment proof submitted! We will verify it shortly.')
            // Reset
            setProofFile(null)
            setProofPreview(null)
            setSelectedPackage(null)

        } catch (error: any) {
            console.error('Error submitting proof:', error)
            alert(error.message || 'Error submitting proof. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }



    const packages = [
        { tibs: 80, price: 10, label: 'Starter' },
        { tibs: 400, price: 50, label: 'Popular' },
        { tibs: 800, price: 100, label: 'Best Value' },
        { tibs: 8000, price: 1000, label: 'TONBALL' },
    ]

    return (
        <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tight">Buy Tibs</h2>
                <p className="text-white/40 text-sm">Select a package and pay via QR.</p>
            </div>

            {/* Package Selection */}
            <div className="grid grid-cols-2 gap-4">
                {packages.map((pkg) => (
                    <button
                        key={pkg.tibs}
                        onClick={() => setSelectedPackage(pkg.tibs)}
                        className={`p-5 rounded-3xl border text-left transition-all duration-200 ${selectedPackage === pkg.tibs
                            ? 'bg-primary border-transparent text-black scale-105'
                            : 'bg-card border-white/5 text-white hover:border-primary/30'
                            }`}
                    >
                        <div className={`text-[10px] uppercase tracking-widest font-black mb-1 ${selectedPackage === pkg.tibs ? 'text-black/60' : 'text-primary'
                            }`}>
                            {pkg.label}
                        </div>
                        <div className="text-2xl font-black">{pkg.tibs}</div>
                        <div className={`text-xs font-bold ${selectedPackage === pkg.tibs ? 'text-black/60' : 'text-white/40'
                            }`}>
                            {pkg.price} PHP
                        </div>
                    </button>
                ))}
            </div>

            {selectedPackage && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center text-center gap-4">
                        {/* QR Container - Masked to hide bank/name */}
                        <div className="relative w-64 h-64 bg-white rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 p-2">
                            <div className="absolute top-[-80px] left-0 w-full">
                                <img src="/qr.jpg" alt="Payment QR" className="w-full object-contain" />
                            </div>

                            {/* Overlay for Account Number */}
                            <div className="absolute top-0 left-0 w-full pt-1 pb-1 bg-white flex flex-col items-center justify-center">
                                <span className="text-[10px] font-black text-black/40 tracking-wider">•••••••• 2142</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-lg">Scan to Pay</h4>
                            <p className="text-white/40 text-xs mt-1">Pay exactly <span className="text-white font-bold">{packages.find(p => p.tibs === selectedPackage)?.price} PHP</span> via <span className="text-primary font-black uppercase">InstaPay</span></p>
                        </div>
                    </div>


                    <div className="flex flex-col gap-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Upload Proof</label>

                        {proofPreview ? (
                            <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/10 bg-card group">
                                <img src={proofPreview} alt="Proof Preview" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => { setProofFile(null); setProofPreview(null); }}
                                    className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full flex items-center justify-center border border-white/20 hover:bg-black/80 transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col items-center justify-center gap-3 p-8 bg-card rounded-3xl border-2 border-dashed border-white/10 hover:border-primary/40 cursor-pointer transition-all group">
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileChange}
                                    />
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Camera className="text-white/40 group-hover:text-primary" size={24} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Use Camera</span>
                                </label>

                                <label className="flex flex-col items-center justify-center gap-3 p-8 bg-card rounded-3xl border-2 border-dashed border-white/10 hover:border-primary/40 cursor-pointer transition-all group">
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <ImageIcon className="text-white/40 group-hover:text-primary" size={24} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">From Photos</span>
                                </label>
                            </div>
                        )}

                        <button
                            onClick={handleSubmitProof}
                            disabled={!proofFile || isSubmitting}
                            className={`w-full py-4 font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${proofFile && !isSubmitting
                                ? 'bg-primary text-black shadow-primary/10'
                                : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                                }`}
                        >
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                            {isSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
                        </button>
                    </div>


                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex gap-3">
                        <Info size={20} className="text-primary shrink-0" />
                        <p className="text-[11px] text-primary/80 leading-relaxed italic">
                            Payments are manually verified by our team. Your Tibs will be credited once the screenshot is approved. Usually takes 5-30 mins.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
