'use client'

import React, { useState, useEffect, memo } from 'react'

interface CountdownTimerProps {
    endsAt: string
    className?: string
    showLabels?: boolean
}

export const CountdownTimer = memo(({ endsAt, className = '', showLabels = true }: CountdownTimerProps) => {
    const [timeLeft, setTimeLeft] = useState<string>('')
    const [isExpired, setIsExpired] = useState(false)

    useEffect(() => {
        if (!endsAt) {
            setTimeLeft('--:--')
            return
        }

        const calculateTimeLeft = () => {
            const now = new Date().getTime()
            const end = new Date(endsAt).getTime()

            if (isNaN(end)) {
                setTimeLeft('TBA')
                return
            }

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

            let result = ''
            if (days > 0) result = `${days}d ${hours}h ${minutes}m ${seconds}s`
            else if (hours > 0) result = `${hours}h ${minutes}m ${seconds}s`
            else if (minutes > 0) result = `${minutes}m ${seconds}s`
            else result = `${seconds}s`

            // Only update state if the text actually changed (saves 1 render per second if nothing changed, 
            // though with seconds included it will always change, but good practice)
            setTimeLeft(result)
        }

        calculateTimeLeft()
        const timer = setInterval(calculateTimeLeft, 1000)

        return () => clearInterval(timer)
    }, [endsAt])

    return (
        <div className={`font-mono font-bold ${isExpired ? 'text-red-500' : 'text-primary'} ${className}`}>
            {isExpired ? (showLabels ? '⏱️ ENDED' : 'ENDED') : (showLabels ? `⏱️ ${timeLeft}` : timeLeft)}
        </div>
    )
})

CountdownTimer.displayName = 'CountdownTimer'
