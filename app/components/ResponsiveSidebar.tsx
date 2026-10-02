'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

/**
 * Sidebar that is always visible on md+ screens and becomes a slide-in
 * panel behind a menu button on phones. The sidebar content is passed in
 * from the (server) layout.
 */
export default function ResponsiveSidebar({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // Close with Escape, like any dialog
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Phone top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('ui.openMenu')}
          aria-expanded={open}
          className="p-2 -ms-2 rounded-lg text-foreground hover:bg-muted cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-foreground truncate">{title}</span>
      </div>

      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        className={`${className} fixed md:static inset-y-0 start-0 z-50 max-w-[85vw] transition-transform duration-200 md:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        } md:translate-x-0 md:rtl:translate-x-0`}
        // Following a link inside the panel should also close it
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false)
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('ui.closeMenu')}
          className="md:hidden absolute top-3 end-3 z-10 p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </aside>
    </>
  )
}
