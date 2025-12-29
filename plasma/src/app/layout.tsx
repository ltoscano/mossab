import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Plasma UI',
  description: 'Next generation liquid interface',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-plasma-void min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
