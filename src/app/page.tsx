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
  onEnter: (id: string, cost: number) => void,
  onShare: (e: any) => void,
  userId?: string | null,
  isAdmin?: boolean
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

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
            <div className="flex items-center justify-center gap-2 border-x border-white/5">
              <Users size={18} className="text-white/40" />
              <span className="text-sm font-black text-white/90">{entryCount}</span>
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

          <div className="flex gap-2 pt-2">
            {isAdmin || userId === event.host_user_id ? (
              <div className="flex-1 py-4 bg-white/5 text-white/20 border border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center italic">
                {isAdmin ? 'Admin Restricted' : 'Host Restricted'}
              </div>
            ) : (
              <button
                onClick={() => onEnter(event.id, event.entry_cost_tibs)}
                className="flex-1 py-4 bg-primary text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-200 active:scale-95 shadow-lg shadow-primary/10 flex items-center justify-center gap-2"
              >
                Join Event
              </button>
            )}
            <button
              onClick={() => onShare(event)}
              className="aspect-square w-[52px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-colors text-white/40 hover:text-primary"
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

  const handleEnterEvent = async (eventId: string, cost: number) => {
    if (!isSignedIn) {
      alert('Please log in to enter events.')
      return
    }

    const supabaseClient = await getClient()
    if (!supabaseClient) return

    if (!confirm(`Enter this event for ${cost} Tibs?`)) return

    try {
      const { data, error } = await supabaseClient.rpc('enter_raffle', {
        p_raffle_id: eventId,
        p_user_id: userId
      })

      if (error) throw error

      if (data.success) {
        alert('Entry successful! Good luck!')
        fetchEvents() // Refresh to update entry count
      } else {
        alert(data.message || 'Failed to enter event.')
      }
    } catch (error: any) {
      console.error('Error entering event:', error)
      alert(error.message || 'Error entering event.')
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
