"use client"

import { UserProfile } from "@clerk/nextjs"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="flex items-center gap-4">
                <Link href="/profile" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-2xl font-black tracking-tight">Account Settings</h1>
            </div>

            <div className="bg-card rounded-3xl overflow-hidden border border-white/5">
                <UserProfile
                    appearance={{
                        elements: {
                            rootBox: "w-full",
                            card: "w-full shadow-none bg-transparent",
                            navbar: "hidden",
                            pageScrollBox: "p-0",
                            headerTitle: "hidden",
                            headerSubtitle: "hidden",
                            viewSectionTitle: "text-lg font-bold mb-2",
                            formButtonPrimary: "bg-primary text-black hover:bg-primary/80",
                            formButtonReset: "text-white/60 hover:text-white",
                        },
                        variables: {
                            colorBackground: "transparent",
                            colorText: "white",
                            colorInputBackground: "rgba(255,255,255,0.05)",
                            colorInputText: "white",
                        }
                    }}
                />
            </div>
        </div>
    )
}
