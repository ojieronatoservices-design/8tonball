"use client"

import React, { useEffect, useState, useRef } from 'react'
import { useUser, useAuth } from '@clerk/nextjs'
import { useSupabase } from '@/hooks/useSupabase'

export default function DebugRealtimePage() {
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    const { getClient } = useSupabase()
    const [logs, setLogs] = useState<string[]>([])
    const [status, setStatus] = useState<string>('Initializing...')
    const supabaseRef = useRef<any>(null)

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
    }

    useEffect(() => {
        if (!isLoaded || !user) {
            setStatus('Waiting for user...')
            return
        }

        let channel: any = null

        const startDebug = async () => {
            addLog(`User loaded: ${user.id}`)
            setStatus('Getting Supabase client...')

            try {
                const token = await getToken({ template: 'supabase' })
                addLog(`Token retrieved: ${token ? 'YES (' + token.substring(0, 10) + '...)' : 'NO'}`)

                const supabaseClient = await getClient()
                if (!supabaseClient) {
                    addLog('Failed to get supabase client')
                    return
                }
                supabaseRef.current = supabaseClient

                // 1. Test REST API first (Verify Token Validity)
                setStatus('Testing REST API...')
                addLog('Attempting to fetch profile via REST...')
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .single()

                if (error) {
                    addLog(`❌ REST API ERROR: ${error.message}`)
                    addLog('⚠️ CRITICAL: Your Token is invalid. You likely used the wrong secret in Clerk.')
                    setStatus('Token Rejected')
                    return // Stop if REST fails
                } else {
                    addLog('✅ REST API Success! Token is valid.')
                }

                // 2. Connect to Realtime
                setStatus('Connecting to Realtime...')
                addLog('Creating channel: debug-notifications')

                channel = supabaseClient
                    .channel('debug-notifications')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                    }, (payload: any) => {
                        addLog(`🔔 REALTIME EVENT RECEIVED: ${payload.eventType}`)
                        console.log('Full Payload:', payload)
                        addLog(`Payload: ${JSON.stringify(payload.new)}`)
                    })
                    .on('system', { event: '*' }, (payload: any) => {
                        addLog(`System Event: ${payload.event}`)
                        console.log('System Event:', payload)
                    })
                    .subscribe((status: string) => {
                        setStatus(`Subscription Status: ${status}`)
                        addLog(`Channel status changed: ${status}`)

                        if (status === 'SUBSCRIBED') {
                            addLog('✅ Successfully connected to Realtime!')
                            addLog('Waiting for notifications...')
                        }
                    })

            } catch (err: any) {
                addLog(`ERROR: ${err.message}`)
            }
        }

        startDebug()

        return () => {
            if (channel && supabaseRef.current) {
                addLog('Cleaning up channel...')
                supabaseRef.current.removeChannel(channel)
            }
        }
    }, [isLoaded, user])

    return (
        <div className="min-h-screen bg-black text-white p-8 font-mono text-sm">
            <h1 className="text-2xl font-bold mb-4 text-green-500">Realtime Debugger</h1>

            <div className="mb-6 p-4 border border-white/20 rounded-lg bg-white/5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-white/40 uppercase text-xs">Status</p>
                        <p className="font-bold text-lg">{status}</p>
                    </div>
                    <div>
                        <p className="text-white/40 uppercase text-xs">User ID</p>
                        <p>{user?.id || '...'}</p>
                    </div>
                </div>
            </div>

            <div className="border border-white/20 rounded-lg bg-black overflow-hidden flex flex-col h-[600px]">
                <div className="p-2 bg-white/10 border-b border-white/20 font-bold flex justify-between">
                    <span>Logs</span>
                    <button onClick={() => setLogs([])} className="text-xs hover:text-white/80">Clear</button>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1">
                    {logs.map((log, i) => (
                        <div key={i} className={`pb-1 border-b border-white/5 ${log.includes('ERROR') ? 'text-red-500' : log.includes('✅') ? 'text-green-500' : log.includes('🔔') ? 'text-yellow-400 font-bold' : 'text-white/70'}`}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-white/20 italic">No logs yet...</div>}
                </div>
            </div>

            <div className="mt-8 text-xs text-white/30">
                <p>Instructions:</p>
                <ol className="list-decimal pl-4 space-y-1 mt-2">
                    <li>Keep this page open.</li>
                    <li>Wait for "SUBSCRIBED" status.</li>
                    <li>In another tab/window, trigger a notification (e.g. draw an event).</li>
                    <li>Watch for "🔔 REALTIME EVENT RECEIVED" here.</li>
                </ol>
            </div>
        </div>
    )
}
