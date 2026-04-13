import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata = {
  title: 'Voxora AI',
  description: 'Your intelligent AI assistant',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}