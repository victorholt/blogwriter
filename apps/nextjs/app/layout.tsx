import type { Metadata } from 'next'
import { Inter, Playfair_Display, Lora } from 'next/font/google'
import AuthProvider from '@/components/AuthProvider'
import './globals.scss'

const inter = Inter({ subsets: ['latin'] })
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-heading',
})
const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'Blog Writer — AI-Powered Wedding Dress Blog Generator',
  description: 'Generate professional wedding dress blog posts with AI-powered agents.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${playfair.variable} ${lora.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
