import type { Metadata } from 'next'
import { Instrument_Serif, Instrument_Sans, Lora } from 'next/font/google'
import './globals.css'
import '@/components/board.css'

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
})

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
})

const lora = Lora({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '麻将',
  description: '国标 / 四川麻将，本地热座与实时联机对战',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${instrumentSans.variable} ${lora.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
