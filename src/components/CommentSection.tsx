"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Send, Loader2, User, MessageSquare, Trash2 } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth, useUser } from '@clerk/nextjs'

interface Comment {
    id: string
    content: string
    created_at: string
    user_id: string
    profile: {
        display_name: string
    }
}

interface CommentSectionProps {
    raffleId: string
}

export function CommentSection({ raffleId }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isPosting, setIsPosting] = useState(false)
    const { getClient } = useSupabase()
    const { userId } = useAuth()
    const { user } = useUser()
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchComments = async () => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { data, error } = await supabaseClient
                .from('comments')
                .select(`
                    id,
                    content,
                    created_at,
                    user_id,
                    profile:profiles!user_id(display_name)
                `)
                .eq('raffle_id', raffleId)
                .order('created_at', { ascending: true })

            if (error) throw error
            setComments(data || [])
        } catch (error) {
            console.error('Error fetching comments:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchComments()

        let channel: any = null
        const setupRealtime = async () => {
            const supabaseClient = await getClient()
            if (!supabaseClient) return

            channel = supabaseClient
                .channel(`comments:${raffleId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'comments',
                    filter: `raffle_id=eq.${raffleId}`
                }, (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        // We'll need to fetch the profile for the new comment
                        // because realtime payload doesn't include joins
                        fetchComments()
                    } else if (payload.eventType === 'DELETE') {
                        setComments(prev => prev.filter(c => c.id !== payload.old.id))
                    }
                })
                .subscribe()
        }

        setupRealtime()
        return () => {
            if (channel) channel.unsubscribe()
        }
    }, [raffleId])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [comments])

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim() || !userId) return

        setIsPosting(true)
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { error } = await supabaseClient
                .from('comments')
                .insert([{
                    raffle_id: raffleId,
                    user_id: userId,
                    content: newComment.trim()
                }])

            if (error) throw error
            setNewComment('')
        } catch (error) {
            console.error('Error posting comment:', error)
            alert('Failed to post comment.')
        } finally {
            setIsPosting(false)
        }
    }

    const handleDeleteComment = async (id: string) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            const { error } = await supabaseClient
                .from('comments')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting comment:', error)
        }
    }

    return (
        <div className="flex flex-col h-full max-h-[100%] bg-card text-foreground">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest italic">Live Comments</h3>
            </div>

            {/* Comments List */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar"
            >
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/30">
                        <MessageSquare size={32} strokeWidth={1} />
                        <p className="text-[10px] font-black uppercase tracking-tighter mt-2">No comments yet. Start the hype!</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group animate-in slide-in-from-bottom-2 duration-300">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                                <User size={16} className="text-muted-foreground/50" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className={`text-[9px] font-black uppercase tracking-tight ${comment.user_id === userId ? 'text-primary' : 'text-foreground'}`}>
                                        {comment.profile?.display_name || 'Anonymous'}
                                    </span>
                                    {comment.user_id === userId && (
                                        <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 break-words">
                                    {comment.content}
                                </p>
                                <span className="text-[8px] text-muted-foreground/30 uppercase font-bold mt-1 block">
                                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            {userId ? (
                <form onSubmit={handlePostComment} className="p-4 bg-muted/30 border-t border-border flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Say something..."
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-xs font-bold focus:border-primary focus:outline-none placeholder:text-muted-foreground/30"
                        disabled={isPosting}
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isPosting}
                        className="w-10 h-10 bg-primary text-black rounded-xl flex items-center justify-center disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0"
                    >
                        {isPosting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </form>
            ) : (
                <div className="p-4 bg-muted/30 border-t border-border text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 italic">
                        Login to join the conversation
                    </p>
                </div>
            )}
        </div>
    )
}
