"use client"

import React, { useEffect, useState } from 'react'
import { User, Settings, LogOut, ShieldCheck, Mail, Loader2 } from 'lucide-react'
import { useUser, useAuth, useClerk } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

export default function ProfilePage() {
    const { user, isLoaded: isUserLoaded } = useUser()
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const { signOut } = useClerk()
    const { getClient } = useSupabase()
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchProfile = async () => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoading(true)
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error
            setProfile(data)
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchProfile()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId])

    const handleLogout = async () => {
        await signOut()
        window.location.href = '/'
    }



    const threshold = 8000
    const totalSpent = profile?.total_tibs_spent || 0
    const progress = (totalSpent / threshold) * 100
    const isHostEligible = profile?.is_host_eligible || false

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-white/20 font-black uppercase tracking-widest text-xs">Loading Profile...</p>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <User size={48} className="text-white/10" />
                <p className="text-white/40">Please log in to view your profile.</p>
                <button
                    onClick={() => window.location.href = '/'} // Redirect to home/login
                    className="px-6 py-2 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs"
                >
                    Back to Home
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 pb-10">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <User size={32} className="text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight">{profile.display_name || 'Guest'}</h2>
                    <p className="text-white/40 text-sm">{profile.email}</p>
                </div>
            </div>

            {/* Balance Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-1">Current Balance</p>
                    <div className="text-2xl font-black">{profile.tibs_balance.toLocaleString()}</div>
                    <p className="text-xs text-white/30 font-bold">TIBS</p>
                </div>
                <div className="bg-card p-6 rounded-3xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-white/40 mb-1">Total Spent</p>
                    <div className="text-2xl font-black">{totalSpent.toLocaleString()}</div>
                    <p className="text-xs text-white/30 font-bold">TIBS</p>
                </div>
            </div>

            {/* Hosting Eligibility */}
            <div className="bg-card p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <ShieldCheck className={isHostEligible ? "text-green-500" : "text-white/20"} />
                            Hosting Eligibility
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">8 TONBALL</span>
                    </div>

                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>

                    <p className="text-xs text-white/40 leading-relaxed">
                        {isHostEligible
                            ? "Congratulations! You've spent 8,000 Tibs (8 Tonball). You are now eligible to host your own raffles."
                            : `Spend ${(threshold - totalSpent).toLocaleString()} more Tibs to become eligible to host raffles.`
                        }
                    </p>

                    {isHostEligible && (
                        <button className="mt-2 w-full py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl text-xs flex items-center justify-center gap-2">
                            <Mail size={16} />
                            Email Request to Host
                        </button>
                    )}
                </div>

                {/* Background glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-10 -mt-10" />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
                <button className="w-full p-4 bg-white/5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group">
                    <div className="flex items-center gap-3">
                        <Settings size={20} className="text-white/40 group-hover:text-primary transition-colors" />
                        <span className="font-bold text-sm">Account Settings</span>
                    </div>
                </button>
                <button
                    onClick={handleLogout}
                    className="w-full p-4 bg-white/5 rounded-2xl flex items-center justify-between text-red-500 hover:bg-red-400/10 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <LogOut size={20} />
                        <span className="font-bold text-sm">Log Out</span>
                    </div>
                </button>
            </div>
        </div>
    )
}
