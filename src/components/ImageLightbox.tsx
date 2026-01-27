'use client'

import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageLightboxProps {
    images: string[]
    initialIndex?: number
    onClose: () => void
}

export function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)

    const isVideo = (url: string) => {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
        return videoExtensions.some(ext => url.toLowerCase().includes(ext))
    }

    const goNext = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
    }

    const goPrev = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={onClose}>
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            >
                <X size={24} />
            </button>

            {/* Media */}
            {isVideo(images[currentIndex]) ? (
                <video
                    src={images[currentIndex]}
                    className="max-w-full max-h-full object-contain"
                    controls
                    autoPlay
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <img
                    src={images[currentIndex]}
                    alt="Full view"
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                />
            )}

            {/* Navigation */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); goPrev() }}
                        className="absolute left-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); goNext() }}
                        className="absolute right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-6 flex gap-2">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx) }}
                                className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-primary' : 'bg-white/30'
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
