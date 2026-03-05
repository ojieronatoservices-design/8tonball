"use client"

import React, { useState, useEffect, memo } from 'react'
import { Plus, X, Loader2, ChevronDown, Trash2 } from 'lucide-react'
import { isVideo } from '../utils'

const EditEventModal = memo(({ event, onClose, campaigns, handleUpdateEvent, isUpdating }: { event: any, onClose: () => void, campaigns: any[], handleUpdateEvent: any, isUpdating: boolean }) => {
    const [editTitle, setEditTitle] = useState(event.title)
    const [editDesc, setEditDesc] = useState(event.description || '')
    const [editCost, setEditCost] = useState(event.entry_cost_tibs.toString())
    const [editGoal, setEditGoal] = useState((event.goal_tibs || 0).toString())
    const [editDrawTime, setEditDrawTime] = useState(new Date(event.ends_at).toISOString().slice(0, 16))
    const [editMediaUrls, setEditMediaUrls] = useState<string[]>(event.media_urls || [])
    const [editRequiresCode, setEditRequiresCode] = useState(event.requires_code || false)
    const [editCampaignId, setEditCampaignId] = useState(event.campaign_id || '')
    const [newFiles, setNewFiles] = useState<File[]>([])
    const [newPreviews, setNewPreviews] = useState<string[]>([])

    useEffect(() => { return () => { newPreviews.forEach(url => URL.revokeObjectURL(url)) } }, [newPreviews])

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-xl font-black tracking-tight">Edit Event</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Title</label><input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" /></div>
                    <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Description</label><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none min-h-[100px]" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Cost (Tibs)</label><input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" /></div>
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Goal (Tibs)</label><input type="number" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none" /></div>
                    </div>
                    <div className="flex flex-col gap-1.5"><label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Draw Time</label><input type="datetime-local" value={editDrawTime} onChange={(e) => setEditDrawTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none [color-scheme:dark]" /></div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Media Management</label>
                        <div className="grid grid-cols-4 gap-2">
                            {editMediaUrls.map((url, idx) => (
                                <div key={`old-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                    {isVideo(url) ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} className="w-full h-full object-cover" />}
                                    <button onClick={() => setEditMediaUrls(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} className="text-white" /></button>
                                </div>
                            ))}
                            {newPreviews.map((preview, idx) => (
                                <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-primary/20 group">
                                    {isVideo(preview) ? <video src={preview} className="w-full h-full object-cover" /> : <img src={preview} className="w-full h-full object-cover" />}
                                    <button onClick={() => { setNewFiles(prev => prev.filter((_, i) => i !== idx)); setNewPreviews(prev => { const url = prev[idx]; if (url) URL.revokeObjectURL(url); return prev.filter((_, i) => i !== idx) }) }} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} className="text-white" /></button>
                                </div>
                            ))}
                            <label className="aspect-square bg-white/5 border border-dashed border-white/20 rounded-xl flex items-center justify-center text-white/20 hover:text-white/40 cursor-pointer transition-colors"><input type="file" className="hidden" accept="image/*,video/*" multiple onChange={(e) => {
                                const files = e.target.files
                                if (files && files.length > 0) {
                                    const fileList = Array.from(files)
                                    setNewFiles(prev => [...prev, ...fileList])
                                    const previews = fileList.map(f => URL.createObjectURL(f))
                                    setNewPreviews(prev => [...prev, ...previews])
                                }
                                e.target.value = ''
                            }} /><Plus size={24} /></label>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-white/80 uppercase tracking-wider">Requires Entry Code</span>
                            <span className="text-[10px] text-white/30">Users must enter a valid alphanumeric code to join</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const newVal = !editRequiresCode
                                setEditRequiresCode(newVal)
                                if (newVal) {
                                    setEditCost('0')
                                    setEditGoal('0')
                                }
                            }}
                            className={`w-12 h-7 rounded-full transition-all duration-200 ${editRequiresCode ? 'bg-primary' : 'bg-white/10'} relative`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all duration-200 ${editRequiresCode ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    {editRequiresCode && (
                        <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] uppercase tracking-widest font-black text-white/30 ml-1">Select Campaign</label>
                            {campaigns.length === 0 ? (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                    <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider leading-relaxed">
                                        ⚠️ NO CAMPAIGNS FOUND. PLEASE CREATE A CAMPAIGN IN THE "CAMPAIGNS" TAB FIRST TO USE ENTRY CODES.
                                    </p>
                                </div>
                            ) : (
                                <select
                                    value={editCampaignId}
                                    onChange={(e) => setEditCampaignId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none appearance-none"
                                >
                                    <option value="" className="bg-background">-- CHOOSE A CAMPAIGN --</option>
                                    {campaigns.map(c => (
                                        <option key={c.id} value={c.id} className="bg-background">
                                            {c.name} ({c.campaign_codes?.[0]?.count || 0} Codes)
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button onClick={() => handleUpdateEvent(event.id, { title: editTitle, description: editDesc, cost: editCost, goal: editGoal, drawTime: editDrawTime, existingMediaUrls: editMediaUrls, requiresCode: editRequiresCode, campaignId: editCampaignId }, newFiles)} disabled={isUpdating} className="flex-1 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95 disabled:opacity-50">
                            {isUpdating ? 'Updating...' : 'Save Changes'}
                        </button>
                        <button onClick={onClose} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest rounded-2xl transition-all">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
})
EditEventModal.displayName = 'EditEventModal'

export { EditEventModal }
