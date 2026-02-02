"use client"

import React, { useEffect, useState, useRef } from 'react'
import { Trophy, Clock, Users, Loader2, Share2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Coins, XCircle } from 'lucide-react'
import { CountdownTimer } from '@/components/CountdownTimer'
import { ImageLightbox } from '@/components/ImageLightbox'

interface EventCardProps {
    event: any
    entryCount: number
    onEnter?: (id: string, cost: number) => Promise<boolean>
    onShare: (e: any) => void
    userId?: string | null
    isAdmin?: boolean
    variant?: 'feed' | 'profile-live' | 'profile-archive'
    isWinner?: boolean
    entryNumbers?: string[]
}

export const EventCard = ({
    event,
    entryCount,
    onEnter,
    onShare,
    userId,
    isAdmin,
    variant = 'feed',
    isWinner = false,
    entryNumbers = []
}: EventCardProps) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [showLightbox, setShowLightbox] = useState(false)

    // UX States
    const [isConfirming, setIsConfirming] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [localEntryCount, setLocalEntryCount] = useState(entryCount)
    const [justJoined, setJustJoined] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Handle scroll to update index
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        const index = Math.round(target.scrollLeft / target.offsetWidth)
        if (index !== currentImageIndex) {
            setCurrentImageIndex(index)
        }
    }

    // Sync prop changes unless we just joined (optimistic)
    useEffect(() => {
        if (!justJoined) setLocalEntryCount(entryCount)
    }, [entryCount, justJoined])

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
            <div className="group relative bg-card overflow-hidden border-b border-border transition-all duration-300">
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
                                    <video
                                        src={img}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                    />
                                ) : (
                                    <img
                                        src={img}
                                        alt={event.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Carousel Controls */}
                    {images.length > 1 && (
                        <>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4 z-10">
                                <button
                                    onClick={prevImage}
                                    className="pointer-events-auto w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="pointer-events-auto w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-sm rounded-full z-10">
                                {images.map((_: string, idx: number) => (
                                    <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-primary' : 'bg-white/30'}`} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Content Section */}
                <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
                    {/* Meta Info Bar */}
                    <div className="grid grid-cols-3 gap-0 py-1.5 border-y border-border bg-muted/30">
                        <div className="flex items-center justify-center gap-2">
                            <Coins size={18} className="text-primary" />
                            <span className="text-sm font-black text-foreground">{event.entry_cost_tibs}</span>
                        </div>
                        <div className={`flex items-center justify-center gap-2 border-x border-border transition-all duration-300 ${justJoined ? 'scale-125 text-primary' : ''}`}>
                            <Users size={18} className={justJoined ? "text-primary" : "text-muted-foreground"} />
                            <span className={`text-sm font-black ${justJoined ? "text-primary transition-all neon-text" : "text-foreground"}`}>{localEntryCount}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            {variant === 'profile-archive' ? (
                                <div className="flex items-center gap-2">
                                    {isWinner ? (
                                        <div className="flex items-center gap-1.5 text-green-500 font-black text-xs uppercase tracking-tight">
                                            <Trophy size={14} /> WON
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-white/20 font-black text-xs uppercase tracking-tight">
                                            <XCircle size={14} /> MISSED
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <Clock size={18} className="text-muted-foreground" />
                                    <div className="text-sm font-black text-foreground">
                                        <CountdownTimer endsAt={event.ends_at} showLabels={false} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black tracking-tight">{event.title}</h3>
                        {description && (
                            <div className="mt-1">
                                <p className={`text-muted-foreground text-sm leading-relaxed ${!isDescriptionExpanded && isLongDescription ? 'line-clamp-2' : ''}`}>
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
                                    <span className="text-[9px] font-black uppercase text-green-500 animate-pulse tracking-widest flex items-center gap-1">
                                        <Trophy size={10} /> Winner Included
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {entryNumbers.map((num, i) => {
                                    // Highlight if it's the winning ticket
                                    const isWinningTicket = variant === 'profile-archive' && num === event.winning_ticket_number;
                                    return (
                                        <div
                                            key={i}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black font-mono transition-all border ${isWinningTicket
                                                ? 'bg-green-500/10 text-green-500 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)] scale-110 active-neon'
                                                : 'bg-background text-muted-foreground border-border'
                                                }`}
                                        >
                                            {isWinningTicket && <Trophy size={10} className="inline mr-1 mb-0.5" />}
                                            {num}
                                        </div>
                                    )
                                })}
                            </div>
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
                                        className="flex-[2] h-full bg-primary text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center transition-all disabled:opacity-50 active:scale-95 neon-border shadow-md"
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="animate-spin" size={20} />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span>CONFIRM ({event.entry_cost_tibs} Tibs)</span>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleJoinClick}
                                    className="flex-1 h-full bg-primary text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 neon-border shadow-lg flex items-center justify-center gap-2 hover:brightness-110"
                                >
                                    Join Event
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
}
