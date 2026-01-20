"use client"

import React, { useState } from 'react'
import { Plus, Check, X, Image as ImageIcon, Trash2, LayoutDashboard, Camera, Loader2, CheckCircle2, Trophy, Settings, LogOut } from 'lucide-react'
import { useUser, useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

export default function AdminDashboard() {
    const { user } = useUser()
    const { userId } = useAuth()
    const { getClient } = useSupabase()
    const [activeTab, setActiveTab] = useState<'raffles' | 'payments'>('raffles')
    const [raffleImages, setRaffleImages] = useState<File[]>([])
    const [rafflePreviews, setRafflePreviews] = useState<string[]>([])
    const [isLaunching, setIsLaunching] = useState(false)

    // Form State
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [cost, setCost] = useState('')
    const [drawTime, setDrawTime] = useState('')

    // Payments State
    const [payments, setPayments] = useState<any[]>([])
    const [isLoadingPayments, setIsLoadingPayments] = useState(false)

    // Manage Raffles State
    const [existingRaffles, setExistingRaffles] = useState<any[]>([])
    const [isLoadingRaffles, setIsLoadingRaffles] = useState(false)

    const fetchRaffles = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoadingRaffles(true)
        try {
            const { data, error } = await supabaseClient
                .from('raffles')
                .select('*, entries(count)')
                .order('created_at', { ascending: false })

            if (error) throw error
            setExistingRaffles(data || [])
        } catch (error) {
            console.error('Error fetching raffles:', error)
        } finally {
            setIsLoadingRaffles(false)
        }
    }

    const fetchPayments = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        setIsLoadingPayments(true)
        try {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*, profiles(email, display_name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            setPayments(data || [])
        } catch (error) {
            console.error('Error fetching payments:', error)
        } finally {
            setIsLoadingPayments(false)
        }
    }

    React.useEffect(() => {
        if (activeTab === 'payments') {
            fetchPayments()
        } else if (activeTab === 'raffles') {
            fetchRaffles()
        }
    }, [activeTab, userId])

    const handleDrawWinner = async (raffleId: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!confirm('Are you sure you want to draw a winner now?')) return

        try {
            // 1. Get all entries for this raffle
            const { data: entries, error: entriesError } = await supabaseClient
                .from('entries')
                .select('user_id')
                .eq('raffle_id', raffleId)

            if (entriesError) throw entriesError
            if (!entries || entries.length === 0) {
                alert('No entries found for this raffle.')
                return
            }

            // 2. Randomly select a winner
            const winner = entries[Math.floor(Math.random() * entries.length)]

            // 3. Update raffle status and winner
            const { error: updateError } = await supabaseClient
                .from('raffles')
                .update({
                    status: 'drawn',
                    winner_user_id: winner.user_id,
                    drawn_at: new Date().toISOString()
                })
                .eq('id', raffleId)

            if (updateError) throw updateError

            // 4. Create notification for the winner
            await supabaseClient.from('notifications').insert([{
                user_id: winner.user_id,
                message: `Congratulations! You won the raffle! Check your profile for details.`,
                type: 'win'
            }])

            alert('Winner drawn successfully!')
            fetchRaffles()
        } catch (error: any) {
            console.error('Error drawing winner:', error)
            alert(error.message || 'Error drawing winner.')
        }
    }

    const handleApprove = async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { data, error } = await supabaseClient.rpc('approve_transaction', {
                p_transaction_id: id
            })

            if (error) throw error

            alert('Payment approved and Tibs credited!')
            fetchPayments()
        } catch (error: any) {
            alert(error.message || 'Error approving payment')
        }
    }

    const handleReject = async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { error } = await supabaseClient
                .from('transactions')
                .update({ status: 'rejected' })
                .eq('id', id)

            if (error) throw error

            alert('Payment rejected.')
            fetchPayments()
        } catch (error: any) {
            alert(error.message || 'Error rejecting payment')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const newFiles = Array.from(files)
            setRaffleImages(prev => [...prev, ...newFiles])

            // Generate previews
            const newPreviews = newFiles.map(file => URL.createObjectURL(file))
            setRafflePreviews(prev => [...prev, ...newPreviews])
        }
    }

    const removeImage = (index: number) => {
        setRaffleImages(prev => prev.filter((_, i) => i !== index))
        setRafflePreviews(prev => {
            const newPreviews = prev.filter((_, i) => i !== index)
            // Revoke the old URL to avoid memory leaks (optional but good practice)
            // URL.revokeObjectURL(prev[index]) 
            return newPreviews
        })
    }

    const handleLaunchRaffle = async () => {
        if (!title || !cost || !drawTime) {
            alert('Please fill in all required fields (Title, Cost, Draw Time)')
            return
        }

        const supabaseClient = await getClient()
        if (!supabaseClient || !userId) {
            alert('You must be logged in to launch a raffle.')
            return
        }

        setIsLaunching(true)
        try {
            const mediaUrls: string[] = []

            // 1. Upload Images to Supabase Storage
            if (raffleImages.length > 0) {
                for (const image of raffleImages) {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`

                    const { error: uploadError } = await supabaseClient.storage
                        .from('media')
                        .upload(filePath, image)

                    if (uploadError) throw uploadError

                    const { data: { publicUrl } } = supabaseClient.storage
                        .from('media')
                        .getPublicUrl(filePath)

                    mediaUrls.push(publicUrl)
                }
            }

            // 2. Insert Raffle into Database
            const { error: insertError } = await supabaseClient
                .from('raffles')
                .insert([{
                    title,
                    description,
                    entry_cost_tibs: parseInt(cost),
                    ends_at: new Date(drawTime).toISOString(),
                    media_urls: mediaUrls,
                    host_user_id: userId,
                    status: 'open'
                }])

            if (insertError) throw insertError

            alert('Raffle launched successfully!')
            // Reset form
            setTitle('')
            setDescription('')
            setCost('')
            setDrawTime('')
            setRaffleImages([])
            setRafflePreviews([])

        } catch (error: any) {
            console.error('Error launching raffle:', error)
            alert(error.message || 'Error launching raffle. Check your connection or permissions.')
        } finally {
            setIsLaunching(false)
        }
    }

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight">Admin Hub</h2>
                    <p className="text-white/40 text-sm">Control center for 8TONBALL.</p>
                </div>
                <div className="bg-primary/20 p-2 rounded-xl border border-primary/30">
                    <LayoutDashboard className="text-primary" size={24} />
                </div>
            </div>

            {/* Admin Tabs */}
            <div className="flex bg-card p-1.5 rounded-2xl border border-white/5">
                <button
                    onClick={() => setActiveTab('raffles')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'raffles' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                        }`}
                >
                    Manage Raffles
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'payments' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'
                        }`}
                >
                    Payments Queue
                </button>
            </div>

            {activeTab === 'raffles' ? (
                <div className="flex flex-col gap-10">
                    {/* Create Raffle Card */}
                    <div className="bg-card p-8 rounded-3xl border border-dashed border-primary/30 flex flex-col gap-6">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Plus className="text-primary" size={20} />
                            New Raffle
                        </h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Prize Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. iPhone 15 Pro"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Prize details..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label>
                                <input
                                    type="datetime-local"
                                    value={drawTime}
                                    onChange={(e) => setDrawTime(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs)</label>
                                    <input
                                        type="number"
                                        value={cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        placeholder="100"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media (Multiple allowed)</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {rafflePreviews.map((preview, index) => (
                                            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={14} className="text-white" />
                                                </button>
                                            </div>
                                        ))}

                                        <label className="aspect-square bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors group">
                                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                                            <Plus size={18} className="group-hover:text-primary transition-colors" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleLaunchRaffle}
                                disabled={isLaunching}
                                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLaunching && <Loader2 size={18} className="animate-spin" />}
                                {isLaunching ? 'Launching...' : 'Launch'}
                            </button>
                        </div>
                    </div>

                    {/* Active Raffles List */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-bold px-2">Manage Active Raffles</h3>
                        {isLoadingRaffles ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : existingRaffles.filter(r => r.status === 'open').length === 0 ? (
                            <p className="text-white/20 text-center py-10 text-sm font-bold uppercase tracking-widest">No active raffles to draw.</p>
                        ) : (
                            existingRaffles.filter(r => r.status === 'open').map((raffle) => (
                                <div key={raffle.id} className="bg-card p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                                        <img src={raffle.media_urls?.[0] || 'https://via.placeholder.com/150'} alt="proof" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className="font-bold text-sm truncate">{raffle.title}</h4>
                                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                                            {raffle.entries?.[0]?.count || 0} Entries
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDrawWinner(raffle.id)}
                                        className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                                    >
                                        Draw Winner
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {isLoadingPayments ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4 bg-card rounded-3xl border border-white/5">
                            <CheckCircle2 size={48} />
                            <p className="font-bold">Queue is clear!</p>
                        </div>
                    ) : (
                        payments.map((pmt) => (
                            <div key={pmt.id} className="bg-card p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10 group relative cursor-zoom-in">
                                    <img src={pmt.proof_image_url} alt="proof" className="w-full h-full object-cover" />
                                    <a href={pmt.proof_image_url} target="_blank" className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-tighter">View Full</a>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-bold text-sm truncate">{pmt.profiles?.display_name || pmt.profiles?.email || 'Unknown User'}</h4>
                                    <p className="text-primary text-xs font-black">{pmt.requested_tibs} Tibs</p>
                                    <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                                        {new Date(pmt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReject(pmt.id)}
                                        className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleApprove(pmt.id)}
                                        className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center border border-green-500/20 hover:bg-green-500 hover:text-white transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            )}
        </div>
    )
}

