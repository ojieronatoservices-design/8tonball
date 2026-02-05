"use client"

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Wallet, Trophy, Bell, User, LayoutDashboard, Loader2, LogOut, Search, X, Plus, QrCode, Upload, Camera, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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

    const router = useRouter()
    const searchParams = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')

    // Update search query when URL changes
    useEffect(() => {
        setSearchQuery(searchParams.get('q') || '')
    }, [searchParams])

    // Sync search query to URL
    const handleSearchChange = (val: string) => {
        setSearchQuery(val)
        const params = new URLSearchParams(searchParams.toString())
        if (val) {
            params.set('q', val)
        } else {
            params.delete('q')
        }
        router.replace(`/?${params.toString()}`, { scroll: false })
    }
    const [showLegalModal, setShowLegalModal] = useState(false)
    const [showWalletModal, setShowWalletModal] = useState(false)
    const [selectedPackage, setSelectedPackage] = useState<number | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<'paymongo' | 'qr' | null>(null)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isProcessingPaymongo, setIsProcessingPaymongo] = useState(false)
    const [isVisible, setIsVisible] = useState(true)
    const lastScrollY = useRef(0)

    useEffect(() => {
        let ticking = false
        // Use a local variable to capture scroll state to avoid unnecessary state updates
        let visible = true

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY
                    const diff = Math.abs(currentScrollY - lastScrollY.current)

                    // Only update visibility if scroll moved enough (e.g. 10px) to prevent jitter
                    if (diff > 10) {
                        const shouldBeVisible = currentScrollY < lastScrollY.current || currentScrollY <= 100
                        if (shouldBeVisible !== visible) {
                            visible = shouldBeVisible
                            setIsVisible(shouldBeVisible)
                        }
                        lastScrollY.current = currentScrollY
                    }
                    ticking = false
                })
                ticking = true
            }
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

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
                // console.log('[syncProfile] Creating new profile for user:', user.id)
                // Check current count for "Incoming 10" bonus (5 existing + next 10 = up to 15)
                const { count } = await supabaseClient
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })

                const registrationBonus = (count || 0) < 15 ? 500 : 0;

                const { data: insertData, error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.primaryEmailAddress?.emailAddress,
                        display_name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0],
                        tibs_balance: registrationBonus
                    }])
                    .select()

                if (insertError) {
                    console.error('[syncProfile] Error creating profile')
                    showToast(`Profile sync failed`, 'error')
                } else {
                    // console.log('[syncProfile] Profile created successfully')
                    if (registrationBonus > 0) {
                        showToast(`Welcome! You've received a ${registrationBonus} TIBS Early Bird bonus!`, 'success')
                    } else {
                        showToast('Welcome! Your profile has been created.', 'success')
                    }
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 200 * 1024 * 1024) {
                showToast('File too large (Max 200MB)', 'error')
                return
            }
            setProofFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setProofPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handlePayMongoCheckout = async () => {
        console.log('Starting PayMongo checkout...', { selectedPackage, userId: user?.id })

        if (!user) {
            showToast('Please sign in to proceed', 'error')
            return
        }
        if (!selectedPackage) {
            showToast('No package selected', 'error')
            return
        }

        setIsProcessingPaymongo(true)
        try {
            const response = await fetch('/api/paymongo/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tibs: selectedPackage, userId: user.id })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('PayMongo API Error:', data);
                // DEBUG: Force alert for API errors
                window.alert(`API Error: ${data.error || 'Unknown error'}`)
                if (data.error && data.error.includes('auth')) {
                    showToast('System Error: Payment configuration missing. Please report to admin.', 'error');
                } else {
                    throw new Error(data.error || 'Failed to create checkout')
                }
                return;
            }

            // Redirect to PayMongo checkout
            if (data.checkout_url) {
                window.location.href = data.checkout_url
            } else {
                window.alert('Error: No checkout URL received from API')
                throw new Error('Invalid response from payment provider')
            }

        } catch (error: any) {
            console.error('PayMongo error:', error)
            window.alert(`Catch Error: ${error.message}`)
            showToast(error.message || 'Error creating checkout', 'error')
        } finally {
            setIsProcessingPaymongo(false)
        }
    }

    const handleSubmitProof = async () => {
        if (!proofFile || !selectedPackage || !user) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsSubmitting(true)
        try {
            const fileExt = proofFile.name.split('.').pop()
            const fileName = `${user.id}-${Date.now()}.${fileExt}`
            const filePath = `proofs/${fileName}`

            const { error: uploadError } = await supabaseClient.storage
                .from('media')
                .upload(filePath, proofFile)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabaseClient.storage
                .from('media')
                .getPublicUrl(filePath)

            const { error: insertError } = await supabaseClient
                .from('transactions')
                .insert([{
                    user_id: user.id,
                    requested_tibs: selectedPackage,
                    proof_image_url: publicUrl,
                    status: 'pending'
                }])

            if (insertError) throw insertError

            showToast('Payment proof submitted! Verification pending.', 'success')
            setProofFile(null)
            setProofPreview(null)
            setSelectedPackage(null)
            setShowWalletModal(false)
        } catch (error: any) {
            console.error('Error submitting proof:', error)
            showToast(error.message || 'Error submitting proof', 'error')
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
                        // console.log('[Realtime] Profile update:', payload.new?.tibs_balance)
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
                                // console.log('[Realtime] Notification INSERT:', payload.new)
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
                        // console.log('[Realtime] Shell Notification Status:', status)
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

        const handleOpenWallet = () => setShowWalletModal(true)
        window.addEventListener('openWallet', handleOpenWallet)

        return () => {
            if (profileChannel && supabaseRef.current) supabaseRef.current.removeChannel(profileChannel)
            if (notificationChannel && supabaseRef.current) supabaseRef.current.removeChannel(notificationChannel)
            window.removeEventListener('balanceUpdate', handleBalanceUpdate)
            window.removeEventListener('openWallet', handleOpenWallet)
        }
    }, [isLoaded, user?.id]) // Stable dependency: user.id instead of user object



    // Build nav items - Admin tab only for admins, Host tab for eligible hosts
    const navItems = useMemo(() => [
        { label: 'Feed', href: '/', icon: Trophy },
        // Unified Admin/Host Tab: Admins see "Admin Hub", everyone else sees "Host Dashboard"
        ...(user
            ? [{
                label: isAdmin ? 'Admin' : 'Host',
                href: '/admin',
                icon: LayoutDashboard
            }]
            : []),
        { label: 'Profile', href: '/profile', icon: User },
    ], [user?.id, isAdmin])

    if (isAuthPage) {
        return <div className="min-h-screen bg-background">{children}</div>
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
            {/* Top Header */}
            <header className={cn(
                "fixed top-0 w-full max-w-3xl glass z-50 flex flex-col transition-transform duration-300 will-change-transform",
                !isVisible && "-translate-y-full",
                pathname === '/' ? "py-3" : "py-4"
            )}>
                <div className="w-full px-6 flex justify-between items-center">
                    <Link href="/">
                        <img src="/logo.png" alt="8TONBALL" className="h-8 object-contain" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {isLoaded && user ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full border border-border">
                                        <span className="text-sm font-bold neon-text">{balance.toLocaleString()}</span>
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tibs</span>
                                    </div>
                                    <button
                                        onClick={() => setShowWalletModal(true)}
                                        className="w-7 h-7 flex items-center justify-center bg-primary rounded-full text-black hover:scale-110 active:scale-95 transition-all shadow-lg"
                                    >
                                        <Plus size={16} strokeWidth={4} />
                                    </button>
                                </div>
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        ) : isLoaded ? (
                            <SignInButton mode="modal">
                                <button className="text-[10px] font-black uppercase tracking-widest bg-primary text-black px-4 py-1.5 rounded-full neon-border transition-transform active:scale-95 shadow-sm">
                                    Sign In
                                </button>
                            </SignInButton>
                        ) : (
                            <Loader2 className="animate-spin text-muted-foreground" size={18} />
                        )}
                    </div>
                </div>

                {/* Search Bar - only on home feed */}
                {pathname === '/' && (
                    <div className="w-full px-6 mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search live events..."
                                className="w-full bg-muted/40 border border-border hover:border-primary/20 focus:border-primary/50 rounded-xl py-2 pl-9 pr-8 text-xs font-medium focus:outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className={cn(
                "w-full max-w-3xl pb-32 px-6 transition-all duration-300 animate-in fade-in zoom-in-95 duration-500",
                pathname === '/' ? "pt-32" : "pt-24"
            )}>
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className={cn(
                "fixed bottom-0 w-full max-w-3xl glass z-50 px-6 py-4 transition-transform duration-300",
                !isVisible && "translate-y-full"
            )}>
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
            {/* Wallet Modal */}
            {showWalletModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-sm rounded-[2.5rem] border border-border p-8 flex flex-col gap-6 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight text-foreground uppercase italic underline decoration-primary decoration-4 underline-offset-4">Top Up Tibs</h3>
                            <button onClick={() => { setShowWalletModal(false); setPaymentMethod(null); setSelectedPackage(null); }} className="w-8 h-8 bg-muted flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        {!selectedPackage ? (
                            <div className="grid grid-cols-2 gap-3">
                                {packages.map((pkg) => (
                                    <button
                                        key={pkg.tibs}
                                        onClick={() => { setSelectedPackage(pkg.tibs); setPaymentMethod(null); }}
                                        className="p-4 rounded-3xl border border-white/5 bg-card hover:border-primary/30 text-left transition-all active:scale-95 group"
                                    >
                                        <div className="text-[8px] uppercase tracking-widest font-black text-primary mb-1">{pkg.label}</div>
                                        <div className="text-xl font-black">{pkg.tibs}</div>
                                        <div className="text-[10px] font-bold text-white/40">{pkg.price} PHP</div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                                <button
                                    onClick={() => { setSelectedPackage(null); setPaymentMethod(null); }}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:gap-2 transition-all w-fit"
                                >
                                    ← Back to packages
                                </button>

                                {/* Payment Method Selection */}
                                <div className="flex flex-col gap-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Choose Payment Method</label>
                                    <div className="flex flex-col gap-2">
                                        {/* PayMongo Option */}
                                        <button
                                            onClick={() => setPaymentMethod('paymongo')}
                                            className={`p-4 rounded-3xl border text-left transition-all duration-200 ${paymentMethod === 'paymongo'
                                                ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/50'
                                                : 'bg-card border-white/5 hover:border-blue-500/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === 'paymongo' ? 'bg-blue-500/30' : 'bg-white/5'}`}>
                                                    <Wallet className={paymentMethod === 'paymongo' ? 'text-blue-400' : 'text-white/40'} size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm">Card / GCash / Maya</div>
                                                    <div className="text-[10px] text-white/40 flex items-center gap-1">Fast & Secure</div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* QR Option */}
                                        <button
                                            onClick={() => setPaymentMethod('qr')}
                                            className={`p-4 rounded-3xl border text-left transition-all duration-200 ${paymentMethod === 'qr'
                                                ? 'bg-gradient-to-br from-primary/20 to-yellow-500/20 border-primary/50'
                                                : 'bg-card border-white/5 hover:border-primary/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === 'qr' ? 'bg-primary/30' : 'bg-white/5'}`}>
                                                    <QrCode className={paymentMethod === 'qr' ? 'text-primary' : 'text-white/40'} size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm">QR Ph</div>
                                                    <div className="text-[10px] text-white/40">Any bank or e-wallet via manual verification</div>
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
                                            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                        >
                                            {isProcessingPaymongo ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    Pay {packages.find(p => p.tibs === selectedPackage)?.price} PHP Now
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* QR Flow */}
                                {paymentMethod === 'qr' && (
                                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                        <div className="p-4 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center text-center gap-4">
                                            <div className="bg-white rounded-2xl overflow-hidden w-48 h-48 relative flex items-center justify-center">
                                                <img src="/code_ryR7XuoSc86641e9EvUyjSAs.jpg" alt="QR Ph Payment" className="w-full h-full object-cover scale-[1.3]" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm">Scan with Any Bank App</h4>
                                                <p className="text-white/40 text-[10px] mt-1">Pay <span className="text-white font-bold">{packages.find(p => p.tibs === selectedPackage)?.price} PHP</span> via <span className="text-primary font-black uppercase">QR Ph</span></p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {proofPreview ? (
                                                <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/10 group">
                                                    <img src={proofPreview} alt="Proof" className="w-full h-full object-cover" />
                                                    <button
                                                        onClick={() => { setProofFile(null); setProofPreview(null); }}
                                                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <label className="flex flex-col items-center justify-center gap-2 p-6 bg-muted/40 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/20 cursor-pointer transition-all">
                                                        <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                                                        <Camera className="text-white/20" size={20} />
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Camera</span>
                                                    </label>
                                                    <label className="flex flex-col items-center justify-center gap-2 p-6 bg-muted/40 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/20 cursor-pointer transition-all">
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                                        <ImageIcon className="text-white/20" size={20} />
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Photos</span>
                                                    </label>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleSubmitProof}
                                                disabled={!proofFile || isSubmitting}
                                                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                                            >
                                                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                                                {isSubmitting ? 'PROCESSING...' : 'SUBMIT PROOF'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

