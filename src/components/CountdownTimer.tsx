'use client'

import React, { useState, useEffect, memo } from 'react'

interface CountdownTimerProps {
    endsAt: string
    className?: string
    showLabels?: boolean
    format?: 'default' | 'digital'
}

export const CountdownTimer = memo(({ endsAt, className = '', showLabels = true, format = 'default' }: CountdownTimerProps) => {
    const [timeLeft, setTimeLeft] = useState<string>('')
    const [isExpired, setIsExpired] = useState(false)

    useEffect(() => {
        if (!endsAt) {
            setTimeLeft(format === 'digital' ? '00:00:00' : '--:--')
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

            if (format === 'digital') {
                const pad = (num: number) => num.toString().padStart(2, '0')
                if (days > 0) {
                    result = `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                } else {
                    result = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                }
            } else {
                if (days > 0) result = `${days}d ${hours}h ${minutes}m ${seconds}s`
                else if (hours > 0) result = `${hours}h ${minutes}m ${seconds}s`
                else if (minutes > 0) result = `${minutes}m ${seconds}s`
                else result = `${seconds}s`
            }

            setTimeLeft(result)
        }

        calculateTimeLeft()
        const timer = setInterval(calculateTimeLeft, 1000)

        return () => clearInterval(timer)
    }, [endsAt, format])

    return (
        <div className={`font-mono font-bold ${isExpired ? 'text-red-500' : 'text-primary'} ${className}`}>
            {isExpired ? (showLabels ? '⏱️ ENDED' : 'ENDED') : (showLabels && format !== 'digital' ? `⏱️ ${timeLeft}` : timeLeft)}
        </div>
    )
})

CountdownTimer.displayName = 'CountdownTimer'
