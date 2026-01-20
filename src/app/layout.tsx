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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Shell>{children}</Shell>
        </body>
      </html>
    </ClerkProvider>
  );
}

