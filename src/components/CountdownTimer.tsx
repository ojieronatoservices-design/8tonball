'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
    endsAt: string
    className?: string
}

export function CountdownTimer({ endsAt, className = '' }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<string>('')
    const [isExpired, setIsExpired] = useState(false)

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime()
            const end = new Date(endsAt).getTime()
            const diff = end - now

            if (diff <= 0) {
                setIsExpired(true)
                setTimeLeft('ENDED')
                return
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24))
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((diff % (1000 * 60)) / 1000)

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h ${minutes}m`)
            } else if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
            } else if (minutes > 0) {
                setTimeLeft(`${minutes}m ${seconds}s`)
            } else {
                setTimeLeft(`${seconds}s`)
            }
        }

        calculateTimeLeft()
        const timer = setInterval(calculateTimeLeft, 1000)

        return () => clearInterval(timer)
    }, [endsAt])

    return (
        <div className={`font-mono font-bold ${isExpired ? 'text-red-500' : 'text-primary'} ${className}`}>
            {isExpired ? '⏱️ ENDED' : `⏱️ ${timeLeft}`}
        </div>
    )
}
