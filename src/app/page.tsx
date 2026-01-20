"use client"

import React, { useEffect, useState } from 'react'
import { Trophy, Clock, Users, ArrowRight, Loader2, Share2, Facebook, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

const formatTimeLeft = (endsAt: string) => {
  if (!endsAt) return 'No end date'
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Drawing Now'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m left`
}

const RaffleCard = ({ raffle, onEnter, onShare }: { raffle: any, onEnter: (id: string, cost: number) => void, onShare: (r: any) => void }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const images = raffle.media_urls && raffle.media_urls.length > 0 ? raffle.media_urls : ['https://via.placeholder.com/800x500?text=No+Image']

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="group relative bg-card rounded-3xl overflow-hidden border border-white/5 hover:border-primary/20 transition-all duration-300">
      {/* Image Section */}
      <div className="aspect-[16/10] overflow-hidden relative">
        <img
          src={images[currentImageIndex]}
          alt={raffle.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Carousel Controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            >
              <ChevronRight size={16} />
            </button>
            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_: any, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => onShare(raffle)}
          className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-md rounded-2xl text-white/80 hover:text-primary transition-colors border border-white/10"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Content Section */}
      <div className="p-6 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold">{raffle.title}</h3>
            <p className="text-white/40 text-xs line-clamp-1">{raffle.description}</p>
          </div>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 text-xs font-black">
            {raffle.entry_cost_tibs} TIBS
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold text-white/30">
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-primary" />
            <span>Multiple Entries</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-primary" />
            <span>{formatTimeLeft(raffle.ends_at)}</span>
          </div>
        </div>


        <div className="flex gap-2">
          <button
            onClick={() => onEnter(raffle.id, raffle.entry_cost_tibs)}
            className="flex-1 py-4 bg-primary text-black rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-200 active:scale-95 shadow-lg shadow-primary/10"
          >
            Enter Raffle
          </button>
          <button
            onClick={() => onShare(raffle)}
            className="aspect-square w-[52px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-colors"
          >
            <Facebook size={20} className="text-[#1877F2]" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [raffles, setRaffles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { userId, isSignedIn } = useAuth()
  const { user } = useUser()
  const { getClient } = useSupabase()

  const fetchRaffles = async () => {
    const supabaseClient = await getClient()
    if (!supabaseClient) return

    setIsLoading(true)
    try {
      const { data, error } = await supabaseClient
        .from('raffles')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRaffles(data || [])
    } catch (error) {
      console.error('Error fetching raffles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRaffles()
  }, [userId])

  const handleEnterRaffle = async (raffleId: string, cost: number) => {
    if (!isSignedIn) {
      alert('Please log in to enter raffles.')
      return
    }

    const supabaseClient = await getClient()
    if (!supabaseClient) return

    if (!confirm(`Enter this raffle for ${cost} Tibs?`)) return

    try {
      const { data, error } = await supabaseClient.rpc('enter_raffle', {
        p_raffle_id: raffleId
      })

      if (error) throw error

      if (data.success) {
        alert('Entry successful! Good luck!')
      } else {
        alert(data.message || 'Failed to enter raffle.')
      }
    } catch (error: any) {
      console.error('Error entering raffle:', error)
      alert(error.message || 'Error entering raffle.')
    }
  }


  const handleShareFacebook = (raffle: any) => {
    const url = window.location.origin + '/raffle/' + raffle.id // Placeholder for detail page
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(`Check out this raffle for ${raffle.title} on 8TONBALL!`)}`
    window.open(shareUrl, '_blank', 'width=600,height=400')
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Active Raffles</h2>
        <p className="text-white/40 text-sm">Tap to enter and try your luck.</p>
      </div>

      <div className="flex flex-col gap-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-white/20 font-black uppercase tracking-widest text-xs">Loading Raffles...</p>
          </div>
        ) : raffles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4 bg-card rounded-3xl border border-white/5">
            <Clock size={48} />
            <p className="font-bold">No active raffles yet.</p>
          </div>
        ) : (
          raffles.map((raffle) => (
            <RaffleCard
              key={raffle.id}
              raffle={raffle}
              onEnter={handleEnterRaffle}
              onShare={handleShareFacebook}
            />
          ))
        )}
      </div>

    </div>
  )
}


