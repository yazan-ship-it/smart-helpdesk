# AI Usage & Engineering Control Report

## 1. Overview & Tooling
This project was developed for the **3-Day Vibe Coding Assessment** leveraging modern AI-assisted engineering workflows[cite: 7]. Rather than accepting generated code blindly, AI was treated as a rapid pair-programmer under strict architectural supervision[cite: 3].

**AI Coding Tools Used:**
- **Antigravity IDE & Claude 3.5 Sonnet:** Architectural scaffolding, complex Server Actions, state machine validation, and role-based access control (RBAC)[cite: 2, 7].
- **Gemini 2.0 Flash / Pro:** Codebase audits, theme variable normalization, bug analysis, and powering the in-app triage engine[cite: 2, 7].

---

## 2. What Was Delegated to AI
- Initial boilerplate scaffolding for Next.js App Router with TypeScript[cite: 2, 7].
- Relational schema definition in Prisma ORM (SQLite)[cite: 2, 7].
- Drafting repetitive Tailwind CSS components, badge counters, and Recharts integration[cite: 2, 7].
- In-app integration of the Google GenAI SDK (`gemini-2.0-flash`) for automated category and priority proposals[cite: 2, 7].

---

## 3. Manual Refactoring & Architectural Interventions
Significant engineering interventions were applied to enforce production-grade integrity:
1. **Server-Side Authorization & Isolation:**
   - Overrode generic queries to ensure `EMPLOYEE` accounts can strictly fetch only tickets where `createdById === session.userId`[cite: 6, 7].
   - Blocked unauthorized URL manipulation on `/tickets/[id]` by throwing server-side 404/403 responses[cite: 2, 7].
2. **State Machine Integrity:**
   - Enforced a backend transition dictionary (`VALID_TRANSITIONS`) ensuring the immutable path: `OPEN` ➔ `ASSIGNED` ➔ `IN_PROGRESS` ➔ `RESOLVED` ➔ `CLOSED`[cite: 7, 8].
   - Enforced peer edit locking so agents cannot modify tickets claimed by peers without an explicit "Take Over" action[cite: 2, 8].
3. **Flexible Category Matching:**
   - Resolved client filtering bugs where database values like `"Email & Communication"` clashed with URL search parameters (`?category=Email`), implementing normalized matching[cite: 2, 4].

---

## 4. Real Bug / AI Hallucination & How It Was Resolved
- **The Issue (The "Dark Mode Trap"):**
  - The AI hardcoded dark-theme utility classes (`text-white`, `bg-gray-900`) globally, causing text and headings to become completely invisible or transparent upon switching to Light Mode[cite: 2, 4].
  - **The Discovery:** Manual UX inspection during theme toggling[cite: 2, 4].
  - **The Fix:** Eradicated hardcoded utilities and migrated the system to adaptive semantic CSS variables compatible with `next-themes`[cite: 2, 4].

- **The Secondary Issue (Slide-Over Drawer Viewport Bug):**
  - The AI implemented the ticket drawer nested inside the scrollable table container, causing massive empty whitespace and clipping on long lists[cite: 2, 4].
  - **The Fix:** Refactored the drawer into a decoupled React Portal anchored strictly to the browser viewport (`fixed inset-y-0 right-0 h-screen z-50`)[cite: 2, 4].

---

## 5. Rejected AI Recommendations (Engineering Governance)
- **Silent Auto-Save on Ticket Creation:**
  - **AI Proposal:** The AI recommended automatically applying and persisting the Gemini-suggested Category and Priority directly to the database on form change to "minimize clicks"[cite: 2, 4].
  - **Why It Was Rejected:** This violated the core assessment constraint: *"The AI must not automatically save or change the ticket without user confirmation"* (Human-in-the-Loop principle)[cite: 3, 4].
  - **Implementation:** Built an explicit interactive Proposal Card requiring manual user action—either **"✓ Accept AI Suggestion"** or **"✗ Dismiss"**—before populating controlled form state[cite: 2, 3].

---

## 6. In-App AI Feature Architecture & Privacy
- **Model:** `gemini-2.0-flash` called server-side via `/api/ai/triage`[cite: 2, 5].
- **Data Boundary:** Only ticket `title` and `description` are transmitted; no user emails, passwords, or employee metadata are ever shared[cite: 2, 3].
- **Reliability Fallback:** If the Gemini API key is missing or quota is exceeded, the system automatically engages local keyword-based heuristics (`getSmartFallbackTriage`) without interrupting the employee's workflow[cite: 2, 3].