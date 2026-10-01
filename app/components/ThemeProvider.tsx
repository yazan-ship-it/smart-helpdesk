'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect } from 'react'

export type AccentColor = 'blue' | 'slate' | 'violet' | 'emerald'

function AccentApplier() {
 useEffect(() => {
 const stored = localStorage.getItem('helpdesk-accent') as AccentColor | null
 if (stored) {
 document.documentElement.setAttribute('data-accent', stored)
 }
 }, [])
 return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
 return (
 <NextThemesProvider
 attribute="class"
 defaultTheme="system"
 enableSystem
 disableTransitionOnChange={false}
 >
 <AccentApplier />
 {children}
 </NextThemesProvider>
 )
}
