"use client"

import { useState, memo } from 'react'
import { Plus, Loader2, Key, Trash2, AlertCircle } from 'lucide-react'
import { ManageCodesModal } from '@/components/ManageCodesModal'
import { CreateCampaignModal } from './CreateCampaignModal'

const CampaignsManager = memo(({
    campaigns,
    isLoading,
    fetchError,
    fetchCampaigns,
    getClient,
    userId,
    isAdmin,
    showToast
}: {
    campaigns: any[],
    isLoading: boolean,
    fetchError: string | null,
    fetchCampaigns: () => void,
    getClient: () => Promise<any>,
    userId: string | null | undefined,
    isAdmin: boolean,
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [selectedCampaignForCodes, setSelectedCampaignForCodes] = useState<any>(null)

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-black uppercase tracking-widest">Code Campaigns</h2>
                    <button
                        onClick={fetchCampaigns}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-primary transition-colors disabled:opacity-30"
                    >
                        <Loader2 size={10} className={isLoading ? "animate-spin" : ""} />
                        Refresh List
                    </button>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl border border-primary/30 transition-all flex items-center gap-2"
                >
                    <Plus size={14} /> Create Campaign
                </button>
            </div>

            {fetchError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                        <AlertCircle size={14} />
                        Fetch Error
                    </p>
                    <p className="text-[11px] text-white/60 font-medium leading-relaxed">{fetchError}</p>
                    <button onClick={fetchCampaigns} className="text-[9px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 underline text-left">Try Again</button>
                </div>
            )}

            {isLoading ? (
                <div className="py-20 flex justify-center"><Loader2 size={32} className="animate-spin text-primary/30" /></div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-white/5">
                    <Key className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 font-black uppercase tracking-widest text-xs">No campaigns yet</p>
                    <button onClick={() => setIsCreateModalOpen(true)} className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Create your first campaign</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {campaigns.map((camp) => (
                        <div key={camp.id} className="bg-card p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-lg font-black tracking-tight">{camp.name}</h4>
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{new Date(camp.created_at).toLocaleDateString()}</span>
                                        {isAdmin && camp.host && (
                                            <span className="text-[9px] font-black text-primary/40 uppercase tracking-tighter">
                                                Host: {camp.host.display_name} ({camp.host.email})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10 text-xs font-black text-white/40">
                                    {camp.campaign_codes?.[0]?.count || 0} Codes
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCampaignForCodes(camp)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <Key size={14} className="text-primary" /> Manage Codes
                                </button>
                                <button
                                    onClick={async () => {
                                        if (confirm('Are you sure? This will delete the campaign and all its codes.')) {
                                            setIsDeleting(camp.id)
                                            try {
                                                const supabase = await getClient()
                                                const { error } = await supabase.from('campaigns').delete().eq('id', camp.id)
                                                if (error) throw error
                                                showToast('Campaign deleted successfully')
                                                fetchCampaigns()
                                            } catch (err: any) {
                                                showToast(err.message || 'Error deleting campaign', 'error')
                                            } finally {
                                                setIsDeleting(null)
                                            }
                                        }
                                    }}
                                    disabled={isDeleting === camp.id}
                                    className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all disabled:opacity-50"
                                >
                                    {isDeleting === camp.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isCreateModalOpen && (
                <CreateCampaignModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreated={fetchCampaigns}
                    getClient={getClient}
                    userId={userId}
                    showToast={showToast}
                />
            )}

            {selectedCampaignForCodes && (
                <ManageCodesModal
                    raffleId={selectedCampaignForCodes.id} // Reusing ManageCodesModal with campaign ID as it supports codes
                    displayId={selectedCampaignForCodes.name}
                    isCampaignMode={true} // We'll add this prop to ManageCodesModal
                    onClose={() => setSelectedCampaignForCodes(null)}
                />
            )}
        </div>
    )
})
CampaignsManager.displayName = 'CampaignsManager'

export { CampaignsManager }
