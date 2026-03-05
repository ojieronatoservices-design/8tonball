"use client"

import { useState, memo } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

const CreateCampaignModal = memo(({
    onClose,
    onCreated,
    getClient,
    userId,
    showToast
}: {
    onClose: () => void,
    onCreated: () => void,
    getClient: () => Promise<any>,
    userId: string | null | undefined,
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) => {
    const { user: clerkUser } = useUser() // Unused but keep if needed, actually not needed here
    const [name, setName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        if (!name.trim()) return
        setIsCreating(true)
        try {
            const supabase = await getClient()
            const { error } = await supabase.from('campaigns').insert({
                name: name.trim(),
                host_user_id: userId
            })
            if (error) throw error
            showToast('Campaign created successfully!')
            onCreated()
            onClose()
        } catch (err: any) {
            showToast(err.message || 'Error creating campaign', 'error')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-sm rounded-3xl border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Plus className="text-primary" size={20} /> New Campaign
                </h3>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/30">Campaign Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Summer Drop 2024"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleCreate}
                            disabled={isCreating || !name.trim()}
                            className="flex-1 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isCreating ? <Loader2 className="animate-spin" size={20} /> : 'Create'}
                        </button>
                        <button onClick={onClose} className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black uppercase tracking-widest rounded-2xl transition-all">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
})
CreateCampaignModal.displayName = 'CreateCampaignModal'

export { CreateCampaignModal }
