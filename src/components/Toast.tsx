'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Date.now().toString()
        setToasts((prev) => [...prev, { id, message, type }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id)
        }, 4000)
        return () => clearTimeout(timer)
    }, [toast.id, onRemove])

    const bgColor = toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : CheckCircle

    return (
        <div
            className={`${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300`}
        >
            <Icon size={20} />
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} className="ml-2 opacity-70 hover:opacity-100">
                <X size={16} />
            </button>
        </div>
    )
}
