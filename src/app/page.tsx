"use client"

import React, { useEffect, useState } from 'react'
import { Trophy, Clock, Users, ArrowRight, Loader2, Share2, Facebook, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Coins } from 'lucide-react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { CountdownTimer } from '@/components/CountdownTimer'
import { ImageLightbox } from '@/components/ImageLightbox'

const EventCard = ({ event, entryCount, onEnter, onShare, userId, isAdmin }: {
  event: any,
  entryCount: number,
  onEnter: (id: string, cost: number) => Promise<boolean>,
  onShare: (e: any) => void,
  userId?: string | null,
  isAdmin?: boolean
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  // UX States
  const [isConfirming, setIsConfirming] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [localEntryCount, setLocalEntryCount] = useState(entryCount)
  const [justJoined, setJustJoined] = useState(false)

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
    setIsProcessing(true)

    // Play sound or haptic here if possible

    const success = await onEnter(event.id, event.entry_cost_tibs)

    setIsProcessing(false)
    setIsConfirming(false)

    if (success) {
      setLocalEntryCount(prev => prev + 1)
      setJustJoined(true)
      // Reset "just joined" state after a while to allow sync
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
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const description = event.description || ''
  const isLongDescription = description.length > 100

  return (
    <>
      <div className="group relative bg-card rounded-3xl overflow-hidden border border-white/5 hover:border-primary/20 transition-all duration-300">
        {/* Image Section (NOW AT TOP) */}
        <div
          className="aspect-[16/10] overflow-hidden relative cursor-pointer"
          onClick={() => setShowLightbox(true)}
        >
          {isVideo(images[currentImageIndex]) ? (
            <video
              src={images[currentImageIndex]}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={images[currentImageIndex]}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}

          {/* Carousel Controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-sm rounded-full">
              {images.map((_: any, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-primary' : 'bg-white/30'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-6 flex flex-col gap-5">
          {/* Meta Info Bar (Horizontal & Balanced) */}
          <div className="grid grid-cols-3 gap-0 py-2 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-center gap-2">
              <Coins size={18} className="text-primary" />
              <span className="text-sm font-black text-white/90">{event.entry_cost_tibs}</span>
            </div>
            <div className={`flex items-center justify-center gap-2 border-x border-white/5 transition-all duration-300 ${justJoined ? 'scale-125 text-primary' : ''}`}>
              <Users size={18} className={justJoined ? "text-primary" : "text-white/40"} />
              <span className={`text-sm font-black ${justJoined ? "text-primary" : "text-white/90"}`}>{localEntryCount}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock size={18} className="text-white/40" />
              <div className="text-sm font-black text-white/90">
                <CountdownTimer endsAt={event.ends_at} showLabels={false} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-black tracking-tight">{event.title}</h3>
            {description && (
              <div className="mt-1">
                <p className={`text-white/40 text-sm leading-relaxed ${!isDescriptionExpanded && isLongDescription ? 'line-clamp-2' : ''}`}>
                  {description}
                </p>
                {isLongDescription && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mt-2"
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

          <div className="flex gap-2 pt-2 h-[54px]"> {/* Fixed height container for buttons */}
            {isAdmin || userId === event.host_user_id ? (
              <div className="flex-1 h-full bg-white/5 text-white/20 border border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center italic">
                {isAdmin ? 'Admin Restricted' : 'Host Restricted'}
              </div>
            ) : isConfirming ? (
              <div className="flex-1 flex gap-2 animate-in slide-in-from-right fade-in duration-200">
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="flex-1 h-full bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <span className="sr-only">Cancel</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="flex-[2] h-full bg-primary hover:bg-primary/90 text-black rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center transition-all disabled:opacity-50 active:scale-95"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>CONFIRM ({event.entry_cost_tibs} Tibs)</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </div>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoinClick}
                className="flex-1 h-full bg-primary text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 shadow-lg shadow-primary/10 flex items-center justify-center gap-2 hover:brightness-110"
              >
                Join Event
              </button>
            )}
            <button
              onClick={() => onShare(event)}
              className="aspect-square h-full flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-colors text-white/40 hover:text-primary"
            >
              <Share2 size={18} />
            </button>
          </div>
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

export default function HomePage() {
  const [events, setEvents] = useState<any[]>([])
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const { userId, isSignedIn } = useAuth()
  const { user } = useUser()
  const { getClient } = useSupabase()

  const fetchEvents = async () => {
    const supabaseClient = await getClient()
    if (!supabaseClient) return

    setIsLoading(true)
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabaseClient
        .from('raffles')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      if (eventsError) throw eventsError
      setEvents(eventsData || [])

      // Fetch admin status
      if (userId) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .single()
        setIsAdmin(profile?.is_admin || false)
      }

      // Fetch entry counts for each event
      if (eventsData && eventsData.length > 0) {
        const counts: Record<string, number> = {}
        for (const event of eventsData) {
          const { count } = await supabaseClient
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('raffle_id', event.id)
          counts[event.id] = count || 0
        }
        setEntryCounts(counts)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [userId])

  // Real-time subscription for entry count updates
  useEffect(() => {
    let entriesChannel: any = null

    const setupRealtime = async () => {
      const supabaseClient = await getClient()
      if (!supabaseClient || events.length === 0) return

      // Subscribe to all entry inserts
      entriesChannel = supabaseClient
        .channel('entries-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'entries'
        }, (payload: any) => {
          // Update count for the specific raffle
          const raffleId = payload.new.raffle_id
          setEntryCounts(prev => ({
            ...prev,
            [raffleId]: (prev[raffleId] || 0) + 1
          }))
        })
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (entriesChannel) {
        entriesChannel.unsubscribe()
      }
    }
  }, [events.length])

  // Updated handleEnterEvent to return success status for UI update
  const handleEnterEvent = async (eventId: string, cost: number): Promise<boolean> => {
    if (!isSignedIn) {
      alert('Please log in to enter events.')
      return false
    }

    const supabaseClient = await getClient()
    if (!supabaseClient) return false

    // No confirm popup here anymore - handled by UI

    try {
      const { data, error } = await supabaseClient.rpc('enter_raffle', {
        p_raffle_id: eventId,
        p_user_id: userId
      })

      if (error) throw error

      if (data.success) {
        // alert('Entry successful! Good luck!') // Removed alert for smoother flow
        // We still fetch events to ensure data consistency, but UI is already updated optimistically
        fetchEvents()
        return true
      } else {
        alert(data.message || 'Failed to enter event.')
        return false
      }
    } catch (error: any) {
      console.error('Error entering event:', error)
      alert(error.message || 'Error entering event.')
      return false
    }
  }

  const handleShareFacebook = (event: any) => {
    const url = window.location.origin + '/event/' + event.id
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(`Check out this event: ${event.title} on 8TONBALL!`)}`
    window.open(shareUrl, '_blank', 'width=600,height=400')
  }

  return (
    <div className="flex flex-col gap-6 pb-8">

      <div className="flex flex-col gap-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-white/20 font-black uppercase tracking-widest text-xs">Loading Events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4 bg-card rounded-3xl border border-white/5">
            <Clock size={48} />
            <p className="font-bold">No active events yet.</p>
          </div>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              entryCount={entryCounts[event.id] || 0}
              onEnter={handleEnterEvent}
              onShare={handleShareFacebook}
              userId={userId}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>
    </div>
  )
}
