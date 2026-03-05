"use client"

import React, { useState, useEffect, memo } from 'react'
import { Plus, X, Loader2, ChevronDown, Image as ImageIcon } from 'lucide-react'
import { isVideo } from '../utils'

const CreateEventModal = memo(({
    isAdmin,
    isHostEligible,
    onLaunch,
    getClient,
    userId,
    existingEventsCount,
    campaigns,
    onClose
}: {
    isAdmin: boolean,
    isHostEligible: boolean,
    onLaunch: () => void,
    getClient: () => Promise<any>,
    userId: string | null | undefined,
    existingEventsCount: number,
    campaigns: any[],
    onClose: () => void
}) => {
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
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')

    // Cleanup Object URLs on unmount
    useEffect(() => {
        return () => {
            eventPreviews.forEach(url => URL.revokeObjectURL(url))
        }
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
        // Reset the input value so the same file can be selected again if needed
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
        console.log('[Admin] Launching event:', { title, cost, goal, drawTime })
        try {
            const mediaUrls: string[] = []
            if (eventImages.length > 0) {
                console.log(`[Admin] Uploading ${eventImages.length} images in parallel...`)
                const uploadPromises = eventImages.map(async (image) => {
                    const fileExt = image.name.split('.').pop()
                    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                    const filePath = `raffles/${fileName}`
                    const { error: uploadError } = await supabaseClient.storage.from('media').upload(filePath, image)
                    if (uploadError) {
                        console.error('[Admin] Upload error:', uploadError)
                        throw uploadError
                    }
                    const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(filePath)
                    return publicUrl
                })
                const results = await Promise.all(uploadPromises)
                mediaUrls.push(...results)
            }

            const date = new Date()
            const monthLetter = date.toLocaleString('default', { month: 'short' })[0].toUpperCase()
            const yearShort = date.getFullYear().toString().slice(-2)

            // Get the total count of events to generate a unique display ID
            const { count: totalCount } = await supabaseClient
                .from('raffles')
                .select('*', { count: 'exact', head: true })

            const displayId = `#${monthLetter}${yearShort}.${(totalCount || 0) + 1}`

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
                requires_code: requiresCode,
                campaign_id: requiresCode && selectedCampaignId ? selectedCampaignId : null
            }])

            if (insertError) {
                console.error('[Admin] Insert error:', insertError)
                throw insertError
            }

            console.log('[Admin] Event launched successfully!')
            alert('Event launched successfully!')
            onLaunch()
            onClose()
        } catch (error: any) {
            console.error('[Admin] Launch failed:', error)
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
                    <div className="flex flex-col gap-1.5" >
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
                                min="0"
                                disabled={requiresCode}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50 cursor-not-allowed" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs) <span className="text-white/15">(0 for Free)</span></label>
                            <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="0"
                                min="0"
                                disabled={requiresCode}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50 cursor-not-allowed" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Attach Campaign</label>
                        {(() => {
                            const availableCampaigns = campaigns.filter(c => !c.raffles || c.raffles.length === 0)

                            if (campaigns.length === 0) {
                                return (
                                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                        <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider leading-relaxed">
                                            ⚠️ NO CAMPAIGNS FOUND. PLEASE CREATE A CAMPAIGN IN THE "CAMPAIGNS" TAB FIRST TO USE ENTRY CODES.
                                        </p>
                                    </div>
                                )
                            }

                            if (availableCampaigns.length === 0 && campaigns.length > 0) {
                                return (
                                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                        <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider leading-relaxed">
                                            ⚠️ ALL YOUR CAMPAIGNS ARE ALREADY ATTACHED TO OTHER EVENTS. CREATE A NEW CAMPAIGN FIRST.
                                        </p>
                                    </div>
                                )
                            }

                            return (
                                <div className="relative group">
                                    <select
                                        value={selectedCampaignId}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setSelectedCampaignId(val)
                                            if (val) {
                                                setRequiresCode(true)
                                                setCost('0')
                                                setGoal('0')
                                            }
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none appearance-none cursor-pointer group-hover:bg-white/[0.07] transition-colors"
                                    >
                                        <option value="" className="bg-background">-- NO CAMPAIGN ATTACHED --</option>
                                        {availableCampaigns.map(c => (
                                            <option key={c.id} value={c.id} className="bg-background">
                                                {c.name} ({c.campaign_codes?.[0]?.count || 0} Codes)
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover:text-white/40 transition-colors">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                            )
                        })()}
                        <p className="text-[10px] text-white/20 mt-1 px-1">Attaching a campaign enables entry codes for this event.</p>
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
                                } else {
                                    setSelectedCampaignId('')
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
                        {isLaunching ? 'Launching...' : (!isAdmin && !isHostEligible) ? 'Eligibility Required' : 'Launch'}
                    </button>
                </div>
            </div>
        </div>
    )
})

CreateEventModal.displayName = 'CreateEventModal'

export { CreateEventModal }
