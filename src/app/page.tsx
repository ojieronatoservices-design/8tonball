"use client"

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Trophy, Clock, Users, ArrowRight, Loader2, Share2, Facebook, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Coins, Search } from 'lucide-react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useSearchParams } from 'next/navigation'
import { CountdownTimer } from '@/components/CountdownTimer'
import { ImageLightbox } from '@/components/ImageLightbox'

import { EventCard } from '@/components/EventCard'

export default function HomePage() {
  const [events, setEvents] = useState<any[]>([])
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({})
  const [userEntryIds, setUserEntryIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const { userId, isSignedIn } = useAuth()
  const { user } = useUser()
  const { getClient } = useSupabase()
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('q')?.toLowerCase() || ''

  const fetchEvents = async () => {
    const supabaseClient = await getClient()
    if (!supabaseClient) return

    setIsLoading(true)
    try {
      // PHASE 1: Fetch Events, User Entries, and Admin Status in PARALLEL
      const [eventsResult, entriesResult, profileResult] = await Promise.all([
        supabaseClient
          .from('raffles')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
        userId ? supabaseClient
          .from('entries')
          .select('raffle_id')
          .eq('user_id', userId) : Promise.resolve({ data: [] }),
        userId ? supabaseClient
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .single() : Promise.resolve({ data: null })
      ])

      if (eventsResult.error) throw eventsResult.error

      // Process User Entries
      if (entriesResult.data) {
        const entryIds = new Set<string>(entriesResult.data.map((e: { raffle_id: string }) => e.raffle_id))
        setUserEntryIds(entryIds)
      }

      // Process Admin Status
      const profile = profileResult.data as { is_admin?: boolean } | null
      setIsAdmin(profile?.is_admin || false)

      // Set Events Immediately
      const eventsData = eventsResult.data || []
      setEvents(eventsData)

      // Stop loading spinner immediately so user sees content
      setIsLoading(false)

      // PHASE 2: Fetch Entry Counts in PARALLEL (Background)
      if (eventsData.length > 0) {
        const countPromises = eventsData.map((event: any) =>
          supabaseClient
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('raffle_id', event.id)
            .then(({ count }: { count: number | null }) => ({ id: event.id, count: count || 0 }))
        )

        const countResults = await Promise.all(countPromises)
        const counts: Record<string, number> = {}
        countResults.forEach(({ id, count }) => { counts[id] = count })

        setEntryCounts(prev => {
          const newCounts = { ...prev }
          for (const [id, count] of Object.entries(counts)) {
            newCounts[id] = Math.max(prev[id] || 0, count)
          }
          return newCounts
        })
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [userId])

  // Safety timeout for loading state (mobile hangs)
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('[HomePage] Loading safety timeout triggered')
        setIsLoading(false)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  // Real-time subscription for entry count updates AND raffle status changes
  const supabaseRef = useRef<any>(null)
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  useEffect(() => {
    let entriesChannel: any = null
    let rafflesChannel: any = null

    const setupRealtime = async () => {
      const supabaseClient = await getClient()
      if (!supabaseClient) return
      supabaseRef.current = supabaseClient

      // Subscribe to all entry inserts (for count updates on all raffles)
      entriesChannel = supabaseClient
        .channel('entries-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'entries'
        }, (payload: any) => {
          const raffleId = payload.new.raffle_id
          const entrantId = payload.new.user_id

          // FORENSIC FIX:
          // 1. If it's OUR entry, we already optimistically added +1. Ignore to prevent double count.
          // 2. If it's SOMEONE ELSE, add +1.


          // console.log('[Realtime] Entry added by other user:', entrantId)
          setEntryCounts(prev => ({
            ...prev,
            [raffleId]: (prev[raffleId] || 0) + 1
          }))
        })
        .subscribe((status: string) => {
          // console.log('[Realtime] Entries channel:', status)
        })

      // Subscribe to raffle status changes (for when drawn/closed)
      rafflesChannel = supabaseClient
        .channel('raffles-realtime')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'raffles'
        }, (payload: any) => {
          // console.log('[Realtime] Raffle updated:', payload.new?.id, 'status:', payload.new?.status)

          // If raffle is no longer open, remove it from the list
          if (payload.new?.status !== 'open') {
            setEvents(prev => prev.filter(e => e.id !== payload.new.id))
          } else {
            // Update the raffle data in place
            setEvents(prev => prev.map(e =>
              e.id === payload.new.id ? { ...e, ...payload.new } : e
            ))
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'raffles'
        }, (payload: any) => {
          // New raffle created - add to list if open
          if (payload.new?.status === 'open') {
            // console.log('[Realtime] New raffle created:', payload.new?.title)
            setEvents(prev => [payload.new, ...prev])
            // Initialize entry count for new raffle
            setEntryCounts(prev => ({ ...prev, [payload.new.id]: 0 }))
          }
        })
        .subscribe((status: string) => {
          // console.log('[Realtime] Raffles channel:', status)
        })
    }

    setupRealtime()

    return () => {
      if (entriesChannel && supabaseRef.current) {
        supabaseRef.current.removeChannel(entriesChannel)
      }
      if (rafflesChannel && supabaseRef.current) {
        supabaseRef.current.removeChannel(rafflesChannel)
      }
    }
  }, []) // Empty deps - setup once, cleanup on unmount

  // Updated handleEnterEvent to return success status for UI update
  const handleEnterEvent = React.useCallback(async (eventId: string, cost: number): Promise<boolean> => {
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
        // Dispatch immediate balance update to Shell.tsx (immediate UI feedback)
        window.dispatchEvent(new CustomEvent('balanceUpdate', {
          detail: { balance: data.new_balance }
        }))

        // Optimistic Entry Count Update
        setEntryCounts(prev => ({
          ...prev,
          [eventId]: (prev[eventId] || 0) + 1
        }))

        // Entry successful - real-time subscription will update entry counts
        // Don't call fetchEvents() as it causes a page reload
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
  }, [isSignedIn, userId, getClient])

  const handleShareFacebook = React.useCallback((event: any) => {
    const url = window.location.origin + '/event/' + event.id
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(`Check out this event: ${event.title} on 8TONBALL!`)}`
    window.open(shareUrl, '_blank', 'width=600,height=400')
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = !searchQuery ||
        event.title?.toLowerCase().includes(searchQuery) ||
        event.description?.toLowerCase().includes(searchQuery);

      const alreadyJoined = userEntryIds.has(event.id);

      return matchesSearch && !alreadyJoined;
    });
  }, [events, searchQuery, userEntryIds]);

  return (
    <div className="flex flex-col pb-8 -mx-6">

      <div className="flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-white/20 font-black uppercase tracking-widest text-xs">Loading Events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4 bg-card rounded-3xl border border-border">
            <Clock size={48} />
            <p className="font-bold">No active events yet.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4 bg-card rounded-3xl border border-border animate-in fade-in duration-300">
            <Search className="text-muted-foreground/20" size={48} />
            <div className="text-center">
              <p className="font-bold text-foreground">No matches found</p>
              <p className="text-xs mt-1">Try a different keyword</p>
            </div>
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <div
              key={event.id}
              className="animate-in slide-in-from-bottom-4 fade-in duration-700 fill-mode-backwards"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <EventCard
                event={event}
                entryCount={entryCounts[event.id] || 0}
                onEnter={handleEnterEvent}
                onShare={handleShareFacebook}
                userId={userId}
                isAdmin={isAdmin}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
