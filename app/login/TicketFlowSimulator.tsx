'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Shield,
  Clock,
  ArrowDown,
  Lock
} from 'lucide-react'

const SCENARIOS = [
  {
    id: 'vpn',
    title: '🌐 VPN Gateway Drops Connection',
    desc: "VPN gateway drops connection every 15 minutes, blocking the staging deployment.",
    category: 'Network',
    categoryColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    priority: 'High',
    priorityColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    confidence: '98.4%',
    techName: 'Bob Williams',
    techInitials: 'BW',
    techSpecialty: 'Network & Access Specialist',
    slaText: '⏳ 24h SLA Target (Next business shift)',
  },
  {
    id: 'laptop',
    title: "💻 Laptop Won't Boot / Hardware Failure",
    desc: "System shuts down immediately after BIOS screen. Beeping 3 times.",
    category: 'Hardware',
    categoryColor: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    priority: 'Critical',
    priorityColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    confidence: '99.1%',
    techName: 'Mike Davis',
    techInitials: 'MD',
    techSpecialty: 'Hardware & Software Specialist',
    slaText: '🚨 4h SLA Target (Excludes weekends)',
  },
  {
    id: 'db',
    title: '🔑 Request Database Production Access',
    desc: "Requesting read-only access to production replica for data validation.",
    category: 'Access Issue',
    categoryColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    priority: 'Medium',
    priorityColor: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
    confidence: '97.8%',
    techName: 'Bob Williams',
    techInitials: 'BW',
    techSpecialty: 'Network & Access Specialist',
    slaText: '📅 48h Resolution Target',
  },
]

export default function TicketFlowSimulator() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id)

  const activeScenario = SCENARIOS.find((s) => s.id === activeId) || SCENARIOS[0]

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col">
      <div className="mb-8 flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">
          Interactive Routing Sandbox
        </h2>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Select an issue below to see how AI automatically routes it.
        </p>
      </div>

      {/* 1. Interactive Scenario Chips */}
      <div className="flex flex-col gap-2 mb-8">
        {SCENARIOS.map((scenario) => {
          const isActive = scenario.id === activeId
          return (
            <button
              key={scenario.id}
              onClick={() => setActiveId(scenario.id)}
              className={`text-left px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm text-sm ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border bg-card hover:bg-muted/60 text-slate-600 dark:text-muted-foreground'
              }`}
            >
              {scenario.title}
            </button>
          )
        })}
      </div>

      {/* 2. Live Dynamic Reaction Card */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScenario.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col gap-3"
          >
            {/* A. AI Instant Triage */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-foreground font-semibold">
                <Bot className="w-5 h-5 text-indigo-500" />
                <span>AI Instant Triage (Gemini 2.0 Flash)</span>
              </div>
              
              <blockquote className="border-l-2 border-indigo-500/50 pl-4 py-1 text-sm italic text-slate-600 dark:text-muted-foreground bg-muted/20 rounded-r-lg">
                &ldquo;{activeScenario.desc}&rdquo;
              </blockquote>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${activeScenario.categoryColor}`}>
                  Category: {activeScenario.category}
                </span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${activeScenario.priorityColor}`}>
                  Priority: {activeScenario.priority}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 ml-auto">
                  ✨ {activeScenario.confidence} Confidence
                </span>
              </div>
            </div>

            {/* Connecting Indicator */}
            <div className="flex justify-center -my-1 relative z-10">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border text-[10px] font-bold tracking-wider uppercase text-slate-600 dark:text-muted-foreground shadow-sm">
                <ArrowDown className="w-3 h-3" />
                Auto-Routed by Skill Matrix
              </div>
            </div>

            {/* B. Automated Skill-Based Dispatch */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-foreground font-semibold">
                <Shield className="w-5 h-5 text-indigo-500" />
                <span>Specialist Dispatch</span>
              </div>
              
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                    {activeScenario.techInitials}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900 dark:text-foreground">{activeScenario.techName}</span>
                    <span className="text-xs text-slate-600 dark:text-muted-foreground">{activeScenario.techSpecialty}</span>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
                  Assigned
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                🔒 Peer Lock Active (Colleagues have read-only view)
              </div>
            </div>

            {/* Connecting Indicator */}
            <div className="flex justify-center -my-1 relative z-10">
              <div className="w-[1px] h-4 bg-border" />
            </div>

            {/* C. Calculated Business-Hours SLA */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900 dark:text-foreground">Calculated Business-Hours SLA</span>
                <span className="text-sm font-medium text-slate-900 dark:text-foreground mt-0.5">
                  {activeScenario.slaText}
                </span>
              </div>
            </div>
            
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
