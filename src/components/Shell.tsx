"use client"

import React, { useEffect, useState, useRef } from 'react'
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
        let profileChannel: any = null
        let notificationChannel: any = null
        const supabaseRef: { current: any } = { current: null }

        const setupSubscription = async () => {
            if (isLoaded && user) {
                // Stabilize user ID for closures
                const userId = user.id

                // Run profile sync (non-blocking, fire and forget)
                syncProfile()

                const supabaseClient = await getClient()
                if (!supabaseClient) return
                supabaseRef.current = supabaseClient

                // Check for initial unread notifications
                const { count } = await supabaseClient
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('is_read', false)

                if (count) setUnreadCount(count)

                // Subscribe to profile changes
                profileChannel = supabaseClient
                    .channel(`profile:${userId}`)
                    .on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${userId}`
                    }, (payload: any) => {
                        console.log('[Realtime] Profile update:', payload.new?.tibs_balance)
                        if (payload.new && typeof payload.new.tibs_balance === 'number') {
                            setBalance(payload.new.tibs_balance)
                        }
                    })
                    .subscribe()

                // Subscribe to notifications (Match Debugger Logic: event: '*')
                notificationChannel = supabaseClient
                    .channel(`shell-notifications-${userId}`)
                    .on('postgres_changes', {
                        event: '*', // Listen to ALL, filter locally
                        schema: 'public',
                        table: 'notifications'
                    }, (payload: any) => {
                        // Manual Filter for security/correctness (just in case RLS leaks, filtered by user_id)
                        if (payload.new && payload.new.user_id === userId) {
                            if (payload.eventType === 'INSERT') {
                                console.log('[Realtime] Notification INSERT:', payload.new)
                                setUnreadCount(prev => prev + 1)

                                const type = payload.new.type
                                const msg = payload.new.message

                                if (type === 'win') {
                                    showToast(`🎉 WINNER ALERT: ${msg}`, 'success')
                                } else if (type === 'payment') {
                                    showToast(`💰 ${msg}`, 'success')
                                } else {
                                    showToast(`🔔 ${msg}`, 'info')
                                }
                            }
                        }
                    })
                    .subscribe((status: string) => {
                        console.log('[Realtime] Shell Notification Status:', status)
                    })

            } else if (isLoaded && !user) {
                setBalance(0)
            }
        }

        setupSubscription()

        const handleBalanceUpdate = (e: any) => {
            if (typeof e.detail?.balance === 'number') {
                setBalance(e.detail.balance)
            }
        }
        window.addEventListener('balanceUpdate', handleBalanceUpdate)

        return () => {
            if (profileChannel && supabaseRef.current) supabaseRef.current.removeChannel(profileChannel)
            if (notificationChannel && supabaseRef.current) supabaseRef.current.removeChannel(notificationChannel)
            window.removeEventListener('balanceUpdate', handleBalanceUpdate)
        }
    }, [isLoaded, user?.id]) // Stable dependency: user.id instead of user object



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
            <header className="fixed top-0 w-full max-w-lg glass z-50 px-6 py-4 flex justify-between items-center">
                <Link href="/">
                    <h1 className="text-xl font-black tracking-tighter neon-text">8TONBALL</h1>
                </Link>
                <div className="flex items-center gap-3">
                    {isLoaded && user ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full border border-border">
                                <span className="text-sm font-bold neon-text">{balance.toLocaleString()}</span>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tibs</span>
                            </div>
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    ) : isLoaded ? (
                        <SignInButton mode="modal">
                            <button className="text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-4 py-1.5 rounded-full neon-border transition-transform active:scale-95 shadow-sm">
                                Sign In
                            </button>
                        </SignInButton>
                    ) : (
                        <Loader2 className="animate-spin text-muted-foreground" size={18} />
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="w-full max-w-lg pt-24 pb-32 px-6">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 w-full max-w-lg glass z-50 px-6 py-4">
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
                                    isActive ? "neon-text scale-110" : "text-muted-foreground hover:text-foreground",
                                    isDisabled && "opacity-20 cursor-not-allowed"
                                )}
                                onClick={(e) => {
                                    if (isDisabled) {
                                        e.preventDefault()
                                    }
                                    if (item.label === 'Activity') setUnreadCount(0)
                                }}
                            >
                                <div className="relative">
                                    <Icon size={22} strokeWidth={isActive ? 3 : 2} />
                                    {item.label === 'Activity' && unreadCount > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full border-2 border-background flex items-center justify-center">
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
                    <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                                <TrophyIcon size={40} className="text-primary" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight text-foreground uppercase italic underline decoration-primary decoration-4 underline-offset-4">
                                    Welcome to 8TONBALL
                                </h2>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Before you jump in, please confirm you meet our safety and legal requirements.
                                </p>
                            </div>

                            <div className="w-full space-y-4 py-4">
                                <div className="flex items-start gap-4 p-4 bg-muted rounded-xl border border-border">
                                    <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-foreground uppercase tracking-tight">Age Verification</p>
                                        <p className="text-xs text-muted-foreground">I confirm that I am at least 18 years of age.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 bg-muted rounded-xl border border-border">
                                    <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-foreground uppercase tracking-tight">Terms of Service</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            I agree to the <Link href="/terms" className="text-primary underline font-bold hover:text-primary/80 transition-colors">Terms of Service</Link> and acknowledge that Tibs are non-refundable digital credits.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAcceptLegal}
                                className="w-full h-14 bg-foreground text-background font-black uppercase tracking-widest text-sm rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg active:scale-95"
                            >
                                ACCEPT & CONTINUE
                            </button>

                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">
                                Philippine Digital Safety Standards
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

