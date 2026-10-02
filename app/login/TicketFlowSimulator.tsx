'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown, Clock, Lock, Shield, Sparkles } from 'lucide-react'
import { useTranslation, getCategoryLabel, getPriorityLabel } from '@/lib/i18n'

/** Illustrative walk-through of the ticket flow shown next to the login form. */
const SCENARIOS = [
  { id: 'vpn', category: 'Network', priority: 'HIGH', agent: 'Bob Williams', initials: 'BW', hours: 24 },
  { id: 'laptop', category: 'Hardware', priority: 'CRITICAL', agent: 'Mike Davis', initials: 'MD', hours: 4 },
  { id: 'access', category: 'Access & Permissions', priority: 'MEDIUM', agent: 'Bob Williams', initials: 'BW', hours: 48 },
] as const

export default function TicketFlowSimulator() {
  const { t, locale } = useTranslation()
  const [activeId, setActiveId] = useState<(typeof SCENARIOS)[number]['id']>(SCENARIOS[0].id)
  const active = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0]

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col">
      <div className="mb-8 flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('howItWorks.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('howItWorks.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`text-start px-4 py-3 rounded-xl border transition-colors cursor-pointer shadow-sm text-sm ${
              s.id === activeId ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-card hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            {t(`howItWorks.scenarios.${s.id}.title`)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex flex-col gap-3"
        >
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span>{t('howItWorks.step1')}</span>
            </div>
            <blockquote className="border-s-2 border-indigo-500/50 ps-4 py-1 text-sm italic text-muted-foreground bg-muted/20 rounded-e-lg">
              &ldquo;{t(`howItWorks.scenarios.${active.id}.description`)}&rdquo;
            </blockquote>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold border border-border bg-muted/40">
                {t('newTicket.ai.category')}: {getCategoryLabel(active.category, locale)}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold border border-border bg-muted/40">
                {t('newTicket.ai.priority')}: {getPriorityLabel(active.priority, locale)}
              </span>
            </div>
          </div>

          <div className="flex justify-center -my-1 relative z-10">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border text-[10px] font-bold tracking-wider uppercase text-muted-foreground shadow-sm">
              <ArrowDown className="w-3 h-3" />
              {t('howItWorks.routed')}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Shield className="w-5 h-5 text-indigo-500" />
              <span>{t('howItWorks.step2')}</span>
            </div>
            <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
              <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                {active.initials}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{active.agent}</span>
                <span className="text-xs text-muted-foreground">
                  {t('howItWorks.skillMatch', { category: getCategoryLabel(active.category, locale) })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              {t('howItWorks.peerLock')}
            </div>
          </div>

          <div className="flex justify-center -my-1 relative z-10">
            <div className="w-[1px] h-4 bg-border" />
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-3">
            <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{t('howItWorks.step3')}</span>
              <span className="text-sm text-foreground mt-0.5">{t('newTicket.sla.value', { hours: active.hours })}</span>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">{t('howItWorks.example')}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
