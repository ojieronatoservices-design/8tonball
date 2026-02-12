"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Loader2, User, MessageSquare, Trash2, Reply, X, ChevronUp, ChevronDown, Clock } from 'lucide-react'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@clerk/nextjs'

interface Comment {
    id: string
    content: string
    created_at: string
    user_id: string
    parent_id: string | null
    profile: {
        display_name: string
    }
    upvotes: number
    downvotes: number
    user_vote: number | null
    replies?: Comment[]
}

interface CommentSectionProps {
    raffleId: string
    hostId?: string
}

const formatRelativeTime = (dateString: string) => {
    const now = new Date()
    const past = new Date(dateString)
    const diffInMs = now.getTime() - past.getTime()
    const diffInSecs = Math.floor(diffInMs / 1000)
    const diffInMins = Math.floor(diffInSecs / 60)
    const diffInHours = Math.floor(diffInMins / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInSecs < 60) return 'now'
    if (diffInMins < 60) return `${diffInMins}m`
    if (diffInHours < 24) return `${diffInHours}h`
    if (diffInDays < 7) return `${diffInDays}d`
    return past.toLocaleDateString([], { month: 'short', day: 'numeric' })
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
            // Fetch comments with joined profiles and aggregated vote counts
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

            // Fetch votes separately to compute counts (Supabase limited aggregation in single select)
            const { data: votes, error: votesError } = await supabaseClient
                .from('comment_votes')
                .select('comment_id, vote_type, user_id')

            if (votesError) console.error('Error fetching votes:', votesError)

            const processedData = (data as any[]).map(comment => {
                const commentVotes = (votes as any[])?.filter((v: any) => v.comment_id === comment.id) || []
                return {
                    ...comment,
                    upvotes: commentVotes.filter((v: any) => v.vote_type === 1).length,
                    downvotes: commentVotes.filter((v: any) => v.vote_type === -1).length,
                    user_vote: commentVotes.find((v: any) => v.user_id === userId)?.vote_type || null
                }
            })

            setComments(processedData)
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

            channel = supabaseClient
                .channel(`raffle_social_${raffleId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
                    fetchComments(true)
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_votes' }, () => {
                    fetchComments(true)
                })
                .subscribe()
        }

        setupRealtime()

        const polling = setInterval(() => fetchComments(true), 15000)

        return () => {
            if (channel) channel.unsubscribe()
            clearInterval(polling)
        }
    }, [raffleId, userId])

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

            if (error) throw error

            setNewComment('')
            setReplyTo(null)
        } catch (error: any) {
            console.error('Error posting comment:', error)
            alert(`Failed: ${error.message}`)
        } finally {
            setIsPosting(false)
        }
    }

    const handleVote = async (commentId: string, type: 1 | -1) => {
        if (!userId) return
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        const comment = comments.find(c => c.id === commentId)
        if (!comment) return

        const isReversing = comment.user_vote === type

        try {
            if (isReversing) {
                await supabaseClient
                    .from('comment_votes')
                    .delete()
                    .eq('comment_id', commentId)
                    .eq('user_id', userId)
            } else {
                await supabaseClient
                    .from('comment_votes')
                    .upsert({
                        comment_id: commentId,
                        user_id: userId,
                        vote_type: type
                    })
            }
            // Realtime will trigger refresh
        } catch (error) {
            console.error('Vote error:', error)
        }
    }

    const handleDeleteComment = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const supabaseClient = await getClient()
        if (!supabaseClient) return

        try {
            await supabaseClient.from('comments').delete().eq('id', id)
        } catch (error) {
            console.error('Delete error:', error)
        }
    }

    // Build recursive tree
    const commentTree = useMemo(() => {
        const map = new Map<string, Comment>()
        comments.forEach(c => map.set(c.id, { ...c, replies: [] }))

        const roots: Comment[] = []
        map.forEach((c: Comment) => {
            if (c.parent_id && map.has(c.parent_id)) {
                map.get(c.parent_id)!.replies!.push(c)
            } else {
                roots.push(c)
            }
        })
        return roots
    }, [comments])

    const CommentItem = ({ comment, depth = 0 }: { comment: Comment, depth?: number }) => {
        const isHost = hostId && comment.user_id === hostId
        const isSelf = userId && comment.user_id === userId
        const [showReplies, setShowReplies] = useState(true)

        // Only indent the first level of replies. 
        // Subsequent levels stay at the same level as depth 1 but keep the tag context.
        const leftSpacing = depth > 0 ? (depth === 1 ? 'ml-6' : 'ml-6 border-l border-primary/10 pl-2') : ''

        return (
            <div className={`flex flex-col gap-2 ${leftSpacing} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className="flex gap-2 group">
                    <div className={`w-6 h-6 rounded-md ${isHost ? 'bg-primary/20 border-primary/30' : 'bg-muted border-border'} flex items-center justify-center shrink-0 border mt-1`}>
                        <User size={12} className={isHost ? 'text-primary' : 'text-muted-foreground/50'} />
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Header: [Name] [Time] */}
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-tight ${isHost ? 'text-primary font-black italic' : isSelf ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {comment.profile?.display_name || 'Anonymous'}
                            </span>
                            {isHost && <span className="text-[7px] font-black bg-primary text-black px-1 rounded-sm uppercase tracking-tighter">Host</span>}
                            <span className="text-[9px] text-muted-foreground/30 font-bold flex items-center gap-0.5">
                                • {formatRelativeTime(comment.created_at)}
                            </span>

                            {isSelf && (
                                <button onClick={(e) => handleDeleteComment(comment.id, e)} className="text-muted-foreground/20 hover:text-red-500 transition-colors p-1 -ml-1">
                                    <Trash2 size={10} />
                                </button>
                            )}
                        </div>

                        {/* Body: (Content Body) */}
                        <p className={`text-[11px] leading-relaxed mt-0.5 break-words ${isHost ? 'text-foreground font-medium' : 'text-muted-foreground/90'}`}>
                            {comment.content.split(/(@\w+)/g).map((part: string, i: number) =>
                                part.startsWith('@') ? (
                                    <span key={i} className="text-primary font-black">{part}</span>
                                ) : part
                            )}
                        </p>

                        {/* Footer: [reply] [downvote icons] [upvote icons] */}
                        <div className="flex items-center gap-3 mt-1.5 touch-manipulation">
                            <button
                                onClick={() => {
                                    setReplyTo(comment)
                                    setNewComment(`@${comment.profile?.display_name} `)
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors py-1 pr-2"
                            >
                                Reply
                            </button>

                            <div className="flex items-center bg-muted/30 rounded-full px-1 py-0.5 border border-border/50">
                                <button
                                    onClick={() => handleVote(comment.id, 1)}
                                    className={`p-1 transition-all rounded-full ${comment.user_vote === 1 ? 'text-primary bg-primary/10' : 'text-muted-foreground/40 hover:text-primary'}`}
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <span className="text-[9px] font-black min-w-[12px] text-center mx-0.5 tracking-tighter">
                                    {(comment.upvotes - comment.downvotes) || 0}
                                </span>
                                <button
                                    onClick={() => handleVote(comment.id, -1)}
                                    className={`p-1 transition-all rounded-full ${comment.user_vote === -1 ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/40 hover:text-red-500'}`}
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </div>

                            {comment.replies && comment.replies.length > 0 && depth === 0 && (
                                <button onClick={() => setShowReplies(!showReplies)} className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-tighter hover:text-foreground">
                                    {showReplies ? `Hide ${comment.replies.length}` : `View ${comment.replies.length} replies`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recursive Replies */}
                {showReplies && comment.replies?.map(reply => (
                    <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-card text-foreground select-none">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] italic text-primary/80">Social Feed</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => fetchComments()} className="text-muted-foreground hover:text-primary p-2">
                        <Loader2 size={14} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <div className="bg-primary text-black text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter animate-pulse">
                        Live
                    </div>
                </div>
            </div>

            {/* List */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar scroll-smooth bg-gradient-to-b from-transparent to-muted/5">
                {isLoading && comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={20} />
                        <span className="text-[8px] font-black uppercase text-muted-foreground/30 tracking-widest">Warping in...</span>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/10">
                        <MessageSquare size={40} strokeWidth={1} />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4 italic">No one is talking yet.</p>
                    </div>
                ) : (
                    commentTree.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))
                )}
            </div>

            {/* Reply Indicator */}
            {replyTo && (
                <div className="px-6 py-2 bg-primary/10 border-t border-primary/20 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
                    <div className="flex items-center gap-2">
                        <Reply size={10} className="text-primary" />
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tight">
                            Replying context: <span className="text-primary">{replyTo.profile?.display_name}</span>
                        </span>
                    </div>
                    <button onClick={() => { setReplyTo(null); if (newComment.startsWith('@')) setNewComment('') }} className="p-1 hover:bg-black/10 rounded">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Input */}
            {userId ? (
                <form onSubmit={handlePostComment} className="p-4 bg-muted/20 border-t border-border flex gap-2 backdrop-blur-lg">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={replyTo ? `Reply...` : "Say something..."}
                        className="flex-1 bg-background/50 border border-border/50 rounded-xl px-4 py-3 text-[11px] font-bold focus:border-primary focus:outline-none placeholder:text-muted-foreground/20 shadow-inner"
                        disabled={isPosting}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isPosting}
                        className="w-12 h-12 bg-primary text-black rounded-xl flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/10 shrink-0"
                    >
                        {isPosting ? <Loader2 size={16} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </form>
            ) : (
                <div className="p-6 text-center border-t border-border">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">Auth required to comment</p>
                </div>
            )}
        </div>
    )
}
