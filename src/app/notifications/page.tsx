"use client"

import React, { useEffect, useState } from 'react'
import { Bell, Trophy, Wallet, Info, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@clerk/nextjs'

export default function NotificationsPage() {
    const { userId, isLoaded: isAuthLoaded } = useAuth()
    const [notifications, setNotifications] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchNotifications = async () => {
        if (!userId) return
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotifications(data || [])
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthLoaded && userId) {
            fetchNotifications()
        } else if (isAuthLoaded && !userId) {
            setIsLoading(false)
        }
    }, [isAuthLoaded, userId])


    const getIcon = (type: string) => {
        switch (type) {
            case 'win': return <Trophy className="text-primary" size={20} />
            case 'payment': return <Wallet className="text-green-500" size={20} />
            default: return <Info className="text-blue-500" size={20} />
        }
    }

    const formatTime = (date: string) => {
        const d = new Date(date)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tight">Activity</h2>
                <p className="text-white/40 text-sm">Your recent system updates.</p>
            </div>

            <div className="flex flex-col gap-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-primary" size={40} />
                        <p className="text-white/20 font-black uppercase tracking-widest text-xs">Syncing...</p>
                    </div>
                ) : notifications.length > 0 ? (
                    notifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`p-5 rounded-3xl border transition-all duration-300 flex gap-4 ${notif.is_read ? 'bg-card border-white/5 opacity-60' : 'bg-primary/5 border-primary/20 neon-border'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                                {getIcon(notif.type)}
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className={`text-sm leading-relaxed ${notif.is_read ? 'text-white/80' : 'text-white font-bold'}`}>
                                    {notif.message}
                                </p>
                                <span className="text-[10px] uppercase font-black tracking-widest text-white/20">
                                    {formatTime(notif.created_at)}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-20 gap-4 bg-card rounded-3xl border border-white/5">
                        <Bell size={48} />
                        <p className="font-bold uppercase tracking-widest text-xs">No notifications yet</p>
                    </div>
                )}
            </div>
        </div>
    )
}
