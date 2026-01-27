"use client"

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-primary/30">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5 h-16 flex items-center px-6">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Back to Feed</span>
                </Link>
            </header>

            <main className="pt-32 pb-20 px-6 max-w-3xl mx-auto space-y-12">
                <div className="space-y-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                        <Shield className="text-primary" size={24} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic italic leading-none">
                        Terms of Service
                    </h1>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">
                        Effective Date: January 27, 2026
                    </p>
                </div>

                <div className="prose prose-invert max-w-none space-y-8 text-white/70 leading-relaxed">
                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">1. Eligibility</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>You must be at least <strong>18 years of age</strong> to participate in any events on 8TONBALL.</li>
                            <li>You must be a resident of the Philippines or reside in a jurisdiction where participation in such promotional events is legal.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">2. The Tibs Economy</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Tibs</strong> are platform-specific utility credits used to enter community events.</li>
                            <li><strong>No Cash Value:</strong> Tibs have no monetary value outside the 8TONBALL platform.</li>
                            <li><strong>Non-Refundable:</strong> All purchases of Tibs are final. There are no refunds, even for unused balance.</li>
                            <li><strong>Non-Transferable:</strong> Tibs cannot be transferred between user accounts.</li>
                            <li><strong>Payment Verification:</strong> All Tibs purchases are verified manually. We reserve the right to reject payments that appear fraudulent or suspicious.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">3. Event Participation</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Promotional Nature:</strong> Events on 8TONBALL are for entertainment and community engagement purposes.</li>
                            <li><strong>Result Finality:</strong> All raffle/event results are final and determined by the platform's randomized logic.</li>
                            <li><strong>Goal-Based Events:</strong> Some events require a minimum "Tibs Goal" to be met. If the goal is not met, entries may be refunded in Tibs at the platform's discretion.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">4. User Conduct</h2>
                        <p>You agree not to use the platform for any illegal activities, including money laundering or unauthorized gambling. Multiple accounts per user are strictly prohibited.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">5. Privacy & Data</h2>
                        <p>Your use of 8TONBALL is also governed by our Privacy Policy. We collect minimal data (Email) to manage your account and transactions. We do not store your bank account details or credit card information in plain text.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">6. Limitation of Liability</h2>
                        <p>8TONBALL is provided "as is." We are not liable for any technical failures, data loss, or indirect damages arising from your use of the platform.</p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">7. Governing Law</h2>
                        <p>These terms are governed by the laws of the <strong>Republic of the Philippines</strong>.</p>
                    </section>
                </div>

                <div className="pt-12 border-t border-white/5">
                    <p className="text-xs text-white/30 font-bold uppercase tracking-widest text-center">
                        Philippine Digital Safety Standards Compliance
                    </p>
                </div>
            </main>
        </div>
    )
}
