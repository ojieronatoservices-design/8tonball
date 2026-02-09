"use client"

import React, { useState } from 'react'
import { CreditCard, QrCode, Info, Camera, Image as ImageIcon, X, Loader2, Zap } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useSearchParams } from 'next/navigation'

export default function WalletPage() {
    const searchParams = useSearchParams()
    const [isProcessingPaymongo, setIsProcessingPaymongo] = useState<number | null>(null)
    const { userId, isSignedIn } = useAuth()
    const { getClient } = useSupabase()

    const cancelled = searchParams.get('cancelled')

    const handlePayMongoCheckout = async (tibsAmount: number) => {
        if (!userId) {
            alert('Please log in to purchase Tibs.')
            return
        }

        setIsProcessingPaymongo(tibsAmount)
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tibs: tibsAmount, userId })
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
            setIsProcessingPaymongo(null)
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
                        onClick={() => handlePayMongoCheckout(pkg.tibs)}
                        disabled={isProcessingPaymongo !== null}
                        className={`p-5 rounded-3xl border text-left transition-all duration-200 relative overflow-hidden group ${isProcessingPaymongo === pkg.tibs
                            ? 'bg-primary border-transparent text-black scale-105'
                            : 'bg-card border-white/5 text-white hover:border-primary/30 active:scale-95'
                            } ${isProcessingPaymongo !== null && isProcessingPaymongo !== pkg.tibs ? 'opacity-50 grayscale' : ''}`}
                    >
                        {isProcessingPaymongo === pkg.tibs && (
                            <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in duration-300">
                                <Loader2 size={24} className="animate-spin text-black" />
                            </div>
                        )}
                        <div className={`text-[10px] uppercase tracking-widest font-black mb-1 ${isProcessingPaymongo === pkg.tibs ? 'text-black/60' : 'text-primary'
                            }`}>
                            {pkg.label}
                        </div>
                        <div className="text-2xl font-black">{pkg.tibs}</div>
                        <div className={`text-xs font-bold ${isProcessingPaymongo === pkg.tibs ? 'text-black/60' : 'text-white/40'
                            }`}>
                            {pkg.price} PHP
                        </div>
                    </button>
                ))}
            </div>

        </div>
    )
}
