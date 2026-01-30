"use client"

import { UserProfile } from "@clerk/nextjs"
import { ArrowLeft, Settings } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-10 pb-20 max-w-2xl mx-auto px-1">
            <div className="flex items-center gap-4">
                <Link href="/profile" className="p-2 bg-card rounded-xl border border-border hover:bg-muted transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-2xl font-black tracking-tight">Settings</h1>
            </div>

            {/* Section 1: Account Management (Clerk) */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <Settings className="text-blue-500" size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">Account Identity</h2>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Managed by Clerk</p>
                    </div>
                </div>

                <div className="bg-card rounded-3xl overflow-hidden border border-border">
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
                                formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/80",
                                formButtonReset: "text-muted-foreground hover:text-foreground",
                                breadcrumbsItem: "text-muted-foreground",
                                breadcrumbsItemDivider: "text-muted-foreground",
                                userPreviewMainIdentifier: "text-foreground",
                                userPreviewSecondaryIdentifier: "text-muted-foreground",
                                profileSectionTitleText: "text-foreground",
                                profileSectionPrimaryButton: "text-primary hover:bg-primary/10",
                                accordionTriggerButton: "text-foreground hover:bg-muted font-bold",
                                formFieldLabel: "text-muted-foreground font-medium",
                                formFieldInput: "bg-muted text-foreground border-border rounded-xl",
                            },
                            variables: {
                                colorBackground: "transparent",
                                colorText: "#ffffff",
                                colorInputBackground: "rgba(255,255,255,0.05)",
                                colorInputText: "#ffffff",
                                borderRadius: "0.75rem",
                            }
                        }}
                    />
                </div>
            </section>
        </div>
    )
}
