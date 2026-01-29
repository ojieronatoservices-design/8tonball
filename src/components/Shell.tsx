"use client"

import React, { useEffect, useState } from 'react'
import { Wallet, Trophy, Bell, User, LayoutDashboard, Loader2, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useUser, SignInButton, UserButton, useClerk } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useToast } from '@/components/Toast'
import { Trophy as TrophyIcon } from 'lucide-react'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface ShellProps {
    children: React.ReactNode
}

export function Shell({ children }: ShellProps) {
    const pathname = usePathname()
    const { user, isLoaded } = useUser()
    const { signOut } = useClerk()
    const { getClient } = useSupabase()
    const { showToast } = useToast()
    const [balance, setBalance] = useState<number>(0)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isHostEligible, setIsHostEligible] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [showLegalModal, setShowLegalModal] = useState(false)

    const isAuthPage = pathname === '/login'

    const syncProfile = async () => {
        if (!user) return
        const supabaseClient = await getClient()
        if (!supabaseClient) {
            console.error('[syncProfile] Failed to get Supabase client')
            return
        }

        setIsSyncing(true)
        try {
            // Check if profile exists
            const { data: profile, error: fetchError } = await supabaseClient
                .from('profiles')
                .select('tibs_balance, is_admin, is_host_eligible, terms_accepted, age_verified')
                .eq('id', user.id)
                .single()

            if (fetchError && fetchError.code === 'PGRST116') {
                // Profile doesn't exist, create it
                console.log('[syncProfile] Creating new profile for user:', user.id)
                const { data: insertData, error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.primaryEmailAddress?.emailAddress,
                        display_name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0],
                    }])
                    .select()

                if (insertError) {
                    console.error('[syncProfile] Error creating profile')
                    showToast(`Profile sync failed`, 'error')
                } else {
                    console.log('[syncProfile] Profile created successfully')
                    showToast('Welcome! Your profile has been created.', 'success')
                    setShowLegalModal(true)
                }
            } else if (fetchError) {
                console.error('[syncProfile] Error fetching profile:', fetchError.code, fetchError.message)
            } else if (profile) {
                setBalance(profile.tibs_balance)
                setIsAdmin(profile.is_admin || false)
                setIsHostEligible(profile.is_host_eligible || false)

                // Show modal if not accepted
                if (!profile.terms_accepted || !profile.age_verified) {
                    setShowLegalModal(true)
                }
            }
        } catch (err: any) {
            console.error('[syncProfile] Unexpected error:', err?.message || err)
            showToast('Failed to sync profile. Please try again.', 'error')
        } finally {
            setIsSyncing(false)
        }
    }

    const handleAcceptLegal = async () => {
        if (!user) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({
                    terms_accepted: true,
                    age_verified: true
                })
                .eq('id', user.id)

            if (error) throw error
            setShowLegalModal(false)
            showToast('Terms accepted. Welcome to 8TONBALL!', 'success')
        } catch (err) {
            console.error('[handleAcceptLegal] Error:', err)
            showToast('Failed to save agreement. Please try again.', 'error')
        }
    }


    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        let channel: any = null

        const setupSubscription = async () => {
            if (isLoaded && user) {
                syncProfile()

                const supabaseClient = await getClient()
                if (!supabaseClient) return

                // Check for initial unread notifications (simple count for now)
                const { count } = await supabaseClient
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_read', false)

                if (count) setUnreadCount(count)

                // Subscribe to profile changes
                channel = supabaseClient
                    .channel(`profile:${user.id}`)
                    .on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${user.id}`
                    }, (payload: any) => {
                        if (payload.new && typeof payload.new.tibs_balance === 'number') {
                            setBalance(payload.new.tibs_balance)
                        }
                    })
                    .subscribe()

                // Subscribe to notifications for Winner Alerts
                supabaseClient
                    .channel(`notifications:${user.id}`)
                    .on('postgres_changes', {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    }, (payload: any) => {
                        if (payload.new) {
                            setUnreadCount(prev => prev + 1)
                            if (payload.new.type === 'win') {
                                showToast(`🎉 WINNER ALERT: ${payload.new.message}`, 'success')
                            }
                        }
                    })
                    .subscribe()
            } else if (isLoaded && !user) {
                setBalance(0)
            }
        }

        setupSubscription()

        return () => {
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [isLoaded, user])



    // Build nav items - Admin tab only for admins, Host tab for eligible hosts
    const navItems = [
        { label: 'Feed', href: '/', icon: Trophy },
        { label: 'Wallet', href: '/wallet', icon: Wallet },
        // Only show Admin for admins, or Host for eligible hosts
        ...(isAdmin
            ? [{ label: 'Admin', href: '/admin', icon: LayoutDashboard }]
            : isHostEligible
                ? [{ label: 'Host', href: '/admin', icon: LayoutDashboard }]
                : []),
        { label: 'Activity', href: '/notifications', icon: Bell },
        { label: 'Profile', href: '/profile', icon: User },
    ]

    if (isAuthPage) {
        return <div className="min-h-screen bg-background">{children}</div>
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
            {/* Top Header */}
            <header className="fixed top-0 w-full max-w-lg glass z-50 px-6 py-4 flex justify-between items-center border-b border-white/5">
                <Link href="/">
                    <h1 className="text-xl font-black tracking-tighter text-primary">8TONBALL</h1>
                </Link>
                <div className="flex items-center gap-3">
                    {isLoaded && user ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                <span className="text-sm font-bold text-primary">{balance.toLocaleString()}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-50 font-medium">Tibs</span>
                            </div>
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    ) : isLoaded ? (
                        <SignInButton mode="modal">
                            <button className="text-[10px] font-black uppercase tracking-widest bg-primary text-black px-4 py-1.5 rounded-full">
                                Sign In
                            </button>
                        </SignInButton>
                    ) : (
                        <Loader2 className="animate-spin text-white/20" size={18} />
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="w-full max-w-lg pt-24 pb-32 px-6">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 w-full max-w-lg glass z-50 px-6 py-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        // If not logged in, only allow Home
                        const isDisabled = isLoaded && !user && item.href !== '/'

                        return (
                            <Link
                                key={item.href}
                                href={isDisabled ? '/' : item.href}
                                className={cn(
                                    "flex flex-col items-center gap-1 transition-all duration-200 relative",
                                    isActive ? "text-primary scale-110" : "text-white/40 hover:text-white/60",
                                    isDisabled && "opacity-20 cursor-not-allowed"
                                )}
                                onClick={(e) => {
                                    if (isDisabled) {
                                        e.preventDefault()
                                        // Trigger sign in
                                    }
                                    // Reset badge on click
                                    if (item.label === 'Activity') setUnreadCount(0)
                                }}
                            >
                                <div className="relative">
                                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                    {item.label === 'Activity' && unreadCount > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full border-2 border-black flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
            {/* Legal Consent Modal */}
            {showLegalModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-[#0A0A0B] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                                <TrophyIcon size={40} className="text-primary" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
                                    Welcome to 8TONBALL
                                </h2>
                                <p className="text-white/60 text-sm leading-relaxed">
                                    Before you jump in, please confirm you meet our safety and legal requirements.
                                </p>
                            </div>

                            <div className="w-full space-y-4 py-4">
                                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="mt-1 text-primary">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-white uppercase tracking-tight">Age Verification</p>
                                        <p className="text-xs text-white/50">I confirm that I am at least 18 years of age.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                    <div className="mt-1 text-primary">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-white uppercase tracking-tight">Terms of Service</p>
                                        <p className="text-xs text-white/50 leading-relaxed">
                                            I agree to the <Link href="/terms" className="text-primary underline hover:text-primary/80 transition-colors">Terms of Service</Link> and acknowledge that Tibs are non-refundable digital credits.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAcceptLegal}
                                className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                ACCEPT & CONTINUE
                            </button>

                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">
                                Philippine Digital Safety Standards
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

