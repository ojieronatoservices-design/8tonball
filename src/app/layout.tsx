import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "8TONBALL | Premium Raffles",
  description: "Enter the draw to win exclusive prizes.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Google Publisher Tag (GPT) for Rewarded Ads */}
          <script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>
          {/* AdSense Service */}
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6489544353864483"
            crossOrigin="anonymous"
          ></script>
        </head>
        <body className={`${inter.className} antialiased selection:bg-primary/30`}>
          <Suspense fallback={null}>
            <Shell>{children}</Shell>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
