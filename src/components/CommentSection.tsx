"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Loader2, User, MessageSquare, Trash2, Reply, X } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth, useUser } from '@clerk/nextjs'

interface Comment {
    id: string
    content: string
    created_at: string
    user_id: string
    parent_id: string | null
    profile: {
        display_name: string
    }
}

interface CommentSectionProps {
    raffleId: string
    hostId?: string
}

export function CommentSection({ raffleId, hostId }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [replyTo, setReplyTo] = useState<Comment | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPosting, setIsPosting] = useState(false)
    const { getClient } = useSupabase()
    const { userId } = useAuth()
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchComments = async (silent = false) => {
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        if (!silent) setIsLoading(true)
        try {
            const { data, error } = await supabaseClient
                .from('comments')
                .select(`
                    id,
                    content,
                    created_at,
                    user_id,
                    parent_id,
                    profile:profiles!user_id(display_name)
                `)
                .eq('raffle_id', raffleId)
                .order('created_at', { ascending: true })

            if (error) throw error
            setComments(data || [])
        } catch (error) {
            console.error('Error fetching comments:', error)
        } finally {
            if (!silent) setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchComments()

        let channel: any = null
        const setupRealtime = async () => {
            const supabaseClient = await getClient()
            if (!supabaseClient) return

            console.log('[Realtime] Subscribing to comments for raffle:', raffleId)

            channel = supabaseClient
                .channel(`raffle_comments_${raffleId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'comments',
                }, (payload: any) => {
                    console.log('[Realtime] Event received:', payload)
                    const payloadRaffleId = payload.new?.raffle_id || payload.old?.raffle_id
                    if (payloadRaffleId === raffleId) {
                        fetchComments(true)
                    }
                })
                .subscribe((status: string) => {
                    console.log(`[Realtime] Subscription status: ${status}`)
                })
        }

        setupRealtime()

        const polling = setInterval(() => {
            fetchComments(true)
        }, 10000)

        return () => {
            if (channel) channel.unsubscribe()
            clearInterval(polling)
        }
    }, [raffleId])

    useEffect(() => {
        if (scrollRef.current && !replyTo) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [comments, replyTo])

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
                    content: newComment.trim(),
                    parent_id: replyTo?.id || null
                }])

            if (error) {
                console.error('Supabase Error details:', error)
                throw error
            }

            setNewComment('')
            setReplyTo(null)
        } catch (error: any) {
            console.error('Error posting comment:', error)
            alert(`Failed to post comment: ${error.message || 'Unknown error'}`)
        } finally {
            setIsPosting(false)
        }
    }

    const handleDeleteComment = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
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

    const processedComments = useMemo(() => {
        const parents = comments.filter(c => !c.parent_id)
        const children = comments.filter(c => c.parent_id)

        return parents.map(p => ({
            ...p,
            replies: children.filter(c => c.parent_id === p.id)
        }))
    }, [comments])

    const CommentItem = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => {
        const isHost = hostId && comment.user_id === hostId
        const isSelf = userId && comment.user_id === userId

        return (
            <div className={`flex flex-col gap-2 ${isReply ? 'ml-8 mt-1 border-l-2 border-primary/10 pl-4 py-1' : ''} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className="flex gap-3 group">
                    <div className={`w-8 h-8 rounded-lg ${isHost ? 'bg-primary/20 border-primary/30' : 'bg-muted border-border'} flex items-center justify-center shrink-0 overflow-hidden border`}>
                        <User size={16} className={isHost ? 'text-primary' : 'text-muted-foreground/50'} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-tight ${isHost ? 'text-primary' : isSelf ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {comment.profile?.display_name || 'Anonymous'}
                                </span>
                                {isHost && (
                                    <span className="text-[7px] font-black bg-primary text-black px-1 rounded-sm uppercase tracking-widest">Host</span>
                                )}
                                {isSelf && (
                                    <button
                                        onClick={(e) => handleDeleteComment(comment.id, e)}
                                        className="text-muted-foreground/30 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] text-muted-foreground/30 uppercase font-bold mt-1 block">
                                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!isReply && (
                                    <button
                                        onClick={() => {
                                            setReplyTo(comment)
                                            setNewComment(`@${comment.profile?.display_name} `)
                                        }}
                                        className="text-primary/40 hover:text-primary transition-all p-1 flex items-center gap-1 mt-0.5"
                                    >
                                        <Reply size={10} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Reply</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className={`text-xs leading-relaxed mt-1 break-words ${isHost ? 'text-foreground italic font-medium' : 'text-muted-foreground'}`}>
                            {comment.content.split(/(@\w+)/g).map((part: string, i: number) =>
                                part.startsWith('@') ? (
                                    <span key={i} className="text-primary font-black">{part}</span>
                                ) : part
                            )}
                        </p>
                    </div>
                </div>

                {comment.replies?.map((reply: any) => (
                    <CommentItem key={reply.id} comment={reply} isReply={true} />
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-card text-foreground">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest italic">Live Conversation</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchComments()}
                        className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                        title="Refresh manually"
                    >
                        <span className="text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Sync</span>
                        <Loader2 size={14} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <div className="bg-primary/10 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">
                        Real-time Active
                    </div>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar scroll-smooth">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={24} />
                        <span className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Connecting...</span>
                    </div>
                ) : processedComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/20">
                        <MessageSquare size={48} strokeWidth={1} />
                        <p className="text-xs font-black uppercase tracking-widest mt-4">Start the excitement!</p>
                    </div>
                ) : (
                    processedComments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))
                )}
            </div>

            {replyTo && (
                <div className="px-6 py-2 bg-primary/5 border-t border-primary/20 flex items-center justify-between animate-in slide-in-from-bottom-1 fade-in">
                    <div className="flex items-center gap-2 truncate">
                        <Reply size={12} className="text-primary shrink-0" />
                        <span className="text-[9px] font-bold text-muted-foreground truncate">
                            Replying to <span className="text-primary">{replyTo.profile?.display_name}</span>
                        </span>
                    </div>
                    <button onClick={() => { setReplyTo(null); if (newComment.startsWith('@')) setNewComment('') }} className="text-muted-foreground hover:text-foreground">
                        <X size={14} />
                    </button>
                </div>
            )}

            {userId ? (
                <form onSubmit={handlePostComment} className="p-4 bg-muted/30 border-t border-border flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={replyTo ? `Reply to ${replyTo.profile?.display_name}...` : "Say something live..."}
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-bold focus:border-primary focus:outline-none placeholder:text-muted-foreground/30 shadow-inner"
                        disabled={isPosting}
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isPosting}
                        className="w-11 h-11 bg-primary text-black rounded-xl flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0"
                    >
                        {isPosting ? <Loader2 size={18} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </form>
            ) : (
                <div className="p-6 bg-muted/30 border-t border-border text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">
                        Join the community to chat
                    </p>
                </div>
            )}
        </div>
    )
}
