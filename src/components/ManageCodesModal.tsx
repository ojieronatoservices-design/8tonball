"use client"

import React, { useState, useEffect } from 'react'
import { X, Key, Upload, Download, Loader2, Database, CheckCircle2, ShieldAlert, BarChart3, Copy, CopyCheck } from 'lucide-react'

interface ManageCodesModalProps {
    raffleId: string
    displayId: string
    isCampaignMode?: boolean
    onClose: () => void
}

export function ManageCodesModal({ raffleId, displayId, isCampaignMode = false, onClose }: ManageCodesModalProps) {
    const [activeTab, setActiveTab] = useState<'analytics' | 'generate' | 'upload'>('analytics')
    const [generateCount, setGenerateCount] = useState('1000')
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    // Analytics State
    const [isLoadingStats, setIsLoadingStats] = useState(true)
    const [stats, setStats] = useState<{ total: number, used: number } | null>(null)
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    // Prefix state
    const [codePrefix, setCodePrefix] = useState('')

    useEffect(() => {
        fetchStats()
    }, [raffleId, isCampaignMode])

    const fetchStats = async () => {
        setIsLoadingStats(true)
        try {
            const param = isCampaignMode ? `campaignId=${raffleId}` : `raffleId=${raffleId}`
            const res = await fetch(`/api/business/codes?action=stats&${param}`)
            const json = await res.json()
            if (res.ok && json.stats) {
                setStats(json.stats)
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        } finally {
            setIsLoadingStats(false)
        }
    }

    const handleGenerate = async (countOverride?: number) => {
        setIsProcessing(true)
        setStatusMessage(null)
        const countToUse = countOverride || parseInt(generateCount)
        try {
            if (isNaN(countToUse) || countToUse <= 0 || countToUse > 100000) {
                throw new Error('Please enter a valid count between 1 and 100,000')
            }

            // Generate locally with optional prefix
            const generateRandomCode = () => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
                const base = `${segment()}-${segment()}-${segment()}`
                return codePrefix ? `${codePrefix.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${base}` : base
            }

            const generatedSet = new Set<string>()
            while (generatedSet.size < countToUse) {
                generatedSet.add(generateRandomCode())
            }
            const codes = Array.from(generatedSet)

            // Send via upload action so we can control exactly what string is made (prefix support)
            const res = await fetch('/api/business/codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'upload',
                    raffleId: isCampaignMode ? undefined : raffleId,
                    campaignId: isCampaignMode ? raffleId : undefined,
                    codes
                })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to generate codes')

            // If it's a single "Quick Issue" code, copy to clipboard
            if (countOverride === 1) {
                const newCode = codes[0]
                await navigator.clipboard.writeText(newCode)
                setCopiedCode(newCode)
                setStatusMessage({ text: `Code ${newCode} generated and copied to clipboard!`, type: 'success' })
                setTimeout(() => setCopiedCode(null), 3000)
            } else {
                setStatusMessage({ text: `Successfully generated ${json.inserted?.toLocaleString()} codes!`, type: 'success' })
            }

            fetchStats() // refresh stats
        } catch (error: any) {
            setStatusMessage({ text: error.message, type: 'error' })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleUpload = async () => {
        if (!csvFile) {
            setStatusMessage({ text: 'Please select a CSV file first', type: 'error' })
            return
        }

        setIsProcessing(true)
        setStatusMessage(null)

        try {
            const text = await csvFile.text()
            // Assume codes are separated by commas or newlines
            const codes = text
                .split(/[\n,]/)
                .map(c => c.trim())
                .filter(c => c.length > 0)

            if (codes.length === 0) throw new Error('No valid codes found in CSV')
            if (codes.length > 100000) throw new Error('Too many codes. Maximum is 100,000 at a time.')

            const res = await fetch('/api/business/codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'upload',
                    raffleId: isCampaignMode ? undefined : raffleId,
                    campaignId: isCampaignMode ? raffleId : undefined,
                    codes
                })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to upload codes')

            setStatusMessage({ text: `Successfully uploaded ${json.inserted?.toLocaleString()} codes!`, type: 'success' })
            setCsvFile(null)
            fetchStats() // refresh
        } catch (error: any) {
            setStatusMessage({ text: error.message, type: 'error' })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDownload = async () => {
        setIsDownloading(true)
        setStatusMessage(null)
        try {
            const queryParam = isCampaignMode ? `campaignId=${raffleId}` : `raffleId=${raffleId}`
            const res = await fetch(`/api/business/codes?${queryParam}`)
            const json = await res.json()

            if (!res.ok) throw new Error(json.error || 'Failed to fetch codes')

            if (!json.codes || json.codes.length === 0) {
                setStatusMessage({ text: 'No codes found for this event.', type: 'error' })
                return
            }

            // Create CSV with enhanced details
            const csvContent = "Code,Used,Redeemed By,Redeemed At\n" +
                json.codes.map((c: any) => {
                    const email = c.used_by_profile?.email || (c.is_used ? 'Unknown' : '')
                    const date = c.used_at ? new Date(c.used_at).toLocaleString() : ''
                    return `"${c.code}",${c.is_used},"${email}","${date}"`
                }).join("\n")
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = url
            link.download = `CampaignCodes_${displayId.replace('#', '')}.csv`
            link.click()
            URL.revokeObjectURL(url)

        } catch (error: any) {
            setStatusMessage({ text: error.message, type: 'error' })
        } finally {
            setIsDownloading(false)
        }
    }

    const redemptionRate = stats && stats.total > 0 ? ((stats.used / stats.total) * 100).toFixed(1) : '0.0'

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                            <BarChart3 className="text-primary" size={20} /> Campaign Dashboard
                        </h3>
                        <p className="text-xs text-white/40 font-black tracking-widest mt-1 uppercase">
                            {isCampaignMode ? 'Campaign' : 'Event'} {displayId}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 flex flex-col gap-6">

                    <div className="flex bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => { setActiveTab('analytics'); setStatusMessage(null) }}
                            className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                        >
                            ROI & Stats
                        </button>
                        <button
                            onClick={() => { setActiveTab('generate'); setStatusMessage(null) }}
                            className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'generate' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                        >
                            Generate
                        </button>
                        <button
                            onClick={() => { setActiveTab('upload'); setStatusMessage(null) }}
                            className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                        >
                            Upload
                        </button>
                    </div>

                    {activeTab === 'analytics' && (
                        <div className="flex flex-col gap-6">
                            {isLoadingStats ? (
                                <div className="py-20 flex justify-center"><Loader2 size={32} className="animate-spin text-primary/30" /></div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Codes</span>
                                            <span className="text-3xl font-black text-white">{stats?.total.toLocaleString() || '0'}</span>
                                        </div>
                                        <div className="bg-primary/10 p-6 rounded-2xl border border-primary/20 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Redemption Rate</span>
                                            <span className="text-3xl font-black text-primary">{redemptionRate}%</span>
                                            <span className="text-[10px] font-bold text-primary/40 mt-1">{stats?.used.toLocaleString()} Redeemed</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                        <div className="flex justify-between items-end mb-3">
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Progress</span>
                                            <span className="text-xs font-black">{stats?.used.toLocaleString()} / {stats?.total.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-1000 ease-out relative"
                                                style={{ width: `${Math.min(100, Math.max(0, parseFloat(redemptionRate)))}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleGenerate(1)}
                                            disabled={isProcessing}
                                            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl border border-white/10 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isProcessing && generateCount === '1000' ? <Loader2 size={16} className="animate-spin" /> :
                                                copiedCode ? <CopyCheck size={16} className="text-green-500" /> : <Copy size={16} />}
                                            {copiedCode ? 'Copied to Clipboard!' : 'Quick Issue: Generate 1 Code'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'generate' && (
                        <div className="flex flex-col gap-4 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/50 ml-1">Number of Codes to Generate</label>
                                <input
                                    type="number"
                                    value={generateCount}
                                    onChange={(e) => setGenerateCount(e.target.value)}
                                    placeholder="e.g. 5000"
                                    max="100000"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/50 ml-1">Custom Brand Prefix (Optional)</label>
                                <input
                                    type="text"
                                    value={codePrefix}
                                    onChange={(e) => setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                    placeholder="e.g. NIKE"
                                    maxLength={10}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none"
                                />
                                <p className="text-[10px] text-white/30 ml-1">Example: {codePrefix ? `${codePrefix}-A7F9-K2M1...` : 'A7F9-K2M1...'}</p>
                            </div>

                            <button
                                onClick={() => handleGenerate()}
                                disabled={isProcessing}
                                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
                                {isProcessing ? 'Generating...' : 'Generate Batch'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="flex flex-col gap-4 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase tracking-widest font-black text-white/50 ml-1">Upload CSV</label>
                                <label className="w-full aspect-[4/1] bg-white/5 border border-white/10 border-dashed rounded-xl flex flex-col items-center justify-center text-white/30 hover:text-white/60 hover:border-white/30 cursor-pointer transition-colors group">
                                    <input type="file" className="hidden" accept=".csv,.txt" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                                    <Upload size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold">{csvFile ? csvFile.name : 'Click to Browse File'}</span>
                                </label>
                                <p className="text-[10px] text-white/30 ml-1">Accepted formats: .csv or .txt (comma or newline separated)</p>
                            </div>
                            <button
                                onClick={handleUpload}
                                disabled={isProcessing || !csvFile}
                                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing && <Loader2 size={18} className="animate-spin" />}
                                {isProcessing ? 'Uploading...' : 'Upload Codes'}
                            </button>
                        </div>
                    )}

                    {statusMessage && (
                        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {statusMessage.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <ShieldAlert size={16} className="shrink-0" />}
                            {statusMessage.text}
                        </div>
                    )}

                    <div className="pt-6 border-t border-white/10 mt-2">
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="w-full py-4 bg-white/5 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {isDownloading ? 'Fetching...' : 'Download Redemption CSV Data'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
} 
