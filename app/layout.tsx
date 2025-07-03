import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SciTok - Descubra Ciência",
  description: "Descubra artigos científicos de forma divertida e interativa, como um TikTok para ciência!",
  keywords: "ciência, artigos científicos, pesquisa, educação",
  authors: [{ name: "Dev's Café team." }],
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
