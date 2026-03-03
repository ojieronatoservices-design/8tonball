"use client"

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Wallet, Trophy, Bell, User, LayoutDashboard, Loader2, LogOut, Search, X, Plus, QrCode, Upload, Camera, Image as ImageIcon, Compass, Menu, Banknote, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useUser, SignInButton, UserButton, useClerk } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useToast } from '@/components/Toast'
import { Trophy as TrophyIcon } from 'lucide-react'
import { TibsDisplay } from '@/components/TibsDisplay'

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
    const [legalCheckboxes, setLegalCheckboxes] = useState({
        age: false,
        residency: false,
        terms: false
    })
    const [showWalletModal, setShowWalletModal] = useState(false)
    const [isProcessingPaymongo, setIsProcessingPaymongo] = useState<number | null>(null)
    const [isVisible, setIsVisible] = useState(true)
    const lastScrollY = useRef(0)

    // Burger menu state
    const [showBurgerMenu, setShowBurgerMenu] = useState(false)

    // Settle (Payout) modal state
    const [showSettleModal, setShowSettleModal] = useState(false)
    const [settleMethod, setSettleMethod] = useState<'gcash' | 'bank' | 'qr'>('gcash')
    const [settleGcashNumber, setSettleGcashNumber] = useState('')
    const [settleGcashName, setSettleGcashName] = useState('')
    const [settleBankName, setSettleBankName] = useState('')
    const [settleBankAccount, setSettleBankAccount] = useState('')
    const [settleBankHolder, setSettleBankHolder] = useState('')
    const [settleQrFile, setSettleQrFile] = useState<File | null>(null)
    const [settleQrPreview, setSettleQrPreview] = useState<string | null>(null)
    const [settleQrName, setSettleQrName] = useState('')
    const [isSubmittingSettle, setIsSubmittingSettle] = useState(false)

    // Floating button scroll transparency removed

    // Wallet/Manual Payment state
    const [selectedPackage, setSelectedPackage] = useState<{ tibs: number, price: number, label: string } | null>(null)
    const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false)
    const [receiptFile, setReceiptFile] = useState<File | null>(null)
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

    const [showCreateEventModal, setShowCreateEventModal] = useState(false)
    const [showAdModal, setShowAdModal] = useState(false)

    const triggerNotificationToast = useCallback((type: string, message: string) => {
        let emoji = '🔔'
        let toastType: 'success' | 'info' | 'error' = 'info'

        if (type === 'win') {
            emoji = '🎉'
            toastType = 'success'
        } else if (type === 'payment' || type === 'payout') {
            emoji = '💰'
            toastType = 'success'
        } else if (type === 'entry') {
            emoji = '🎟️'
            toastType = 'success'
        } else if (type === 'kyc') {
            emoji = '🛡️'
            toastType = 'info'
        } else {
            // Drop other notification types (comment, reply, vote)
            return
        }

        showToast(`${emoji} ${message}`, toastType)
    }, [showToast])

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
        return () => {
            window.removeEventListener('scroll', handleScroll)
        }
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
                .select('tibs_balance, is_admin, is_host_eligible, terms_accepted, age_verified, avatar_url, display_name')
                .eq('id', user.id)
                .single()

            const userDisplayName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0]
            const userAvatarUrl = user.imageUrl

            if (fetchError && fetchError.code === 'PGRST116') {
                // Profile doesn't exist, create it
                const { count } = await supabaseClient
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })

                const registrationBonus = (count || 0) < 15 ? 500 : 0;

                const { data: insertData, error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.primaryEmailAddress?.emailAddress,
                        display_name: userDisplayName,
                        avatar_url: userAvatarUrl,
                        tibs_balance: registrationBonus
                    }])
                    .select()

                if (insertError) {
                    console.error('[syncProfile] Error creating profile')
                    showToast(`Profile sync failed`, 'error')
                } else {
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

                // Update avatar or name if they changed in Clerk
                if (profile.avatar_url !== userAvatarUrl || profile.display_name !== userDisplayName) {
                    await supabaseClient
                        .from('profiles')
                        .update({
                            avatar_url: userAvatarUrl,
                            display_name: userDisplayName
                        })
                        .eq('id', user.id)
                }

                // Show modal if not accepted
                if (!profile.terms_accepted || !profile.age_verified) {
                    setShowLegalModal(true)
                }
            }
        } catch (err: unknown) {
            console.error('[syncProfile] Unexpected error:', err instanceof Error ? err.message : err)
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


    const handlePackageSelect = (pkg: { tibs: number, price: number, label: string }) => {
        setSelectedPackage(pkg)
    }

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedPackage || !user) return

        setReceiptFile(file)
        setReceiptPreview(URL.createObjectURL(file))
        setIsVerifyingReceipt(true)

        try {
            const formData = new FormData()
            formData.append('image', file)
            formData.append('userId', user.id)
            formData.append('tibs', selectedPackage.tibs.toString())
            formData.append('price', selectedPackage.price.toString())

            const res = await fetch('/api/verify-receipt', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (data.success) {
                showToast(`SUCCESS! AI verified your ₱${selectedPackage.price} payment.`, 'success')
                setBalance(prev => prev + selectedPackage.tibs)
                setShowWalletModal(false)
                setSelectedPackage(null)
                setReceiptFile(null)
                setReceiptPreview(null)
            } else {
                showToast(data.message || 'Verification failed. Admin will review manually.', 'info')
                // Keep modal open but show status
            }
        } catch (err) {
            console.error('Receipt upload error:', err)
            showToast('Error connecting to AI. Please try again.', 'error')
        } finally {
            setIsVerifyingReceipt(false)
        }
    }

    const handlePayMongoCheckout = async (tibsAmount: number) => {
        if (!user) {
            showToast('Please sign in to proceed', 'error')
            return
        }

        setIsProcessingPaymongo(tibsAmount)
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tibs: tibsAmount, userId: user.id })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('PayMongo API Error:', data);
                window.alert(`API Error: ${data.error || 'Unknown error'}\nStatus: ${response.status}`)
                return;
            }

            // Redirect to PayMongo checkout
            if (data.checkout_url) {
                window.location.href = data.checkout_url
            } else {
                window.alert('Error: No checkout URL received from API')
                throw new Error('Invalid response from payment provider')
            }

        } catch (error: unknown) {
            console.error('PayMongo error:', error)
            showToast(error instanceof Error ? error.message : 'Error creating checkout', 'error')
        } finally {
            setIsProcessingPaymongo(null)
        }
    }

    // Settle (payout) handler
    const handleSubmitSettle = async () => {
        if (!user) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        // Validate based on method
        if (settleMethod === 'gcash' && (!settleGcashNumber || !settleGcashName)) {
            showToast('Please fill in GCash details', 'error')
            return
        }
        if (settleMethod === 'bank' && (!settleBankName || !settleBankAccount || !settleBankHolder)) {
            showToast('Please fill in bank details', 'error')
            return
        }
        if (settleMethod === 'qr' && (!settleQrFile || !settleQrName)) {
            showToast('Please upload a QR code and enter your name', 'error')
            return
        }

        setIsSubmittingSettle(true)
        try {
            const payoutDetails: Record<string, any> = { method: settleMethod }

            if (settleMethod === 'gcash') {
                payoutDetails.gcash_number = settleGcashNumber
                payoutDetails.gcash_name = settleGcashName
            } else if (settleMethod === 'bank') {
                payoutDetails.bank_name = settleBankName
                payoutDetails.bank_account = settleBankAccount
                payoutDetails.bank_holder = settleBankHolder
            } else if (settleMethod === 'qr') {
                // Upload QR image
                const fileExt = settleQrFile!.name.split('.').pop()
                const fileName = `qr-${user.id}-${Date.now()}.${fileExt}`
                const { error: upErr } = await supabaseClient.storage.from('media').upload(`payouts/${fileName}`, settleQrFile!)
                if (upErr) throw upErr
                const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(`payouts/${fileName}`)
                payoutDetails.qr_image_url = publicUrl
                payoutDetails.qr_name = settleQrName
            }

            const { error } = await supabaseClient
                .from('payout_requests')
                .insert([{
                    user_id: user.id,
                    amount_tibs: balance,
                    gcash_number: settleMethod === 'gcash' ? settleGcashNumber : null,
                    gcash_name: settleMethod === 'gcash' ? settleGcashName : (settleMethod === 'bank' ? settleBankHolder : settleQrName),
                    payout_details: payoutDetails
                }])

            if (error) throw error

            showToast('Settlement request submitted! Please allow 24-48 hours for processing.', 'success')
            setShowSettleModal(false)
            // Reset form
            setSettleGcashNumber(''); setSettleGcashName(''); setSettleBankName(''); setSettleBankAccount(''); setSettleBankHolder(''); setSettleQrFile(null); setSettleQrPreview(null); setSettleQrName('')
        } catch (error: unknown) {
            console.error('Settle error:', error)
            showToast(error instanceof Error ? error.message : 'Error submitting settlement request', 'error')
        } finally {
            setIsSubmittingSettle(false)
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
                        if (payload.new && typeof payload.new.tibs_balance === 'number') {
                            setBalance(payload.new.tibs_balance)
                        }
                        if (payload.new && typeof payload.new.is_host_eligible === 'boolean') {
                            setIsHostEligible(payload.new.is_host_eligible)
                        }
                    })
                    .subscribe()

                // Subscribe to notifications (Match Debugger Logic: event: '*')
                notificationChannel = supabaseClient
                    .channel(`shell-notifications-${userId}`)
                    .on('postgres_changes', {
                        event: '*', // Listen to ALL (INSERT, UPDATE, DELETE)
                        schema: 'public',
                        table: 'notifications'
                    }, (payload: any) => {
                        // Manual Filter for security/correctness (just in case RLS leaks, filtered by user_id)
                        const isRelevant = (payload.new && payload.new.user_id === userId) ||
                            (payload.old && payload.old.user_id === userId);

                        if (!isRelevant) return;

                        if (payload.eventType === 'INSERT' && !payload.new.is_read) {
                            setUnreadCount(prev => prev + 1)
                            const type = payload.new.type
                            const msg = payload.new.message
                            triggerNotificationToast(type, msg)
                        } else if (payload.eventType === 'UPDATE') {
                            // 1. If it was unread and now it's read
                            if (payload.old.is_read === false && payload.new.is_read === true) {
                                setUnreadCount(prev => Math.max(0, prev - 1))
                            }
                            // 2. If it was read and now it's unread (rare but possible)
                            else if (payload.old.is_read === true && payload.new.is_read === false) {
                                setUnreadCount(prev => prev + 1)
                                triggerNotificationToast(payload.new.type, payload.new.message)
                            }
                            // 3. Collective Update: If still unread but message changed (e.g., "James + 1 other...")
                            else if (!payload.new.is_read && payload.old.message !== payload.new.message) {
                                triggerNotificationToast(payload.new.type, payload.new.message)
                            }
                        } else if (payload.eventType === 'DELETE') {
                            if (payload.old.is_read === false) {
                                setUnreadCount(prev => Math.max(0, prev - 1))
                            }
                        }
                    })
                    .subscribe()

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

        const handleNotificationsRead = () => setUnreadCount(0)
        window.addEventListener('notificationsRead', handleNotificationsRead)

        return () => {
            if (profileChannel && supabaseRef.current) supabaseRef.current.removeChannel(profileChannel)
            if (notificationChannel && supabaseRef.current) supabaseRef.current.removeChannel(notificationChannel)
            window.removeEventListener('balanceUpdate', handleBalanceUpdate)
            window.removeEventListener('openWallet', handleOpenWallet)
            window.removeEventListener('notificationsRead', handleNotificationsRead)
        }
    }, [isLoaded, user?.id]) // Stable dependency: user.id instead of user object



    // Build nav items - Simplifed to Discover and You (Activity moved to bell/other or replaced)
    const navItems = useMemo(() => [
        { label: 'Discover', href: '/', icon: Compass },
        { label: 'You', href: '/profile', icon: User },
    ], [])

    if (isAuthPage) {
        return <div className="min-h-screen bg-background">{children}</div>
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
            {/* Top Header */}
            <header className={cn(
                "fixed top-0 w-full max-w-3xl glass z-50 flex flex-col transition-transform duration-300 will-change-transform",
                !isVisible && "-translate-y-full",
                pathname === '/' ? "py-1.5" : "py-2"
            )}>
                <div className="w-full px-4 flex justify-between items-center">
                    <Link href="/">
                        <img src="/logo.png" alt="8TONBALL" className="h-5 object-contain" />
                    </Link>
                    <div className="flex items-center gap-2">
                        {isLoaded && user ? (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                    <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full border border-border">
                                        <TibsDisplay
                                            amount={balance}
                                            className="text-xs font-bold neon-text"
                                            showUnit={true}
                                            unitClassName="text-[8px] uppercase tracking-wider text-muted-foreground font-medium"
                                        />
                                    </div>
                                    {/* Burger menu button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
                                            className="w-5 h-5 flex items-center justify-center bg-primary rounded-full text-black hover:scale-110 active:scale-95 transition-all shadow-lg"
                                        >
                                            <Menu size={12} strokeWidth={3} />
                                        </button>
                                        {/* Dropdown */}
                                        {showBurgerMenu && (
                                            <>
                                                <div className="fixed inset-0 z-[90]" onClick={() => setShowBurgerMenu(false)} />
                                                <div className="absolute right-0 top-7 z-[91] bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 min-w-[140px]">
                                                    <button
                                                        onClick={() => { setShowBurgerMenu(false); setShowWalletModal(true) }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted/60 transition-colors"
                                                    >
                                                        <Plus size={12} className="text-primary" />
                                                        Top Up
                                                    </button>
                                                    <div className="h-px bg-border" />
                                                    <button
                                                        onClick={() => { setShowBurgerMenu(false); setShowAdModal(true) }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted/60 transition-colors"
                                                    >
                                                        <TrophyIcon size={12} className="text-primary" />
                                                        Rewards
                                                    </button>

                                                    <div className="h-px bg-border" />
                                                    <button
                                                        onClick={() => {
                                                            setShowBurgerMenu(false);
                                                            if (!isHostEligible && !isAdmin) {
                                                                showToast('Complete KYC verification to unlock settlements', 'error')
                                                                return
                                                            }
                                                            setShowSettleModal(true)
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted/60 transition-colors"
                                                    >
                                                        <Banknote size={12} className="text-primary" />
                                                        Settle
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        ) : isLoaded ? (
                            <SignInButton mode="modal">
                                <button className="text-[8px] font-black uppercase tracking-widest bg-primary text-black px-3 py-1 rounded-full neon-border transition-transform active:scale-95 shadow-sm">
                                    Sign In
                                </button>
                            </SignInButton>
                        ) : (
                            <Loader2 className="animate-spin text-muted-foreground" size={14} />
                        )}
                    </div>
                </div>

                {/* Search Bar - only on home feed */}
                {pathname === '/' && (
                    <div className="w-full px-4 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={12} />
                            <input
                                type="text"
                                placeholder="Search live events..."
                                className="w-full bg-muted/40 border border-border hover:border-primary/20 focus:border-primary/50 rounded-lg py-1.5 pl-8 pr-7 text-[11px] font-medium focus:outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className={cn(
                "w-full max-w-3xl pb-24 px-6 transition-all duration-300 animate-in fade-in zoom-in-95 duration-500",
                pathname === '/' ? "pt-20" : "pt-14"
            )}>
                {children}
            </main>

            {/* Floating Create Event Button - Centered and Peeking */}
            {isLoaded && user && (isHostEligible || isAdmin) && (
                <button
                    onClick={() => setShowCreateEventModal(true)}
                    className={cn(
                        "fixed left-1/2 -translate-x-1/2 z-[60] w-20 h-20 rounded-full shadow-2xl transition-all duration-300 group overflow-hidden border-2 border-primary/50 bg-black/40 backdrop-blur-sm",
                        isVisible ? "bottom-4 scale-100 opacity-100" : "-bottom-14 scale-90 hover:scale-100 hover:bottom-4 opacity-100", // Peeking logic: only 30% visible
                        "shadow-[0_0_30px_rgba(57,255,20,0.4)]"
                    )}
                >
                    <img src="/logo-8t.png" alt="Create Event" className="w-full h-full object-cover p-2" />
                    {/* Circular text around the button */}
                    <svg className="absolute inset-0 w-full h-full animate-spin-slow" viewBox="0 0 80 80">
                        <defs>
                            <path id="circle-path" d="M40,40 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" />
                        </defs>
                        <text className="fill-primary text-[6px] font-black uppercase tracking-[0.5em]">
                            <textPath href="#circle-path" startOffset="0%">
                                CREATE EVENT • CREATE EVENT •
                            </textPath>
                        </text>
                    </svg>
                </button>
            )}

            {/* Bottom Navigation */}
            <nav className={cn(
                "fixed bottom-0 w-full max-w-3xl glass z-50 px-4 py-2 transition-transform duration-300",
                !isVisible && "translate-y-full"
            )}>
                <div className="flex w-full items-center">
                    {/* Left Wing - Discover */}
                    <div className="flex-1 flex justify-center">
                        {(() => {
                            const item = navItems[0]
                            const Icon = item.icon
                            const isActive = pathname === '/'
                            return (
                                <Link
                                    href="/"
                                    className={cn(
                                        "flex flex-col items-center gap-0.5 transition-all duration-200 relative",
                                        isActive ? "neon-text scale-110" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Icon size={16} strokeWidth={isActive ? 3 : 2} />
                                    <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
                                </Link>
                            )
                        })()}
                    </div>

                    {/* Center Spacer for Create Event Button (approx 80px) */}
                    <div className="w-20 shrink-0" />

                    {/* Right Wing - You */}
                    <div className="flex-1 flex justify-center">
                        {(() => {
                            const item = navItems[1]
                            const isActive = pathname.startsWith(item.href)
                            const isDisabled = isLoaded && !user
                            return (
                                <Link
                                    href={isDisabled ? '/' : item.href}
                                    className={cn(
                                        "flex flex-col items-center gap-0.5 transition-all duration-200 relative",
                                        isActive ? "neon-text scale-110" : "text-muted-foreground hover:text-foreground",
                                        isDisabled && "opacity-20 cursor-not-allowed"
                                    )}
                                    onClick={(e) => {
                                        if (isDisabled) e.preventDefault()
                                    }}
                                >
                                    <div className="relative">
                                        {user?.imageUrl ? (
                                            <div className={cn(
                                                "w-5 h-5 rounded-full overflow-hidden border-2 transition-all",
                                                isActive ? "border-primary shadow-[0_0_8px_rgba(57,255,20,0.5)]" : "border-transparent"
                                            )}>
                                                <img src={user.imageUrl} alt="You" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <item.icon size={16} strokeWidth={isActive ? 3 : 2} />
                                        )}
                                        {unreadCount > 0 && (
                                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-background animate-pulse" />
                                        )}
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
                                </Link>
                            )
                        })()}
                    </div>
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

                            <div className="w-full space-y-3 py-2">
                                {/* Age Checkbox */}
                                <label className="flex items-start gap-4 p-4 bg-muted rounded-xl border border-border cursor-pointer hover:bg-muted/80 transition-colors group">
                                    <div className="mt-1 relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="peer appearance-none w-5 h-5 rounded-md border-2 border-primary/30 checked:bg-primary checked:border-primary transition-all cursor-pointer"
                                            checked={legalCheckboxes.age}
                                            onChange={(e) => setLegalCheckboxes(prev => ({ ...prev, age: e.target.checked }))}
                                        />
                                        <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity text-black">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </div>
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-foreground uppercase tracking-tight">Age Verification</p>
                                        <p className="text-xs text-muted-foreground">I confirm that I am at least 18 years of age.</p>
                                    </div>
                                </label>

                                {/* Residency Checkbox */}
                                <label className="flex items-start gap-4 p-4 bg-muted rounded-xl border border-border cursor-pointer hover:bg-muted/80 transition-colors group">
                                    <div className="mt-1 relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="peer appearance-none w-5 h-5 rounded-md border-2 border-primary/30 checked:bg-primary checked:border-primary transition-all cursor-pointer"
                                            checked={legalCheckboxes.residency}
                                            onChange={(e) => setLegalCheckboxes(prev => ({ ...prev, residency: e.target.checked }))}
                                        />
                                        <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity text-black">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </div>
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-foreground uppercase tracking-tight">Residency Check</p>
                                        <p className="text-xs text-muted-foreground">I am a permanent resident of the Philippines.</p>
                                    </div>
                                </label>

                                {/* Terms Checkbox */}
                                <label className="flex items-start gap-4 p-4 bg-muted rounded-xl border border-border cursor-pointer hover:bg-muted/80 transition-colors group">
                                    <div className="mt-1 relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="peer appearance-none w-5 h-5 rounded-md border-2 border-primary/30 checked:bg-primary checked:border-primary transition-all cursor-pointer"
                                            checked={legalCheckboxes.terms}
                                            onChange={(e) => setLegalCheckboxes(prev => ({ ...prev, terms: e.target.checked }))}
                                        />
                                        <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity text-black">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </div>
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="text-sm font-bold text-foreground uppercase tracking-tight">Terms of Service</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            I agree to the <Link href="/terms" className="text-primary underline font-bold hover:text-primary/80 transition-colors">Terms of Service</Link>.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <button
                                onClick={handleAcceptLegal}
                                disabled={!legalCheckboxes.age || !legalCheckboxes.residency || !legalCheckboxes.terms}
                                className="w-full h-14 bg-foreground text-background font-black uppercase tracking-widest text-sm rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
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
                            <button onClick={() => { setShowWalletModal(false); setIsProcessingPaymongo(null); }} className="w-8 h-8 bg-muted flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        {!selectedPackage ? (
                            <div className="grid grid-cols-2 gap-3">
                                {packages.map((pkg) => (
                                    <button
                                        key={pkg.tibs}
                                        onClick={() => handlePackageSelect(pkg)}
                                        className="p-4 rounded-3xl border border-white/5 bg-card hover:border-primary/30 text-left transition-all active:scale-95 group relative overflow-hidden"
                                    >
                                        <div className="text-[8px] uppercase tracking-widest font-black text-primary mb-1">{pkg.label}</div>
                                        <div className="text-xl font-black">
                                            <TibsDisplay amount={pkg.tibs} showUnit={false} />
                                        </div>
                                        <div className="text-[10px] font-bold text-white/40">{pkg.price} PHP</div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                                <div className="p-4 bg-muted rounded-2xl flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{selectedPackage.label} Bundle</span>
                                        <span className="text-xl font-black">{selectedPackage.tibs} Tibs</span>
                                    </div>
                                    <button onClick={() => { setSelectedPackage(null); setReceiptPreview(null); }} className="text-xs font-bold text-primary hover:underline">Change</button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col items-center gap-4 p-6 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10 ring-1 ring-white/5 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="flex flex-col items-center gap-4 relative z-10 w-full text-center">
                                            <div className="w-56 h-56 bg-white rounded-3xl p-2 shadow-2xl border border-white/10">
                                                <img src="/insta_pay_qr.png" alt="InstaPay QR" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-black uppercase tracking-tight italic">Scan to Pay via GCash, Maya or Bank</p>
                                                <p className="text-[10px] text-muted-foreground">Please send exactly <span className="text-foreground font-bold">₱{selectedPackage.price}</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] uppercase font-black text-primary tracking-widest px-1">2. Upload Receipt</p>
                                        <div className="relative">
                                            {receiptPreview ? (
                                                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border">
                                                    <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
                                                    {isVerifyingReceipt ? (
                                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                                            <Loader2 size={32} className="animate-spin text-primary" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">AI is Reading...</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setReceiptPreview(null); setReceiptFile(null); }}
                                                            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center blur-none hover:bg-black/80 transition-all"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center gap-4 py-10 px-4 bg-muted border-2 border-dashed border-white/5 rounded-[2rem] cursor-pointer hover:bg-white/5 hover:border-primary/20 transition-all active:scale-95 group">
                                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                                        <Camera size={32} className="text-primary opacity-60 group-hover:opacity-100 group-hover:drop-shadow-[0_0_10px_rgba(57,255,20,0.5)] transition-all" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs font-black uppercase tracking-tighter">Snap or Upload Screenshot</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 font-medium bg-background/50 py-1 px-3 rounded-full">JPG, PNG allowed</p>
                                                    </div>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                    <div className="flex gap-3">
                                        <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-primary" /></div>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed italic">The AI will instantly credit your Tibs after reading the receipt details. Suspect images will be flagged for manual review.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Settle Modal */}
            {showSettleModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-sm rounded-[2.5rem] border border-border p-8 flex flex-col gap-5 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight text-foreground uppercase italic underline decoration-primary decoration-4 underline-offset-4">Settle</h3>
                            <button onClick={() => setShowSettleModal(false)} className="w-8 h-8 bg-muted flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Balance display */}
                        <div className="text-center bg-muted/30 rounded-2xl border border-border/50 py-3">
                            <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Available Balance</div>
                            <div className="text-2xl font-black neon-text">
                                <TibsDisplay
                                    amount={balance}
                                    showUnit={true}
                                    unitClassName="text-xs text-muted-foreground ml-1 uppercase"
                                />
                            </div>
                        </div>

                        {/* Method selector */}
                        <div className="flex bg-muted/30 p-0.5 rounded-xl border border-border/50">
                            {(['gcash', 'bank', 'qr'] as const).map(method => (
                                <button
                                    key={method}
                                    onClick={() => setSettleMethod(method)}
                                    className={cn(
                                        "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1",
                                        settleMethod === method ? 'bg-primary text-black shadow-md' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {method === 'gcash' && <Wallet size={10} />}
                                    {method === 'bank' && <CreditCard size={10} />}
                                    {method === 'qr' && <QrCode size={10} />}
                                    {method === 'gcash' ? 'GCash' : method === 'bank' ? 'Bank' : 'QR'}
                                </button>
                            ))}
                        </div>

                        {/* GCash form */}
                        {settleMethod === 'gcash' && (
                            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                                <input
                                    type="tel"
                                    placeholder="GCash Number (09xxxxxxxxx)"
                                    value={settleGcashNumber}
                                    onChange={(e) => setSettleGcashNumber(e.target.value)}
                                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                                />
                                <input
                                    type="text"
                                    placeholder="Account Name"
                                    value={settleGcashName}
                                    onChange={(e) => setSettleGcashName(e.target.value)}
                                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                                />
                            </div>
                        )}

                        {/* Bank form */}
                        {settleMethod === 'bank' && (
                            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                                <input
                                    type="text"
                                    placeholder="Bank Name (e.g. BDO, BPI, UnionBank)"
                                    value={settleBankName}
                                    onChange={(e) => setSettleBankName(e.target.value)}
                                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                                />
                                <input
                                    type="text"
                                    placeholder="Account Number"
                                    value={settleBankAccount}
                                    onChange={(e) => setSettleBankAccount(e.target.value)}
                                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                                />
                                <input
                                    type="text"
                                    placeholder="Account Holder Name"
                                    value={settleBankHolder}
                                    onChange={(e) => setSettleBankHolder(e.target.value)}
                                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                                />
                            </div>
                        )}

                        {/* QR upload form */}
                        {settleMethod === 'qr' && (
                            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                                <label className="w-full aspect-video bg-muted/40 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-all relative overflow-hidden">
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                setSettleQrFile(file)
                                                setSettleQrPreview(URL.createObjectURL(file))
                                            }
                                        }}
                                    />
                                    {settleQrPreview ? (
                                        <img src={settleQrPreview} alt="QR" className="w-full h-full object-contain" />
                                    ) : (
                                        <>
                                            <QrCode size={24} className="text-muted-foreground mb-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload QR Code</span>
                                        </>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    placeholder="Account Name"
                                    value={settleQrName}
                                    onChange={(e) => setSettleQrName(e.target.value)}
                                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                                />
                            </div>
                        )}

                        <button
                            onClick={handleSubmitSettle}
                            disabled={isSubmittingSettle || balance <= 0}
                            className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmittingSettle && <Loader2 size={16} className="animate-spin" />}
                            {isSubmittingSettle ? 'Submitting...' : 'Request Settlement'}
                        </button>
                    </div>
                </div>
            )}

            {/* Create Event Modal - renders the admin's CreateEventModal */}
            {showCreateEventModal && (
                <CreateEventModalWrapper
                    isAdmin={isAdmin}
                    isHostEligible={isHostEligible}
                    getClient={getClient}
                    userId={user?.id || null}
                    onClose={() => setShowCreateEventModal(false)}
                    showToast={showToast}
                />
            )}

            {showAdModal && (
                <AdRewardedModal
                    onClose={() => setShowAdModal(false)}
                    onComplete={async (rewardAmount) => {
                        // Optimistically update if needed or just wait for subscription
                        // But since it's a reward, it's nice to show it immediately
                    }}
                    showToast={showToast}
                />
            )}
        </div>
    )
}

function AdRewardedModal({ onClose, onComplete, showToast }: { onClose: () => void, onComplete: (amount: number) => void, showToast: any }) {
    const [timeLeft, setTimeLeft] = useState(10)
    const [isCounting, setIsCounting] = useState(true)
    const [isGranting, setIsGranting] = useState(false)

    useEffect(() => {
        if (timeLeft > 0 && isCounting) {
            const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
            return () => clearTimeout(timer)
        } else if (timeLeft === 0 && isCounting) {
            setIsCounting(false)
            handleGrantReward()
        }
    }, [timeLeft, isCounting])

    const handleGrantReward = async () => {
        setIsGranting(true)
        try {
            // Mock Ad Value: 0.25 PHP (randomized slightly)
            const adValue = 0.25 + (Math.random() * 0.1)

            const res = await fetch('/api/rewards/ads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adValuePhp: adValue })
            })

            const data = await res.json()
            if (data.success) {
                showToast(`💎 Success! You earned ${data.rewardTibs} Tibs!`, 'success')
                onComplete(data.rewardTibs)
                onClose()
            } else {
                throw new Error(data.error || 'Failed to reward')
            }
        } catch (err: any) {
            showToast(err.message || 'Error claiming reward', 'error')
            onClose()
        } finally {
            setIsGranting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" />

            <div className="relative w-full max-w-sm bg-card border border-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Visual Header */}
                <div className="aspect-video bg-gradient-to-br from-primary/20 via-black to-black flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80')] opacity-20 group-hover:scale-110 transition-transform duration-1000" />
                    <div className="relative z-10 flex flex-col items-center gap-4 text-center px-8">
                        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                            <TrophyIcon size={32} className="text-black" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-white leading-tight">Premium Ad Experience</h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Unlock 80% Rev Share Reward</p>
                        </div>
                    </div>

                    {/* Progress Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                        <div
                            className="h-full bg-primary transition-all duration-1000 ease-linear"
                            style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="p-8 flex flex-col items-center text-center gap-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-muted-foreground">
                            {timeLeft > 0 ? (
                                `Reward granted in ${timeLeft} seconds...`
                            ) : (
                                isGranting ? "Claiming your Tibs..." : "Reward Granted!"
                            )}
                        </p>
                    </div>

                    {timeLeft > 0 && (
                        <button
                            onClick={onClose}
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                        >
                            Skip & Close
                        </button>
                    )}
                </div>

                {/* Ad Branding */}
                <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-white/10 rounded flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white/40">Ad</span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Google Ad Manager</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Lightweight Create Event Modal that lives in Shell (for the floating button)
function CreateEventModalWrapper({ isAdmin, isHostEligible, getClient, userId, onClose, showToast }: {
    isAdmin: boolean, isHostEligible: boolean, getClient: any, userId: string | null, onClose: () => void, showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [cost, setCost] = useState('')
    const [goal, setGoal] = useState('')
    const [drawTime, setDrawTime] = useState('')
    const [maxEntriesPerUser, setMaxEntriesPerUser] = useState('')
    const [requiresCode, setRequiresCode] = useState(false)
    const [eventImages, setEventImages] = useState<File[]>([])
    const [eventPreviews, setEventPreviews] = useState<string[]>([])
    const [isLaunching, setIsLaunching] = useState(false)

    function isVideo(url: string) {
        return /\.(mp4|webm|ogg|mov)$/i.test(url)
    }

    useEffect(() => {
        return () => { eventPreviews.forEach(url => URL.revokeObjectURL(url)) }
    }, [eventPreviews])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const newFiles = Array.from(files)
            const LIMIT = 200 * 1024 * 1024
            const oversized = newFiles.filter(f => f.size > LIMIT)
            if (oversized.length > 0) {
                alert('⚠️ FILE TOO LARGE: One or more files exceed the 200MB limit.')
                return
            }
            setEventImages(prev => [...prev, ...newFiles])
            const newPreviews = newFiles.map(file => URL.createObjectURL(file))
            setEventPreviews(prev => [...prev, ...newPreviews])
        }
        e.target.value = ''
    }

    const removeImage = (index: number) => {
        setEventImages(prev => prev.filter((_, i) => i !== index))
        setEventPreviews(prev => {
            const url = prev[index]
            if (url) URL.revokeObjectURL(url)
            return prev.filter((_, i) => i !== index)
        })
    }

    const handleLaunchEvent = async () => {
        if (isLaunching) return
        if (!title || !cost || !drawTime) {
            alert('Please fill in all required fields (Title, Cost, Draw Time)')
            return
        }

        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) {
            alert('You must be logged in to launch an event.')
            return
        }

        setIsLaunching(true)
        try {
            const mediaUrls: string[] = []
            if (eventImages.length > 0) {
                for (const image of eventImages) {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`
                    const { error: uploadError } = await supabaseClient.storage.from('media').upload(filePath, image)
                    if (uploadError) throw uploadError
                    const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(filePath)
                    mediaUrls.push(publicUrl)
                }
            }

            // Get existing event count for display ID
            const { count: existingCount } = await supabaseClient
                .from('raffles')
                .select('*', { count: 'exact', head: true })

            const date = new Date()
            const monthLetter = date.toLocaleString('default', { month: 'short' })[0].toUpperCase()
            const yearShort = date.getFullYear().toString().slice(-2)
            const displayId = `#${monthLetter}${yearShort}.${(existingCount || 0) + 1}`

            const entryCost = parseInt(cost)
            const goalTibs = parseInt(goal) || 0
            const maxEntries = maxEntriesPerUser ? parseInt(maxEntriesPerUser) : null

            if (isNaN(entryCost) || entryCost < 0) {
                throw new Error('Invalid cost value. Please enter a valid number (0 or higher).')
            }

            const { error: insertError } = await supabaseClient.from('raffles').insert([{
                title,
                description,
                entry_cost_tibs: entryCost,
                ends_at: new Date(drawTime).toISOString(),
                media_urls: mediaUrls,
                host_user_id: userId,
                status: 'open',
                goal_tibs: goalTibs,
                display_id: displayId,
                max_entries_per_user: maxEntries,
                requires_code: requiresCode
            }])

            if (insertError) throw insertError

            showToast('Event launched successfully!', 'success')
            onClose()
        } catch (error: any) {
            console.error('[CreateEvent] Launch failed:', error)
            alert(error.message || 'Error launching event.')
        } finally {
            setIsLaunching(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Plus className="text-primary" size={20} /> New Event
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Prize Title</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. iPhone 15 Pro"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Prize details..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label>
                        <input type="datetime-local" value={drawTime} onChange={(e) => setDrawTime(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs) <span className="text-white/15">(0 for Free)</span></label>
                            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0"
                                min="0" disabled={requiresCode}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50 cursor-not-allowed" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs) <span className="text-white/15">(0 for Free)</span></label>
                            <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="0"
                                min="0" disabled={requiresCode}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50 cursor-not-allowed" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-white/80 uppercase tracking-wider">Requires Entry Code</span>
                            <span className="text-[10px] text-white/30">Users must enter a valid alphanumeric code to join</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const newVal = !requiresCode
                                setRequiresCode(newVal)
                                if (newVal) {
                                    setCost('0')
                                    setGoal('0')
                                }
                            }}
                            className={`w-12 h-7 rounded-full transition-all duration-200 ${requiresCode ? 'bg-primary' : 'bg-white/10'} relative`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all duration-200 ${requiresCode ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Max Entries Per User <span className="text-white/15">(optional)</span></label>
                        <input type="number" value={maxEntriesPerUser} onChange={(e) => setMaxEntriesPerUser(e.target.value)} placeholder="Unlimited"
                            min="1"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media (Multiple allowed)</label>
                        <div className="grid grid-cols-4 gap-2">
                            {eventPreviews.map((preview: string, index: number) => (
                                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                    {isVideo(preview) ? <video src={preview} className="w-full h-full object-cover" /> : <img src={preview} alt="Preview" className="w-full h-full object-cover" />}
                                    <button onClick={() => removeImage(index)} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X size={14} className="text-white" />
                                    </button>
                                </div>
                            ))}
                            <label className="aspect-square bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors group">
                                <input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleFileChange} />
                                <ImageIcon size={24} className="group-hover:scale-110 transition-transform" />
                            </label>
                        </div>
                    </div>
                    <button
                        onClick={handleLaunchEvent}
                        disabled={isLaunching || (!isAdmin && !isHostEligible)}
                        className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLaunching && <Loader2 size={18} className="animate-spin" />}
                        {isLaunching ? 'Launching...' : 'Launch'}
                    </button>
                </div>
            </div>
        </div>
    )
}
