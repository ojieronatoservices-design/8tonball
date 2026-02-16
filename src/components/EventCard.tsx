"use client"

import React, { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Trophy, Clock, Users, Loader2, Share2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Coins, XCircle, Ticket, User, CheckCircle2, MessageSquare } from 'lucide-react'
import { CountdownTimer } from '@/components/CountdownTimer'
import { ImageLightbox } from '@/components/ImageLightbox'
import { TibsDisplay } from '@/components/TibsDisplay'
import Link from 'next/link'
import { useSupabase } from '@/hooks/useSupabase'
import { useSearchParams } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface EventCardProps {
    event: any
    entryCount: number
    onEnter?: (id: string, cost: number) => Promise<boolean>
    onShare: (e: any) => void
    userId?: string | null
    isAdmin?: boolean
    variant?: 'feed' | 'profile-live' | 'profile-archive'
    isWinner?: boolean
    isRefunded?: boolean
    entryNumbers?: string[]
    onClaim?: (id: string) => Promise<void>
}

export const EventCard = React.memo(({
    event,
    entryCount,
    onEnter,
    onShare,
    userId,
    isAdmin,
    variant = 'feed',
    isWinner = false,
    isRefunded = false,
    entryNumbers = [],
    onClaim,
}: EventCardProps) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [showLightbox, setShowLightbox] = useState(false)
    const { getClient } = useSupabase()
    const searchParams = useSearchParams()
    const [isFlashActive, setIsFlashActive] = useState(false)

    // Trigger flash highlight if focusing on this raffle (from deep link)
    // We can just check raffleId, no need for comment logic anymore
    useEffect(() => {
        const rId = searchParams.get('raffleId')
        if (event.id === rId) {
            setIsFlashActive(true)
            const timer = setTimeout(() => setIsFlashActive(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [searchParams, event.id])

    // UX States
    const [isConfirming, setIsConfirming] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [localEntryCount, setLocalEntryCount] = useState(entryCount)
    const [justJoined, setJustJoined] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Swipe down to close states
    // Swipe handlers removed

    // Throttled scroll handler
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        requestAnimationFrame(() => {
            const index = Math.round(target.scrollLeft / target.offsetWidth)
            if (index !== currentImageIndex) {
                setCurrentImageIndex(index)
            }
        })
    }

    // Sync prop changes unless we just joined (optimistic)
    useEffect(() => {
        if (!justJoined) setLocalEntryCount(entryCount)
    }, [entryCount, justJoined])

    // Fetch comment count
    // Comment count fetch removed

    const handleJoinClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsConfirming(true)
    }

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsConfirming(false)
    }

    const handleConfirm = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!onEnter) return

        setIsProcessing(true)
        const success = await onEnter(event.id, event.entry_cost_tibs)
        setIsProcessing(false)
        setIsConfirming(false)

        if (success) {
            setLocalEntryCount(prev => prev + 1)
            setJustJoined(true)
            setTimeout(() => setJustJoined(false), 5000)
        }
    }

    const isVideo = (url: string) => {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
        return videoExtensions.some(ext => url.toLowerCase().includes(ext))
    }

    const images = event.media_urls && event.media_urls.length > 0
        ? event.media_urls
        : ['https://via.placeholder.com/800x500?text=No+Image']

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (scrollRef.current) {
            const nextIdx = (currentImageIndex + 1) % images.length
            scrollRef.current.scrollTo({ left: nextIdx * scrollRef.current.offsetWidth, behavior: 'smooth' })
        }
    }

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (scrollRef.current) {
            const prevIdx = (currentImageIndex - 1 + images.length) % images.length
            scrollRef.current.scrollTo({ left: prevIdx * scrollRef.current.offsetWidth, behavior: 'smooth' })
        }
    }

    const description = event.description || ''
    const isLongDescription = description.length > 100

    return (
        <>
            <div className={cn(
                "group relative bg-card overflow-hidden border-b border-border transition-all duration-300",
                isFlashActive && "animate-flash-highlight"
            )}>
                {/* Host Identity Section */}
                <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02]">
                    <div
                        className="flex items-center gap-2 group/host cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-8 h-8 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {event.host?.avatar_url ? (
                                <img src={event.host.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <User size={16} className="text-muted-foreground/50" />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black uppercase tracking-tight truncate text-foreground">
                                    {event.host?.display_name || 'Anonymous Host'}
                                </span>
                                {event.host?.is_host_eligible && (
                                    <CheckCircle2 size={10} className="text-primary shrink-0" />
                                )}
                            </div>
                            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">Host</span>
                        </div>
                    </div>
                </div>

                {/* Image Section */}
                <div className="relative aspect-square">
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide cursor-pointer"
                        onClick={() => setShowLightbox(true)}
                    >
                        {images.map((img: string, idx: number) => (
                            <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative">
                                {isVideo(img) ? (
                                    <div
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    >
                                        <video
                                            src={img}
                                            className="w-full h-full object-cover"
                                            controls
                                            playsInline
                                            preload="metadata"
                                        />
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={img}
                                            alt={event.title}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            priority={idx === 0}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Carousel Controls - Removed backdrop-blur for performance */}
                    {images.length > 1 && (
                        <>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4 z-10 transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                                <button
                                    onClick={prevImage}
                                    className="pointer-events-auto w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="pointer-events-auto w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/40 rounded-full z-10">
                                {images.map((_: string, idx: number) => (
                                    <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-primary' : 'bg-white/30'}`} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Flash Sale Banner - Edge to Edge */}
                <div className="flex justify-between items-center py-3 px-6 bg-gradient-to-r from-[#39FF14] to-[#d946ef] text-black shadow-[0_0_20px_rgba(57,255,20,0.4)] relative z-10">
                    {/* Left: Tibs & Entries */}
                    <div className="flex flex-col items-start leading-none">
                        <div className="flex items-baseline gap-1">
                            <TibsDisplay
                                amount={event.entry_cost_tibs}
                                className="text-3xl font-black font-sans tracking-tighter"
                                showUnit={true}
                                unitClassName="text-sm font-black font-sans uppercase opacity-80"
                            />
                        </div>
                        <div className="flex items-center gap-1 opacity-70 mt-0.5">
                            <Ticket size={10} fill="currentColor" />
                            <span className="text-[10px] font-bold font-sans uppercase tracking-wider">{localEntryCount} entries</span>
                        </div>
                    </div>

                    {/* Right: Timer */}
                    <div className="flex flex-col items-end leading-none">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">Event Ends In</span>
                        {variant === 'profile-archive' ? (
                            <span className="text-xl font-black font-sans tracking-tight">
                                {event.status === 'claimed' ? 'CLAIMED' : isWinner ? 'WON' : 'ENDED'}
                            </span>
                        ) : (
                            <div className="text-2xl font-black font-sans tabular-nums tracking-tight">
                                <CountdownTimer endsAt={event.ends_at} showLabels={false} format="digital" className="text-black" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Section */}
                <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black tracking-tight">{event.title}</h3>
                        {description && (
                            <div className="mt-1">
                                <p className={`text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap ${!isDescriptionExpanded && isLongDescription ? 'line-clamp-2' : ''}`}>
                                    {description}
                                </p>
                                {isLongDescription && (
                                    <button
                                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                        className="neon-text text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mt-2"
                                    >
                                        {isDescriptionExpanded ? (
                                            <>Show less <ChevronUp size={14} /></>
                                        ) : (
                                            <>Read more <ChevronDown size={14} /></>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Ticket Numbers - For Profile Variants */}
                    {variant !== 'feed' && entryNumbers.length > 0 && (
                        <div className="flex flex-col gap-2 mt-1 p-3 bg-muted/50 rounded-2xl border border-border/50">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Your Tickets ({entryNumbers.length})</span>
                                {variant === 'profile-archive' && isWinner && (
                                    event.status === 'claimed' ? (
                                        <span className="text-[9px] font-black uppercase bg-green-500/20 text-green-500 border border-green-500/30 px-1.5 py-0.5 rounded-sm tracking-widest flex items-center gap-1">
                                            Claimed
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black uppercase bg-primary text-black px-1.5 py-0.5 rounded-sm animate-pulse tracking-widest flex items-center gap-1">
                                            <Trophy size={10} /> Winner
                                        </span>
                                    )
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-[84px] overflow-y-auto pr-1 custom-scrollbar">
                                {entryNumbers.map((num, i) => {
                                    // Highlight if it's the winning ticket
                                    const isWinningTicket = variant === 'profile-archive' && num === event.winning_ticket_number;
                                    return (
                                        <div
                                            key={i}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black font-mono transition-all border ${isWinningTicket
                                                ? (isRefunded ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' : 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(57,255,20,0.5)] scale-110')
                                                : 'bg-background text-muted-foreground border-border'
                                                }`}
                                        >
                                            {isWinningTicket && !isRefunded && <Trophy size={10} className="inline mr-1 mb-0.5" />}
                                            {isWinningTicket && isRefunded && <XCircle size={10} className="inline mr-1 mb-0.5" />}
                                            {num}
                                        </div>
                                    )
                                })}
                            </div>

                            {isRefunded && (
                                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                                    <div className="flex items-center gap-2 text-orange-500 mb-1">
                                        <Coins size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Tibs Refunded</span>
                                    </div>
                                    <p className="text-[10px] text-orange-500/60 font-medium leading-relaxed">
                                        Your entries have been refunded because the event did not reach its required goal.
                                    </p>
                                </div>
                            )}

                            {/* Contact Host Button for Winners */}
                            {variant === 'profile-archive' && isWinner && event.status !== 'claimed' && event.host && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (!event.host?.email) return
                                        const subject = encodeURIComponent(`8TONBALL Winner: ${event.title}`)
                                        const body = encodeURIComponent(`Hi ${event.host.display_name},\n\nI won your event "${event.title}"!\n\nPlease let me know how to claim my prize.\n\nThank you!`)
                                        window.open(`mailto:${event.host.email}?subject=${subject}&body=${body}`, '_blank')
                                    }}
                                    className="mt-2 w-full py-3 bg-primary text-black font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg neon-border"
                                >
                                    <Share2 size={12} /> Contact Host to Claim
                                </button>
                            )}

                            {/* Mark as Claimed Button for Winners & Hosts */}
                            {variant === 'profile-archive' && userId && (userId === event.host_user_id || isWinner) && event.status === 'drawn' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onClaim?.(event.id)
                                    }}
                                    className="mt-2 w-full py-3 bg-green-500 text-black font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg neon-border"
                                >
                                    ✓ Mark as Claimed
                                </button>
                            )}
                        </div>
                    )}

                    {variant !== 'profile-archive' && (
                        <div className="flex gap-2 pt-1 h-[42px]">
                            {isAdmin || userId === event.host_user_id ? (
                                <div className="flex-1 h-full bg-muted text-muted-foreground border border-border rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center italic">
                                    {isAdmin ? 'Admin Restricted' : 'Host Restricted'}
                                </div>
                            ) : isConfirming ? (
                                <div className="flex-1 flex gap-2 animate-in slide-in-from-right fade-in duration-200">
                                    <button
                                        onClick={handleCancel}
                                        disabled={isProcessing}
                                        className="flex-1 h-full bg-muted hover:bg-foreground/5 text-foreground rounded-2xl flex items-center justify-center border border-border transition-colors disabled:opacity-50"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={isProcessing}
                                        className="flex-[2] h-full bg-primary text-black rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center transition-all disabled:opacity-50 active:scale-95 neon-border shadow-md"
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="animate-spin" size={20} />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span>CONFIRM (<TibsDisplay amount={event.entry_cost_tibs} />)</span>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleJoinClick}
                                    className="flex-1 h-full bg-primary text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 neon-border shadow-lg flex items-center justify-center gap-2 hover:brightness-110"
                                >
                                    Enter
                                </button>
                            )}
                            <button
                                onClick={() => onShare(event)}
                                className="aspect-square h-full flex items-center justify-center bg-muted hover:bg-foreground/5 rounded-2xl border border-border transition-colors text-muted-foreground hover:text-primary"
                            >
                                <Share2 size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Comments Drawer Removed */}

            {/* Image Lightbox */}
            {showLightbox && (
                <ImageLightbox
                    images={images}
                    initialIndex={currentImageIndex}
                    onClose={() => setShowLightbox(false)}
                />
            )}
        </>
    )
})

EventCard.displayName = 'EventCard'
