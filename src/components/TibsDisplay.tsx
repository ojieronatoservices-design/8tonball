"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface TibsDisplayProps {
    amount: number
    className?: string
    showUnit?: boolean
    unitClassName?: string
}

/**
 * TibsDisplay component that shows Tibs by default, 
 * but switches to PHP value (1:8 ratio) for 1 second when tapped.
 */
export function TibsDisplay({ amount, className, showUnit = true, unitClassName }: TibsDisplayProps) {
    const [isConverted, setIsConverted] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()

        setIsConverted(true)

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(() => {
            setIsConverted(false)
        }, 1000)
    }, [])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
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
                "cursor-pointer transition-all duration-200 select-none",
                className
            )}
            onClick={handleTap}
            onTouchEnd={handleTap}
        >
            {isConverted ? (
                formattedPhp
            ) : (
                <>
                    {amount.toLocaleString(undefined, {
                        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
                        maximumFractionDigits: 2
                    })}
                    {showUnit && <span className={cn("ml-1 opacity-80", unitClassName)}>Tibs</span>}
                </>
            )}
        </span>
    )
}
