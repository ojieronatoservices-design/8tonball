"use client"

import React, { useEffect, useState } from 'react'
import { Trophy, Clock, Users, ArrowRight, Loader2, Share2, Facebook, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
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
        {/* Image Section */}
        <div
          className="aspect-[16/10] overflow-hidden relative cursor-pointer"
          onClick={() => setShowLightbox(true)}
        >
          <img
            src={images[currentImageIndex]}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* Carousel Controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-all"
              >
                <ChevronRight size={20} />
              </button>
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_: any, idx: number) => (
                  <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
            </>
          )}

          {/* Entry Count Badge */}
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-white text-xs font-bold flex items-center gap-1.5 border border-white/10">
            <Users size={14} className="text-primary" />
            {entryCount} {entryCount === 1 ? 'Entry' : 'Entries'}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onShare(event) }}
            className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-md rounded-2xl text-white/80 hover:text-primary transition-colors border border-white/10"
          >
            <Share2 size={18} />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-bold">{event.title}</h3>

              {/* Collapsible Description */}
              {description && (
                <div className="mt-1">
                  <p className={`text-white/40 text-sm ${!isDescriptionExpanded && isLongDescription ? 'line-clamp-2' : ''}`}>
                    {description}
                  </p>
                  {isLongDescription && (
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-primary text-xs font-bold flex items-center gap-1 mt-1"
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
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 text-xs font-black whitespace-nowrap ml-3">
              {event.entry_cost_tibs} TIBS
            </div>
          </div>

          {/* Timer */}
          <CountdownTimer endsAt={event.ends_at} className="text-sm" />

          <div className="flex gap-2">
            {isAdmin || userId === event.host_user_id ? (
              <div className="flex-1 py-4 bg-white/5 text-white/20 border border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center italic">
                {isAdmin ? 'Admin Restricted' : 'Host Restricted'}
              </div>
            ) : (
              <button
                onClick={() => onEnter(event.id, event.entry_cost_tibs)}
                className="flex-1 py-4 bg-primary text-black rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-200 active:scale-95 shadow-lg shadow-primary/10"
              >
                Enter Event
              </button>
            )}
            <button
              onClick={() => onShare(event)}
              className="aspect-square w-[52px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-colors"
            >
              <Facebook size={20} className="text-[#1877F2]" />
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
    <div className="flex flex-col gap-8 pb-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Active Events</h2>
        <p className="text-white/40 text-sm">Tap to enter and try your luck.</p>
      </div>

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
