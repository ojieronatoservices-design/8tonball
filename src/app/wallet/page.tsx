"use client"

import React, { useState } from 'react'
import { CreditCard, QrCode, Info, Camera, Image as ImageIcon, X, Loader2, Zap } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useSearchParams } from 'next/navigation'

export default function WalletPage() {
    const searchParams = useSearchParams()
    const [selectedPackage, setSelectedPackage] = useState<number | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<'paymongo' | 'qr' | null>(null)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isProcessingPaymongo, setIsProcessingPaymongo] = useState(false)
    const { userId, isSignedIn } = useAuth()
    const { getClient } = useSupabase()

    const cancelled = searchParams.get('cancelled')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // 200MB Limit Check
            if (file.size > 200 * 1024 * 1024) {
                alert('⚠️ FILE TOO LARGE: Your proof image exceeds the 200MB limit. Please take a smaller screenshot.')
                return
            }
            setProofFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setProofPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handlePayMongoCheckout = async () => {
        if (!selectedPackage || !userId) return

        setIsProcessingPaymongo(true)
        try {
            const response = await fetch('/api/paymongo/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tibs: selectedPackage, userId })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout')
            }

            // Redirect to PayMongo checkout
            window.location.href = data.checkout_url

        } catch (error: any) {
            console.error('PayMongo error:', error)
            alert(error.message || 'Error creating checkout. Please try again.')
        } finally {
            setIsProcessingPaymongo(false)
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
            setPaymentMethod(null)

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
                <p className="text-white/40 text-sm">Select a package and choose how to pay.</p>
            </div>

            {cancelled && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm">
                    Payment was cancelled. You can try again below.
                </div>
            )}

            {/* Package Selection */}
            <div className="grid grid-cols-2 gap-4">
                {packages.map((pkg) => (
                    <button
                        key={pkg.tibs}
                        onClick={() => { setSelectedPackage(pkg.tibs); setPaymentMethod(null); }}
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
                    {/* Payment Method Selection */}
                    <div className="flex flex-col gap-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Choose Payment Method</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* PayMongo Option */}
                            <button
                                onClick={() => setPaymentMethod('paymongo')}
                                className={`p-5 rounded-3xl border text-left transition-all duration-200 ${paymentMethod === 'paymongo'
                                    ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/50'
                                    : 'bg-card border-white/5 hover:border-blue-500/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === 'paymongo' ? 'bg-blue-500/30' : 'bg-white/5'}`}>
                                        <CreditCard className={paymentMethod === 'paymongo' ? 'text-blue-400' : 'text-white/40'} size={20} />
                                    </div>
                                    <div>
                                        <div className="font-black text-sm">Card / GCash / Maya</div>
                                        <div className="text-[10px] text-white/40 flex items-center gap-1">
                                            <Zap size={10} className="text-yellow-400" /> Instant
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* QR Ph Option */}
                            <button
                                onClick={() => setPaymentMethod('qr')}
                                className={`p-5 rounded-3xl border text-left transition-all duration-200 ${paymentMethod === 'qr'
                                    ? 'bg-gradient-to-br from-primary/20 to-yellow-500/20 border-primary/50'
                                    : 'bg-card border-white/5 hover:border-primary/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === 'qr' ? 'bg-primary/30' : 'bg-white/5'}`}>
                                        <QrCode className={paymentMethod === 'qr' ? 'text-primary' : 'text-white/40'} size={20} />
                                    </div>
                                    <div>
                                        <div className="font-black text-sm">QR Ph</div>
                                        <div className="text-[10px] text-white/40">Any bank or e-wallet</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* PayMongo Flow */}
                    {paymentMethod === 'paymongo' && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <button
                                onClick={handlePayMongoCheckout}
                                disabled={isProcessingPaymongo}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessingPaymongo ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={18} />
                                        Pay {packages.find(p => p.tibs === selectedPackage)?.price} PHP
                                    </>
                                )}
                            </button>

                            <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 flex gap-3">
                                <Info size={20} className="text-blue-400 shrink-0" />
                                <p className="text-[11px] text-blue-400/80 leading-relaxed">
                                    You&apos;ll be redirected to PayMongo&apos;s secure checkout. Tibs are credited instantly after payment.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* QR Flow */}
                    {paymentMethod === 'qr' && (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center text-center gap-4">
                                {/* QR Ph Container */}
                                <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 w-64 h-64 relative flex items-center justify-center bg-white">
                                    <img src="/code_ryR7XuoSc86641e9EvUyjSAs.jpg" alt="QR Ph Payment" className="w-full h-full object-cover scale-[1.3]" />
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg">Scan with Any Bank App</h4>
                                    <p className="text-white/40 text-xs mt-1">Pay exactly <span className="text-white font-bold">{packages.find(p => p.tibs === selectedPackage)?.price} PHP</span> via <span className="text-primary font-black uppercase">QR Ph</span></p>
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
            )}
        </div>
    )
}
