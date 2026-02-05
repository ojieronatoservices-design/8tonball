"use client"

import React, { useEffect, useState } from 'react'
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams()
    const tibs = searchParams.get('tibs')
    const [showConfetti, setShowConfetti] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => setShowConfetti(false), 3000)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-8 text-center px-6">
            {/* Success Icon */}
            <div className="relative">
                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                    <CheckCircle2 className="text-primary" size={48} />
                </div>
                {showConfetti && (
                    <div className="absolute -top-2 -right-2 animate-bounce">
                        <Sparkles className="text-yellow-400" size={24} />
                    </div>
                )}
            </div>

            {/* Message */}
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <h1 className="text-3xl font-black">Payment Successful!</h1>
                {tibs && (
                    <p className="text-white/60">
                        <span className="text-primary font-black">{tibs} Tibs</span> have been added to your balance.
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                <Link
                    href="/"
                    className="flex-1 py-4 px-6 bg-primary text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                >
                    Enter Raffles
                    <ArrowRight size={18} />
                </Link>
                <Link
                    href="/wallet"
                    className="flex-1 py-4 px-6 bg-white/5 text-white font-bold rounded-2xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                    Back to Wallet
                </Link>
            </div>
        </div>
    )
}
