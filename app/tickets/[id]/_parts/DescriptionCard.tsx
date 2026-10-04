'use client'

import { ExternalLink, FileText, Paperclip } from 'lucide-react'
import AiTranslateButton from '@/app/components/AiTranslateButton'
import { useTranslation } from '@/lib/i18n'
import { formatBytes, getInitials, type TicketDetailData } from './shared'

/** The requester, the original description and the attached files */
export default function DescriptionCard({ ticket }: { ticket: TicketDetailData }) {
  const { t } = useTranslation()
  const attachments = ticket.attachments

  return (
    <div className="card p-6 border-border bg-card backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-foreground shadow-inner"
            style={{ background: 'linear-gradient(135deg, #a78bfa, #f472b6)' }}
          >
            {getInitials(ticket.createdBy.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {ticket.createdBy.name}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{t('ticketPage.requester')}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {ticket.createdBy.email}
            </span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Description Body */}
      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {ticket.description}
      </div>
      <AiTranslateButton text={ticket.description} />

      {attachments.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Paperclip className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
            <span>{t('ticketPage.uploadedAttachments', { length: attachments.length })}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {attachments.map((file) => {
              const isImg = file.type?.startsWith('image/')
              return (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-background/[0.03] hover:bg-background/[0.07] border border-border hover:border-border transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-indigo-700 dark:text-indigo-400 transition-colors overflow-hidden">
                    {isImg ? (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail of a user upload with unknown dimensions
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-foreground transition-colors">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
