import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

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
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_c2tpbGxlZC1jYXRmaXNoLTI0LmNsZXJrLmFjY291bnRzLmRldiQ'}>
      <html lang="en">
        <body className={inter.className}>
          <Shell>{children}</Shell>
        </body>
      </html>
    </ClerkProvider>
  );
}

