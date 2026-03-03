"use client"

import React, { useState } from 'react'
import { X, Key, Upload, Download, Loader2, Database, CheckCircle2, ShieldAlert } from 'lucide-react'

interface ManageCodesModalProps {
    raffleId: string
    displayId: string
    onClose: () => void
}

export function ManageCodesModal({ raffleId, displayId, onClose }: ManageCodesModalProps) {
    const [activeTab, setActiveTab] = useState<'generate' | 'upload'>('generate')
    const [generateCount, setGenerateCount] = useState('1000')
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    const handleGenerate = async () => {
        setIsProcessing(true)
        setStatusMessage(null)
        try {
            const count = parseInt(generateCount)
            if (isNaN(count) || count <= 0 || count > 100000) {
                throw new Error('Please enter a valid count between 1 and 100,000')
            }

            const res = await fetch('/api/business/codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate', raffleId, count })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to generate codes')

            setStatusMessage({ text: `Successfully generated ${json.inserted?.toLocaleString()} codes!`, type: 'success' })
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
                body: JSON.stringify({ action: 'upload', raffleId, codes })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to upload codes')

            setStatusMessage({ text: `Successfully uploaded ${json.inserted?.toLocaleString()} codes!`, type: 'success' })
            setCsvFile(null)
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
            const res = await fetch(`/api/business/codes?raffleId=${raffleId}`)
            const json = await res.json()

            if (!res.ok) throw new Error(json.error || 'Failed to fetch codes')

            if (!json.codes || json.codes.length === 0) {
                setStatusMessage({ text: 'No codes found for this event.', type: 'error' })
                return
            }

            // Create CSV
            const csvContent = "Code,Used\n" + json.codes.map((c: any) => `${c.code},${c.is_used}`).join("\n")
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

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 overflow-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                            <Key className="text-primary" size={20} /> Manage Campaign Codes
                        </h3>
                        <p className="text-xs text-white/40 font-black tracking-widest mt-1 uppercase">Event {displayId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 flex flex-col gap-6">

                    <div className="flex bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'generate' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                        >
                            Generate New
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 py-3 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                        >
                            Upload Custom
                        </button>
                    </div>

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
                                <p className="text-[10px] text-white/30 ml-1">Generates random high-entropy codes (e.g. A7F9-K2M1-XYZ9)</p>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isProcessing}
                                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/10 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing && <Loader2 size={18} className="animate-spin" />}
                                {isProcessing ? 'Generating...' : 'Generate Codes'}
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
                            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                            {statusMessage.text}
                        </div>
                    )}

                    <div className="pt-6 border-t border-white/10 mt-2">
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="w-full py-4 bg-white/5 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                            {isDownloading ? 'Fetching...' : 'Download Existing Codes Database'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
} 
