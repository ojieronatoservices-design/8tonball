"use client"

import React, { useState, useCallback, useRef } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface TibsDisplayProps {
    amount: number
    className?: string
    showUnit?: boolean
}

/**
 * TibsDisplay component that shows Tibs by default, 
 * but switches to PHP value (1:8 ratio) when held.
 */
export function TibsDisplay({ amount, className, showUnit = true }: TibsDisplayProps) {
    const [isHeld, setIsHeld] = useState(false)
    const holdTimer = useRef<NodeJS.Timeout | null>(null)

    const startHold = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        // Delay to prevent accidental triggers on quick clicks
        holdTimer.current = setTimeout(() => {
            setIsHeld(true)
        }, 150)
    }, [])

    const endHold = useCallback(() => {
        if (holdTimer.current) {
            clearTimeout(holdTimer.current)
        }
        setIsHeld(false)
    }, [])

    const phpValue = amount / 8

    // Format currency
    const formattedPhp = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: phpValue % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    }).format(phpValue)

    return (
        <span
            className={cn(
                "cursor-help transition-all duration-200 select-none",
                isHeld ? "text-primary animate-pulse scale-105" : "",
                className
            )}
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
        >
            {isHeld ? (
                formattedPhp
            ) : (
                <>
                    {amount.toLocaleString()}
                    {showUnit && <span className="ml-1 opacity-80">Tibs</span>}
                </>
            )}
        </span>
    )
}
