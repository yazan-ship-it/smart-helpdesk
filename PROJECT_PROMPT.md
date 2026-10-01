# Master Prompt — Smart IT Helpdesk

> Copy everything below this line into your AI coding tool.

---

You are a senior full-stack engineer. Build a production-quality, bilingual (English + Arabic) **Smart IT Helpdesk** — an enterprise IT support ticketing system with AI-assisted triage, skill-based auto-assignment, business-hours SLA tracking, and an admin console. Follow every requirement below exactly. Do not skip features, do not leave placeholders, and do not invent features that contradict this spec.

## 1. Tech Stack (mandatory)

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5 (strict). Use Server Components for data loading and **Server Actions** for mutations. In Next 16 the middleware file is `proxy.ts` at the project root — read `node_modules/next/dist/docs/` before writing Next-specific code, since APIs differ from older versions (e.g. `params` and `searchParams` are Promises, `cookies()` is async).
- **Database:** Prisma ORM 5 + SQLite (`DATABASE_URL="file:./dev.db"`). SQLite has no enums: store enum-like values as `String` and validate them in TypeScript.
- **Auth:** Custom JWT sessions with `jose` (HS256) in an HttpOnly cookie named `helpdesk-session` (7-day expiry, `sameSite: lax`, `secure` in production). Passwords hashed with `bcryptjs` (12 rounds). `lib/session.ts` must import `server-only` and throw on startup if `SESSION_SECRET` is missing.
- **AI:** Google Gemini via `@google/genai`, model `gemini-2.0-flash`, JSON response mode. Key from `GEMINI_API_KEY`. Every AI feature must degrade gracefully when the key is missing or the call fails.
- **UI:** Tailwind CSS 4 with CSS design tokens (CSS variables), `next-themes` (light/dark/system), `framer-motion`, `lucide-react` icons, `recharts`, `sonner` toasts, `canvas-confetti`. Fonts: Geist, Geist Mono, and Cairo (Arabic).
- **Tests:** Vitest (`tests/**/*.test.ts`, node environment, `@` alias to project root).
- **Scripts:** `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `db:migrate`, `db:seed`, `db:studio`.
- Provide `.env.example` with `DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY`. Git-ignore `.env*` (except `.env.example`), `*.db`, `*.db-journal`, and `public/uploads`.

## 2. Data Model (`prisma/schema.prisma`)

### User
| Field | Type | Notes |
|---|---|---|
| id | String | cuid |
| name | String | |
| email | String | unique, always stored lowercase |
| password | String | bcrypt hash |
| role | String | `EMPLOYEE` \| `IT_SUPPORT` \| `ADMIN`, default `EMPLOYEE` |
| accountStatus | String | `PENDING` \| `APPROVED` \| `REJECTED` \| `SUSPENDED` \| `INVITED`, default `PENDING` |
| skills | String | JSON array of category names, default `"[]"` |
| isAvailable | Boolean | default true. Agent availability for routing |
| lastLoginAt | DateTime? | |
| createdAt / updatedAt | DateTime | |

Relations: `createdTickets` and `assignedTickets` (two named relations to Ticket), `comments`, `ticketHistories`.

### Ticket
| Field | Type | Notes |
|---|---|---|
| id | String | cuid |
| ticketNumber | Int | unique, human-readable sequential number, shown as `#123` |
| title | String | |
| description | String | |
| category | String | one of the configured categories |
| priority | String | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`, default `MEDIUM` |
| status | String | `OPEN` \| `ASSIGNED` \| `IN_PROGRESS` \| `RESOLVED` \| `CLOSED`, default `OPEN` |
| attachments | String | JSON array of `{name, size, type, url}`, default `"[]"` |
| slaDeadline | DateTime? | |
| slaBreached | Boolean | default false |
| csatRating | Int? | 1–5 |
| csatFeedback | String? | |
| resolvedAt / closedAt | DateTime? | |
| assetId | String? | optional corporate asset tag |
| createdById | String | FK → User |
| assignedToId | String? | FK → User |
| createdAt / updatedAt | DateTime | |

### Comment
`id`, `content`, `attachments` (JSON string), `isInternal` (Boolean, default false: private IT note hidden from employees), `createdAt`, `ticketId` (cascade delete), `authorId`.

### TicketHistory (audit log)
`id`, `action` (human-readable event text), `overrideReason?`, `createdAt`, `ticketId` (cascade delete), `userId`.

### AppSettings (single row, `id = "singleton"`)
- **General:** `appName` ("Smart Helpdesk"), `supportEmail`, `defaultPriority` ("MEDIUM"), `autoAssignmentEnabled` (true), `notifyNewUser` (true), `notifyCriticalTicket` (true).
- **SLA:** `slaCriticalHours` 4, `slaHighHours` 24, `slaMediumHours` 48, `slaLowHours` 72, `businessHoursStart` "09:00", `businessHoursEnd` "17:00", `workDays` JSON (default Sunday–Thursday), `pauseSlaOnWeekends` true.
- **AI:** `enableAiTriage` true, `aiConfidenceThreshold` 70, `fallbackHeuristicsEnabled` true.
- **Security:** `autoApproveDomain` "@company.com", `maintenanceMode` false.
- **Dynamic data:** `categoriesList` JSON, `cannedResponses` JSON array of `{id, title, content}`. Seed two responses: "Password Reset" and "Request Asset Tag".

### Categories (single source of truth)
Define once in `lib/constants.ts` and use **everywhere**: ticket form, filters, sidebar counts, agent skills, AI prompt, fallback heuristics, and seed data.

`Hardware`, `Software`, `Network`, `Email & Communication`, `Access & Permissions`, `Printer`, `Security`, `Other`

Never use legacy names such as "Email" or "Access Issue". URL filters must match categories with normalized, case-insensitive matching (e.g. `?category=Email` matches "Email & Communication").

## 3. Authentication & Authorization

### Session (`lib/session.ts`)
- The JWT payload contains `userId`, `role`, `name`, `email`, `expiresAt`.
- Export `encrypt`, `decrypt`, `createSession`, `deleteSession`, `getSession`, `updateSession`.

### Server actions (`app/actions/auth.ts`)
**`login(prevState, formData)`**
- Lowercase and trim the email.
- Show the same generic "Invalid email or password" error for an unknown email or a wrong password.
- Block login by account status, each with its own message:
  - PENDING → "pending admin approval"
  - REJECTED → "request rejected"
  - SUSPENDED → "suspended"
  - INVITED → "complete your invitation"
- On success:
  - update `lastLoginAt` and create the session
  - redirect by role: ADMIN → `/admin/users`, IT_SUPPORT → `/tickets?queue=assigned_to_me`, EMPLOYEE → `/tickets`

**`register(prevState, formData)`**
- Validate the fields, returning `fieldErrors`:
  - name ≥ 2 characters
  - valid email
  - password ≥ 8 characters
  - role is EMPLOYEE or IT_SUPPORT (users can never self-register as ADMIN)
- Reject duplicate emails.
- Auto-approve only when the role is EMPLOYEE **and** the email ends with `settings.autoApproveDomain`. Everyone else starts as PENDING.
- Return `{ success: true }` so the UI can show a success state.

**Other helpers:** `logout()`, plus `requireAuth()`, `requireRole(role)` and `requireAdmin()`.

### Route protection (`proxy.ts`)
- `/tickets/**` requires a session.
- `/admin/**` requires ADMIN; non-admins are redirected to `/tickets`.
- `/login` and `/register` redirect logged-in users to their role's home.
- `/` redirects to `/tickets`.

**Every API route must check the session itself:** upload and AI routes require a logged-in user, and summarize requires IT_SUPPORT or ADMIN.

### Defense in depth
Every server action and page re-checks the role server-side. Never trust the client.

**Employee data isolation:**
- Employees see only tickets where `createdById === session.userId`.
- Opening another user's ticket by URL returns `notFound()`.
- Internal comments are filtered out of every employee query.

## 4. Ticket Lifecycle & Server Actions (`app/actions/tickets.ts`)

### State machine (enforced server-side)
```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```
Use a `VALID_TRANSITIONS` map. Reject skipped steps and backward moves with a clear error that lists the valid next statuses. Export the map from a shared module so the UI and the tests import the same source.

### `createTicket(prevState, formData)`
1. Require a session.
2. Validate the fields:
   - title ≥ 5 characters
   - description ≥ 10 characters
   - category is in the allowed list
   - priority is a valid enum value; if missing, fall back to `settings.defaultPriority`
3. If `maintenanceMode` is on and the user is not ADMIN, return an error.
4. Read the attachments JSON from a hidden `attachmentsJson` field.
5. Generate `ticketNumber` safely (max + 1 inside a transaction, retrying on unique-constraint conflicts).
6. Auto-assign when the user ticked the "auto-assign" option **and** `settings.autoAssignmentEnabled` is true (see §5).
7. Compute `slaDeadline` with the business-hours engine (see §6), using the SLA hours for the ticket's priority.
8. Write history entries:
   - always: `Ticket #N created`
   - then either `System auto-assigned ticket to {agent} based on category ({category})` or `No available specialist found for {category} — ticket queued in Unassigned`
9. Revalidate and redirect to `/tickets?created=true`. The list page shows a success toast and cleans up the URL.

### `updateTicketStatus(ticketId, newStatus)`
- Allowed for IT_SUPPORT and ADMIN.
- **Peer edit lock:** if the ticket is assigned to another agent, return the error `Assigned to {name} - Read Only. Take over ticket to modify status.` ADMIN bypasses this lock.
- If the ticket is unassigned, changing its status auto-claims it for the current agent and logs "claimed and".
- Set `resolvedAt` on RESOLVED and `closedAt` on CLOSED.
- Log `status changed from X to Y`.

### Other actions
- **`assignTicket(ticketId, assigneeId)`** (IT_SUPPORT or ADMIN)
  - The assignee must be an approved IT_SUPPORT user.
  - Resolved or closed tickets cannot be reassigned.
  - Assigning moves OPEN → ASSIGNED.
  - Log either "Reassigned from A to B by X" or "assigned to B by X".
- **`takeOverTicket(ticketId)`** (IT_SUPPORT)
  - Claims a ticket from a peer or from the unassigned queue.
  - OPEN → ASSIGNED.
  - Logs `Ticket taken over by X (reassigned from Y)`.
- **`updateTicketPriority(ticketId, priority)`** (IT_SUPPORT with the ticket assigned to them, or ADMIN)
  - Validate the enum.
  - Recalculate `slaDeadline` from `createdAt`.
  - Log the change.
- **`addComment(ticketId, content, isInternal)`**
  - Non-empty content.
  - Employees can comment only on their own tickets, and `isInternal` is forced to false for them.
  - Log `Comment added by X`.
- **`confirmTicketResolution(ticketId)`**
  - Only the ticket creator can confirm, and only while the ticket is RESOLVED.
  - Sets the status to CLOSED and sets `closedAt`.
- **`reopenTicket(ticketId, reason)`**
  - Only the creator can reopen, from RESOLVED or CLOSED.
  - The reason must be at least 5 characters.
  - New status: IN_PROGRESS if the ticket is assigned, otherwise OPEN. This is the only allowed backward transition.
  - Log the reason.
- **`submitCsatRating(ticketId, rating, feedback)`**
  - Only the creator can rate, only while the ticket is RESOLVED or CLOSED.
  - Rating must be 1–5.
  - Log `CSAT Rating submitted: N Stars`.
- **`toggleAvailability()`** and **`getMyAvailability()`**: IT_SUPPORT only.
- **`getTicketDetails(id)`**: role-aware fetch with comments, history and users. Used by the drawer.

Every mutation must call `revalidatePath` for `/tickets` and `/tickets/[id]`.

### SLA breach tracking
Whenever tickets are loaded (or in a helper run from list and detail pages), mark open tickets whose `slaDeadline < now` with `slaBreached = true`.

## 5. Skill-Based Auto-Assignment (`lib/services/assignment.ts`)

`resolveAutoAssignment(category)`:
1. Find users with:
   - `role = IT_SUPPORT`
   - `accountStatus = APPROVED`
   - `isAvailable = true`
   - the category included in their parsed `skills` array (parse the JSON; do not rely on a substring `contains`)
2. Pick the agent with the **fewest active tickets** (status not RESOLVED or CLOSED).
3. Return `{ assigned: true, agentId, agentName, status: 'ASSIGNED' }`, or `{ assigned: false, status: 'OPEN' }` when no agent matches.

`autoAssignTicket(ticketId, category, actorId)` applies the result to an existing ticket and writes the audit log.

## 6. Business-Hours SLA Engine (`lib/sla.ts`)

Write these as pure functions that are fully unit-tested:

- **`calculateBusinessHoursDeadline(startDate, requiredHours, config)`**
  - `config` = `{ startHour, startMinute, endHour, endMinute, workDays: number[] (0 = Sunday), pauseOnWeekends }`.
  - Throw if start ≥ end, or if `workDays` is empty.
  - If `pauseOnWeekends` is false, return `start + requiredHours` in wall-clock time.
  - Otherwise, count only minutes inside business hours on work days, rolling over to the next valid business day.
- **`getSlaStatus(deadline, now = new Date(), locale)`** returns `{ isBreached, label, minutesLeft }`. Labels:
  - English: "Xh Ym left" / "Breached by Xh Ym"
  - Arabic: "متبقي Xس Yد" / "تجاوز الموعد بـ Xس Yد"
- **`<SlaBadge deadline>`** is a client component that re-renders every 60 seconds: green while on track, red pulsing when breached.

Map the setting day names ("Sunday"…) to day numbers when building the config.

## 7. AI Features (`lib/gemini.ts` + API routes)

All prompts send **only** the ticket title, description and comments. Never send emails, passwords or other personal metadata.

### Triage (`POST /api/ai/triage`)
- **Input:** `{ title, description }`.
- **Output (JSON):**
  ```
  { category, priority, selfHelp: string[2..3], confidence: 'low'|'medium'|'high', matchScore: 0-100, reason }
  ```
- **Prompt guidelines:**
  - CRITICAL = work stoppage, data loss or security breach
  - HIGH = significant disruption affecting many users
  - MEDIUM = workaround available
  - LOW = minor issue
  - self-help steps must be actionable right now
- Validate the parsed JSON (category in the list, valid priority) before returning it.
- If `enableAiTriage` is off, return 503. Error codes: 503 when the key is missing, 500 on other failures.

### Human-in-the-loop (mandatory)
The AI result is shown as a **proposal card**: category, priority, match score, reason, self-help steps, and the SLA tier for the proposed priority. The user must click **"✓ Accept AI Suggestion"** to fill in the form, or **"✗ Dismiss"** to ignore it. The AI never changes the form or saves anything on its own.

### Fallback heuristics (`getSmartFallbackTriage`)
- Runs when the API fails and `fallbackHeuristicsEnabled` is on.
- Uses keyword rules:
  - **Network:** vpn, wifi, dns, gateway; "down" or "outage" → CRITICAL
  - **Hardware:** laptop, battery, screen, keyboard; "fire" or "smoke" → CRITICAL
  - **Access & Permissions:** password, login, sso, mfa → HIGH
  - **Software:** license, app, crash, named apps → MEDIUM
  - **Printer:** printer, paper, toner
  - **Email & Communication:** email, outlook, smtp
  - **Other:** everything else
- Each rule also returns self-help steps.
- Also show a live, lightweight preview badge while the user types the title.
- Hide suggestions whose matchScore is below `aiConfidenceThreshold`, or flag them as low confidence.

### Summary (`POST /api/ai/summarize/[id]`, IT_SUPPORT or ADMIN)
- Returns `{ summary (2 sentences), nextAction }`, built from the ticket fields and the comment thread.
- Shown on the ticket detail page through a "Generate AI Summary" button.

### Translation
- Available as the server action `translateAction({ text, targetLanguage })` and as `POST /api/ai/translate`.
- Translates between Arabic and English and keeps technical terms (VPN, SSO, error codes) unchanged.
- **Fallback:** a dictionary of the seeded ticket phrases, then keyword-based generic translations.
- **`<AiTranslateButton text>`:** appears on ticket descriptions and comments. It toggles between the original and the translation, shows a loading state, and lets the user retry on error. The target language is the opposite of the current UI language.

## 8. File Uploads (`POST /api/upload`)

- Requires login.
- Accepts multiple files under the `files` field.
- **Limits:** max 10 MB per file, max 5 files.
- **Allowed types:** images, PDF, txt, log, docx, xlsx, zip.
- Sanitize filenames to `${Date.now()}-safe_name` and save them to `public/uploads`.
- Return `{ attachments: [{name, size, type, url}] }`.
- **UI:** drag-and-drop zone, image previews (FileReader), human-readable file sizes (B/KB/MB), remove button, uploading spinner.

## 9. Internationalization (EN / AR, RTL / LTR)

- **`LanguageProvider`** (client context) exposes:
  - `locale`, `dir`, `isRTL`
  - `setLocale` and `toggleLanguage`
  - `t(path, paramsOrFallback)`: dot-path lookup with `{param}` interpolation, falling back to English and then to the key
  - `dictionary`
- **Persistence and detection:**
  - Save the locale in localStorage (`helpdesk-lang`, wrapped in try/catch) **and** in a cookie with the same name, so Server Components can read the locale.
  - Detect the browser language on the first visit.
  - Set `dir`, `lang` and `data-lang` on `<html>`.
- **Dictionaries:** `lib/i18n/locales/en.ts` and `ar.ts` share the same shape (a type exported from en). They cover all UI strings, statuses, priorities, categories, roles and days.
- **Label helpers:** `getStatusLabel`, `getPriorityLabel`, `getCategoryLabel` (with fuzzy fallback), and `getRoleLabel` (Arabic: مدير النظام / دعم فني / موظف).
- **`formatRelativeTime(date, locale)`:**
  - "Just now" for times under a minute
  - `Intl.RelativeTimeFormat` for minutes and hours
  - "Yesterday at 3:15 PM"
  - "N days ago" for under a week
  - otherwise a short date with the time
- **Layout:** use logical RTL-safe utilities (`rtl:` variants, `ms`/`me`) and flip sidebar borders and icons. Use the Cairo font for Arabic.
- **Switching:** `<LanguageSwitcher>` on the auth pages, and a language toggle in the user dropdown.

## 10. Theming & Design System

- **Tokens in `globals.css`:** CSS variables `--bg-base`, `--bg-elevated`, `--bg-hover`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted` and `--brand`, defined for both light and dark mode.
- **No hard-coded colors:** never use `text-white` or `bg-gray-900` for themed surfaces. Text must stay readable in both modes.
- **Badge classes:**
  - `badge-open`, `badge-assigned`, `badge-in-progress`, `badge-resolved`, `badge-closed`
  - `badge-low`, `badge-medium`, `badge-high`, `badge-critical`
- **Accent colors:** blue, slate, violet, emerald. Store the choice in localStorage (`helpdesk-accent`) and apply it through a data attribute on `<html>`.
- **`<ThemeSwitcher>`** popover with mode (light/dark/system) and accent options.
- **`<ThemeProvider>`** wraps `next-themes` and applies the accent.
- **Global toasts:** `sonner` Toaster, bottom-right, using the theme tokens.
- **General look:** clean, minimal, enterprise style. Subtle framer-motion transitions, skeleton loading states, `error.tsx` and `loading.tsx` boundaries, and a localized `not-found.tsx`.
- **Responsive:** must work at phone width. Collapse sidebars into a top or mobile menu.

## 11. Pages & UI

### `/login` (public)
- Email and password form using `useActionState`, with a pending state and inline error.
- **Demo quick-login cards** for the seeded accounts (alice / bob / mike / admin). Clicking a card fills in the credentials.
- **`TicketFlowSimulator`:** an animated showcase of the ticket lifecycle with a few scenarios.
- Theme and language switchers, plus a link to register.

### `/register` (public)
- Name, email, password (with a strength hint), and a role picker shown as cards (Employee / IT Support).
- On success, show an animated success state explaining approval status: approved right away, or waiting for admin approval.

### Tickets area layout (`app/tickets/layout.tsx`, server)
Reads the session and the locale cookie, then renders one of two layouts.

**Employee layout:** top header with brand ("Smart Helpdesk" / "المكتب الذكي للدعم الفني", "Employee Portal"), a "My Tickets" link, a "Create Ticket" button, the theme switcher and the user dropdown.

**IT Support / Admin layout:** a left sidebar (right sidebar in RTL) with:
- the brand
- **Workspace:** Dashboard link, plus "Back to Admin" for admins
- for IT_SUPPORT:
  - a **critical alert box** showing the count of active CRITICAL tickets and a link to `?priority=CRITICAL`
  - **Operational Queues** with count badges:
    - Assigned to Me (active only)
    - Unassigned (OPEN with no assignee, amber)
    - Critical (red with a ping animation)
  - **Categories** with an icon and count for each category
- a footer with `<AvailabilityToggle>` (Available/Away pill with a toast on change) and `<UserDropdown>` (name, role, theme, language, logout)
- a sticky top banner in the main area when critical incidents exist: "⚡ N Critical Incidents — Immediate Response Required", with a "View Now →" link

### `/tickets` (list / dashboard)
**Server side:**
- Visibility by role:
  - Employee → own tickets only
  - IT → all tickets, or only their own with `queue=assigned_to_me`
  - Admin → all tickets
- IT users with no query params are redirected to `?queue=assigned_to_me`.
- Also loads the total count, the assigned-to-me count and the list of approved agents.

**Client (`TicketListClient`):**
- **Header:** title changes by role and queue. Employees get a "Create Ticket" CTA; IT gets queue tabs (All / Assigned to Me) with counts.
- **Stat cards:** Total, Open, In Progress, Resolved, Critical ("My Critical" for employees).
- **Bar chart:** tickets by status (Recharts, custom themed tooltip, a fixed color per status).
- **Search:**
  - searches title, description, category, id, `#number`, creator and assignee
  - `Ctrl/⌘+K` or `/` focuses the search box
- **Filters** in a collapsible panel:
  - status (supports a comma list such as `ASSIGNED,IN_PROGRESS`)
  - priority, category, agent (including "Unassigned"; admin view)
  - date range (all / today / week / month)
  - assigned-to-me toggle
  - an active-filter count and "Clear all" (which also clears the URL)
  - filters are initialized from URL params and kept in sync with them
- **Sorting:** by priority order and by date.
- **Layout:** employees get a responsive card grid; IT and admin get dense rows. Each item shows `#number`, title, status and priority badges, category, creator and assignee avatars (initials), comment count, relative time, and the SLA badge.
- **Empty states:** a friendly one with a CTA for a new employee, and a "no results, clear filters" one when filters match nothing.
- **Critical notice:** on mount, IT agents with critical tickets assigned to them get a red toast.
- **Drawer:** clicking a row opens `TicketDrawer` instead of navigating away.

### `TicketDrawer` (slide-over)
- Rendered through `createPortal` to `document.body`, fixed to the right edge of the viewport (left in RTL) with `h-screen` and a backdrop. It is never nested inside the scrolling table.
- Animated with framer-motion. Closes on Esc or a backdrop click.
- Loads data with `getTicketDetails`.
- **Contents:**
  - header with number, title and badges, plus a link to the full page
  - description with a translate button
  - meta: requester, assignee, category, SLA, created time
  - a "Next status" quick action following `VALID_TRANSITIONS`, with confetti on RESOLVED
  - a Take Over button when the ticket belongs to a peer
  - recent comments and a quick reply box
- After any action the drawer refreshes its own data and the list.

### `/tickets/new` (`NewTicketClient`)
- **Form fields:** title, description (with a character counter), category select (from `settings.categoriesList`), priority picker as 4 colored cards showing their SLA tier, auto-assign checkbox, attachments drop zone.
- **SLA tier info** shown on the cards:
  - CRITICAL: "Immediate P1 Escalation, < 15 min first response"
  - HIGH: "< 1 h"
  - MEDIUM: "< 4 h"
  - LOW: "< 24 h"
- **AI:** an **"Analyze with AI"** button that produces the proposal card (§7, Accept / Dismiss).
- **Demo scenario chips:** Printer Jam (LOW), VPN Timeout (HIGH), Figma License (MEDIUM), MacBook Battery Bulge (CRITICAL). Clicking a chip fills in a realistic title and description to demo triage.
- Uses `useActionState(createTicket)` for field errors and a pending state.
- Shows a maintenance-mode message when that mode is on.

### `/tickets/[id]` (detail, `TicketDetailClient`)
- **Header:**
  - `#number`, title, status and priority badges, SLA badge, category
  - Copy link button (shows a "Copied" state)
  - Back link
- **Main column:**
  - description with a translate button
  - attachment grid (image thumbnails and file cards with size)
  - **Activity tabs:** All / Comments / History, as one timeline merged by time
  - comments show the author avatar, role badge, relative time and a translate button; internal notes are styled in amber with an "Internal" label
  - **Comment composer:** `Ctrl/⌘+Enter` submits; an "Internal note" toggle (IT only); a **canned responses** dropdown (IT only) that inserts saved replies from settings
- **Sidebar for IT and admin:**
  - **Status control:** shows only valid next statuses, with confetti on RESOLVED
  - **Read-only notice** when the ticket belongs to a peer, with a **Take Over** button; a **Claim** button when unassigned
  - **Assignment form:** agent select showing each agent's skills and availability dot; submits through `assignTicket`
  - Priority change
  - **AI Summary** button (calls the summarize API)
  - **AI Recommendations** card: diagnostic steps based on the category, from the AI or a heuristic fallback, clearly labeled
- **Sidebar for the requesting employee:**
  - RESOLVED → a banner with **"Confirm Resolution"** and **"Reopen"** (opens a dialog that requires a reason)
  - RESOLVED or CLOSED and not yet rated → a **CSAT** widget (1–5 stars plus optional feedback)
  - once rated, the submitted rating is shown
- **Details card:** requester (name and email), assignee, created, updated, resolved and closed times, and the SLA deadline.
- Every action uses `useTransition`, a toast, then `router.refresh()`.

### Admin console (`/admin/*`, ADMIN only)
**Admin layout:**
- A sidebar (`SidebarNav`, active-link highlighting) with:
  - Users, with a **pending approvals** badge and a popover listing the latest 4 pending users
  - All Tickets
  - Settings
  - an **SLA breaches** badge with a list of the 4 most overdue open tickets
  - a "System health" widget (system operational, AI status based on whether the key is configured, DB status)
  - the user dropdown
- A top bar with "Admin Console", a role badge and the theme switcher.

**`/admin/users` (`AdminUsersClient`):**
- **Count chips:** total / pending / approved / rejected / suspended / invited. They double as filters.
- **Controls:** search by name or email, role filter.
- **Table:**
  - checkbox selection
  - avatar, name, email
  - `RoleBadge` (icons: Shield / Wrench / User)
  - `StatusBadge`
  - skills chips for IT users
  - availability
  - stats: "N resolved" for IT users, "N submitted" for employees
  - joined date and last login (relative)
- **Row actions** depend on status: Approve / Reject / Suspend / Reactivate.
- **Bulk bar:** when rows are selected, Approve or Reject all selected PENDING users.
- **Modals** (portal-rendered):
  - **Invite User** (email and role): creates an INVITED user with a random hashed temporary password
  - **Edit User** (role and, for IT, skill checkboxes from the shared category list; skills are cleared when the role is not IT)
- **Server actions** (`app/actions/admin.ts`, each calling `requireAdmin`): `updateUserStatus`, `bulkUpdateUserStatus`, `updateUserSkills`, `updateUserRole`, `inviteUser`. Skills are validated against the shared category list. An admin cannot suspend or demote themselves.

**`/admin/tickets`:**
- Reuses `TicketListClient` with `isAdminView` (all tickets plus an agent filter).
- `/admin/tickets/[id]` reuses `TicketDetailClient` with full rights, including reassigning to any approved agent.

**`/admin/settings` (`SettingsClient`)** is a tabbed form with a save bar and pending state, plus `loading.tsx` and `error.tsx`:
1. **General:** app name, support email, default priority, auto-assignment toggle, notification toggles.
2. **SLA & Hours:** hours per priority, business start/end times, work-day checkboxes (localized day names), pause-on-weekends toggle.
3. **Categories:** add and remove categories (chips).
4. **AI & Automation:** enable triage, confidence threshold slider, fallback heuristics toggle.
5. **Canned Responses:** add, edit and delete `{title, content}` items.
6. **Agent Skills:** each approved agent with skill checkboxes, saved together with the rest of the settings.
7. **Security:** auto-approve domain, maintenance mode toggle.

`updateSettings` (admin only) validates the required name, a valid email, positive SLA hours, start < end, at least one work day, and valid JSON, then upserts the singleton row. `updateAgentSkills` validates skills against the category list.

**Every setting must actually change system behavior** (auto-assignment, AI on/off, threshold, fallback, default priority, domain auto-approve, maintenance mode, SLA hours and calendar, categories, canned responses). No setting may be UI-only.

## 12. Seed Data (`prisma/seed.ts`, runnable with `npm run db:seed`)

- **Settings:** upsert the AppSettings singleton with the defaults above.
- **Users** (all APPROVED). Store the demo passwords in the seed file and README only:

  | Name | Email | Role | Skills |
  |---|---|---|---|
  | Admin | admin@company.com | ADMIN | — |
  | Alice | alice@company.com | EMPLOYEE | — |
  | Bob | bob@company.com | IT_SUPPORT | Network, Hardware, Printer |
  | Mike | mike@company.com | IT_SUPPORT | Software, Email & Communication, Access & Permissions |

- **8 realistic tickets** across all statuses, priorities and categories, with SLA deadlines, comments (including an internal note) and history entries:
  - printer paper jam #E-204 (resolved, with a technician comment)
  - VPN drops every 15 minutes
  - corporate database unreachable
  - Microsoft 365 license activation failure
  - Outlook SMTP 550 error (resolved)
  - production DB server unreachable (CRITICAL)
  - staging DB access request
  - finance network printer offline
- The seed must be idempotent: clear the tables first, or use upserts.

## 13. Tests (`tests/`, Vitest)

Use a separate test database (`DATABASE_URL=file:./test.db`). Import the real modules instead of re-implementing their logic. Cover:

1. **Login:** correct and wrong password, unknown email, and each blocked account status.
2. **Ticket creation:** defaults, sequential numbers, the history entry, validation errors.
3. **Role authorization:** an employee cannot change status, assign or take over; IT can.
4. **State machine:** every valid transition, rejection of skipped and backward transitions, the full lifecycle in the DB, reopen rules.
5. **Data isolation:** an employee sees only their own tickets, cannot open or comment on others' tickets, and cannot see internal comments.
6. **SLA engine:** within the same day, spanning several days, starting on a weekend, starting after hours, `pauseOnWeekends = false`, invalid config throws, and `getSlaStatus` labels in both languages.
7. **Auto-assignment:** skill match, least-loaded agent wins, unavailable or unapproved agents skipped, fallback to OPEN.
8. **Peer lock and take-over.**
9. **Fallback triage:** keyword rules map to the correct categories and priorities.

Clean up all created data in `afterAll`.

## 14. Documentation

- **`README.md`:**
  - overview, tech stack table, Mermaid ER diagram
  - seeded accounts table
  - core capabilities: RBAC, state machine, AI, i18n, agent workflows, theming
  - environment variables, install and quick start (`npm i` → copy `.env.example` → `npx prisma migrate dev` → `npm run db:seed` → `npm run dev`)
  - testing, directory structure
- **`AI-USAGE.md`:**
  - AI tools used and what was delegated to them
  - manual architectural interventions (authorization isolation, state machine, peer lock, category normalization)
  - real bugs found and fixed (the hard-coded dark-mode colors and the drawer viewport bug)
  - rejected AI suggestions (silent auto-save of AI triage, which violates human-in-the-loop)
  - in-app AI privacy boundary and fallback design

## 15. Quality Bar

- TypeScript strict, no `any` in new code, and ESLint passes.
- Shared types and constants (`Status`, `Priority`, `Role`, categories, transitions) live in one place and are imported everywhere.
- All dates are serialized to ISO strings before reaching client components.
- Server actions return `{ error?: string }` instead of throwing, for expected failures.
- Accessibility: labeled inputs, focus states, Esc closes modals and drawers, sufficient contrast in both themes.
- `npm run build`, `npm run lint` and `npm test` must all pass.
