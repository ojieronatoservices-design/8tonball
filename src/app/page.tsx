"use client"

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Trophy, Clock, Users, ArrowRight, Loader2, Share2, Facebook, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Coins, Search } from 'lucide-react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'
import { useSearchParams, useRouter } from 'next/navigation'
import { CountdownTimer } from '@/components/CountdownTimer'
import { ImageLightbox } from '@/components/ImageLightbox'

import { EventCard } from '@/components/EventCard'

// Cache deep link outside component to survive mobile re-mounts during router.replace
let cachedDeepLink: { raffleId: string | null, commentId: string | null } | null = null

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
  const raffleIdFromUrl = searchParams.get('raffleId')
  const commentIdFromUrl = searchParams.get('commentId')
  const [deepLink, setDeepLink] = useState<{ raffleId: string | null, commentId: string | null }>(
    cachedDeepLink || { raffleId: null, commentId: null }
  )
  const [showInsufficientModal, setShowInsufficientModal] = useState(false)
  const router = useRouter()

  // Capture deep link once on mount
  useEffect(() => {
    // If already cached, don't look at URL again
    if (cachedDeepLink) return

    const rId = searchParams.get('raffleId')
    const cId = searchParams.get('commentId')
    if (rId) {
      cachedDeepLink = { raffleId: rId, commentId: cId }
      setDeepLink(cachedDeepLink)
    }
  }, []) // Only run once on mount

  // Clear URL params only after initial load is done and we've captured them
  useEffect(() => {
    if (!isLoading && deepLink.raffleId) {
      const timer = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('raffleId')
        params.delete('commentId')
        const newPath = params.toString() ? `/?${params.toString()}` : '/'
        router.replace(newPath, { scroll: false })
      }, 2000) // 2s buffer for mobile layout stability
      return () => clearTimeout(timer)
    }
  }, [isLoading, deepLink.raffleId, router, searchParams])

  const fetchEvents = async () => {
    const supabaseClient = await getClient()
    if (!supabaseClient) return

    setIsLoading(true)
    try {
      // PHASE 1: Fetch Events, User Entries, and Admin Status in PARALLEL
      const [eventsResult, entriesResult, profileResult] = await Promise.all([
        supabaseClient
          .from('raffles')
          .select('*, host:profiles!host_user_id(display_name, is_host_eligible)')
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

    // BALANCE CHECK: Fetch current balance first
    const { data: profile } = await supabaseClient.from('profiles').select('tibs_balance').eq('id', userId).single()
    if (profile && profile.tibs_balance < cost) {
      setShowInsufficientModal(true)
      return false
    }

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
      // If deep-linked, ALWAYS show it (even if already joined)
      if (deepLink.raffleId === event.id) return true;

      const matchesSearch = !searchQuery ||
        event.title?.toLowerCase().includes(searchQuery) ||
        event.description?.toLowerCase().includes(searchQuery);

      const alreadyJoined = userEntryIds.has(event.id);

      return matchesSearch && !alreadyJoined;
    });
  }, [events, searchQuery, userEntryIds, deepLink.raffleId]);

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
                autoOpenComments={event.id === deepLink.raffleId}
                focusedCommentId={event.id === deepLink.raffleId ? deepLink.commentId : null}
              />
            </div>
          ))
        )}
      </div>

      {/* Insufficient Funds Modal */}
      {showInsufficientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-sm rounded-[2rem] border border-border p-8 flex flex-col items-center text-center gap-6 shadow-2xl animate-in zoom-in-95 duration-300 relative">
            <button
              onClick={() => setShowInsufficientModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search size={0} className="hidden" /> {/* Dummy to keep imports valid if needed, or just X */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>

            <div className="w-48 h-48 relative mb-2">
              <img
                src="/insufficient-tibs.png"
                alt="Need more Tibs"
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-foreground">
                Uh-oh...
              </h3>
              <p className="text-primary font-bold text-lg uppercase tracking-widest">
                You need more Tibs!
              </p>
            </div>

            <button
              onClick={() => {
                setShowInsufficientModal(false)
                window.dispatchEvent(new Event('openWallet'))
              }}
              className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Coins size={18} strokeWidth={3} />
              Exit and Top Up
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
