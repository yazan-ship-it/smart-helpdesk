'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import AiTicketSummary from '@/app/components/AiTicketSummary'
import type { CannedResponse } from '@/lib/settings'
import { useTranslation } from '@/lib/i18n'
import type { AgentOption, Role, TicketDetailData } from './_parts/shared'
import TicketHeader from './_parts/TicketHeader'
import EmployeePanels from './_parts/EmployeePanels'
import DescriptionCard from './_parts/DescriptionCard'
import ActivityTimeline from './_parts/ActivityTimeline'
import ReplyForm from './_parts/ReplyForm'
import StaffActions from './_parts/StaffActions'
import PropertiesCard from './_parts/PropertiesCard'

export type { TicketDetailData }

type Props = {
  ticket: TicketDetailData
  itAgents: AgentOption[]
  cannedResponses: CannedResponse[]
  currentUserId: string
  currentUserRole: Role
}

/**
 * The ticket page for everyone: the requester's panels, the description and
 * discussion, the reply box, and the staff panel for IT support and admins.
 */
export default function TicketDetailClient({ ticket, itAgents, cannedResponses, currentUserId, currentUserRole }: Props) {
  const { t } = useTranslation()
  // The reply text lives here so the AI summary can insert its suggestion into it
  const [replyText, setReplyText] = useState('')

  const isAdmin = currentUserRole === 'ADMIN'
  const isStaff = currentUserRole === 'IT_SUPPORT' || isAdmin
  const isFinished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

  const insertAiSuggestion = (suggestion: string) => {
    setReplyText((prev) => (prev ? `${prev}\n\n${suggestion}` : suggestion))
    toast.info(t('ai.insertedIntoReply'))
  }

  return (
    <div className="animate-fade-up">
      <TicketHeader ticket={ticket}>
        {currentUserRole === 'EMPLOYEE' && <EmployeePanels ticket={ticket} />}
      </TicketHeader>

      <div className="page-content">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column: AI summary, description, discussion */}
          <div className="lg:col-span-2 space-y-6">
            {isStaff && <AiTicketSummary ticketId={ticket.id} onInsert={insertAiSuggestion} />}
            <DescriptionCard ticket={ticket} />
            <div>
              <ActivityTimeline ticket={ticket} />
              <ReplyForm
                ticketId={ticket.id}
                isStaff={isStaff}
                cannedResponses={cannedResponses}
                text={replyText}
                setText={setReplyText}
              />
            </div>
          </div>

          {/* Side column: staff actions and the ticket's details */}
          <div className="space-y-5">
            {/* Admins don't act on finished tickets, so the panel would be empty */}
            {isStaff && !(isAdmin && isFinished) && (
              <StaffActions ticket={ticket} itAgents={itAgents} currentUserId={currentUserId} currentUserRole={currentUserRole} />
            )}
            <PropertiesCard ticket={ticket} />
          </div>
        </div>
      </div>
    </div>
  )
}
