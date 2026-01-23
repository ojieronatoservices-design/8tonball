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
                .select('tibs_balance, is_admin, is_host_eligible')
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
                    console.error('[syncProfile] Error creating profile:', insertError.code, insertError.message, insertError.details)
                    showToast(`Profile sync failed: ${insertError.message}`, 'error')
                } else {
                    console.log('[syncProfile] Profile created successfully:', insertData)
                    showToast('Welcome! Your profile has been created.', 'success')
                }
            } else if (fetchError) {
                console.error('[syncProfile] Error fetching profile:', fetchError.code, fetchError.message)
            } else if (profile) {
                setBalance(profile.tibs_balance)
                setIsAdmin(profile.is_admin || false)
                setIsHostEligible(profile.is_host_eligible || false)
            }
        } catch (err: any) {
            console.error('[syncProfile] Unexpected error:', err?.message || err)
            showToast('Failed to sync profile. Please try again.', 'error')
        } finally {
            setIsSyncing(false)
        }
    }


    useEffect(() => {
        let channel: any = null

        const setupSubscription = async () => {
            if (isLoaded && user) {
                syncProfile()

                const supabaseClient = await getClient()
                if (!supabaseClient) return

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
                                    "flex flex-col items-center gap-1 transition-all duration-200",
                                    isActive ? "text-primary scale-110" : "text-white/40 hover:text-white/60",
                                    isDisabled && "opacity-20 cursor-not-allowed"
                                )}
                                onClick={(e) => {
                                    if (isDisabled) {
                                        e.preventDefault()
                                        // Trigger sign in
                                    }
                                }}
                            >
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}

