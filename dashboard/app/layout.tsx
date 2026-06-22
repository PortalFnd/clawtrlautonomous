import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const plexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
})

const plexMono = IBM_Plex_Mono({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Clawtrl Ops — Fleet Bay & Treasury Vault',
  description: 'PortalFND mission-control bridge for the autonomous claw fleet and Base treasury vault',
  icons: {
    icon: [
      { url: '/clawtrl.jpg', type: 'image/jpeg' },
      { url: '/favicon.ico' },
    ],
    apple: '/clawtrl.jpg',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable} mission-body`}>
        {children}
      </body>
    </html>
  )
}
