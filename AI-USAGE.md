# AI Usage

This project was built for the 3-Day Vibe Coding Assessment, which asks candidates to use AI coding tools and to review and validate what they generate. This file explains which tools I used, what I delegated to them, what I decided myself, and how I checked their output.

## Contents

- [Tools](#tools)
- [How the work was split](#how-the-work-was-split)
- [Phase 1: first build](#phase-1-first-build)
- [Phase 2: review and rework](#phase-2-review-and-rework)
- [How I validated AI-generated code](#how-i-validated-ai-generated-code)
- [AI mistakes that were caught](#ai-mistakes-that-were-caught)
- [AI proposals I rejected or changed](#ai-proposals-i-rejected-or-changed)
- [AI inside the app](#ai-inside-the-app)
- [What is still open](#what-is-still-open)

## Tools

| Tool | Used for |
|---|---|
| **Antigravity IDE** with **Claude 3.5 Sonnet** | Phase 1: scaffolding the Next.js app, Server Actions, the ticket state machine and role checks |
| **Gemini** (chat) | Phase 1: codebase reviews, theme variables, bug analysis |
| **Claude Code** (Claude Opus 5.5, in the Claude desktop app) | Phase 2: full audit of the app, then fixes, security work, tests, the PostgreSQL move, CI and deployment |
| **Google Gemini API** (`gemini-2.5-flash`, fallback `gemini-2.5-flash-lite`) | Inside the app: ticket triage suggestions, summaries for IT staff, translation |

Commits from phase 2 carry a `Co-Authored-By: Claude` trailer, so GitHub shows which changes were made with Claude Code.

## How the work was split

**Delegated to AI:** writing most of the code, running the tests and checks, searching the codebase, drafting documentation, and proposing fixes with their trade-offs.

**Decided by me:** what the app should do, which findings to fix and in what order, every product and architecture decision listed below, and whether each change was acceptable. In phase 2 nothing was changed before I had seen a report and chosen what to do, and nothing was pushed to GitHub without my explicit approval.

## Phase 1: first build

I built the first version with Antigravity IDE and Claude 3.5 Sonnet, using Gemini for reviews. Problems I found and fixed by hand in that phase:

- **Dark mode trap:** the AI hard-coded dark-theme classes (`text-white`, `bg-gray-900`), so headings disappeared in light mode. I found it by switching themes and moved the colours to CSS variables.
- **Drawer inside the table:** the AI nested the ticket drawer inside the scrollable list, which clipped it and left empty space. I moved it into a portal fixed to the viewport.
- **Category mismatch:** values like `"Email & Communication"` didn't match URL filters like `?category=Email`. I added normalised matching.
- **Human in the loop:** the AI proposed saving Gemini's category and priority automatically to save clicks. I rejected it, because the assessment says the AI must not change a ticket without the user's confirmation. The employee now clicks **Use this suggestion** or **Dismiss**.

## Phase 2: review and rework

After the first build I used Claude Code to review the whole app as if it were going to production. The workflow for every step was the same:

1. **Audit:** Claude Code used the app as each role (employee, IT support, admin), in Arabic and English, on desktop and phone width, and read the code. It changed nothing at this stage.
2. **Report:** a list of findings, ranked, with the trade-offs of each fix.
3. **Decision:** I chose what to fix and in what order.
4. **Implementation:** code, then tests, then a check in the browser, then one commit per change explaining what and why.

The work went in phases that I approved one at a time:

| Phase | Main changes |
|---|---|
| Honesty and bugs | Replaced hard-coded "AI" output with real Gemini calls; fixed role labels, skill/category mismatch, SLA tracking, translations, phone layout |
| Security | Auth on every API route, safe uploads, sessions checked against the database, login rate limits, server-side validation, private attachments |
| Deployability | SQLite to PostgreSQL (Neon) with versioned migrations, a separate test database, GitHub Actions CI, health check, Vercel deployment |
| Full audit (18 findings) | Region, timing attacks, upload limits, indexes, parallel queries, clean-up, Prisma 7, splitting two ~1,170-line components |
| Supervisor review | ER diagram matched to the schema, lifecycle and hierarchy diagrams, permission matrix, one owner per ticket, protection against simultaneous clicks |
| Production readiness | Server-side pagination, Sentry error monitoring, CI fixes |

## How I validated AI-generated code

- **Tests that call the real code.** Every test calls the real Server Action, page or API route against a real PostgreSQL database. Only the session and the Gemini API are stubbed. The suite grew from 25 to 160 tests.
- **Breaking the code on purpose.** To prove the tests would catch a regression, the app was broken deliberately and the tests had to fail:
  - allowing any status transition;
  - letting employees see other people's tickets;
  - letting employees write internal notes;
  - letting pending accounts sign in;
  - restoring the old upload route.
- **Automatic checks on every push** (GitHub Actions): lint, type check, tests, a check that the migrations match the schema, and a production build.
- **Browser checks** of every change, as each role, in both languages and at phone width. I also tested the deployed site myself: creating tickets, uploading attachments, and turning an agent's availability off to see a ticket go to the unassigned queue instead of being auto-assigned.
- **Requests without a session** to every API route, to confirm they return 401.

## AI mistakes that were caught

**In the phase 1 code** (found during the phase 2 audit):

- **Tests that tested nothing.** The original 25 tests re-implemented the logic inside the test, so they passed even when the app was broken. Removing the employee ticket filter from the app left them green.
- **Invented AI output.** The ticket page showed a "Gemini 3.8" diagnosis with "98.2% confidence". It was fixed text, and that model doesn't exist. The new-ticket form showed a fixed "98% match".
- **Unauthenticated endpoints.** File upload and the AI routes had no session check, and uploads kept the user's extension in `/public`, so an `.html` file could run script on the app's origin.
- **Silent false success.** The ticket drawer showed "Success" with confetti even when the server refused the change.

**In phase 2, by Claude Code itself:**

- It reported that the database CHECK constraints were missing. They already existed in the first migration; it had read the schema but not the migrations. The new migration failed ("constraint already exists"), the mistake was acknowledged, and the migration was reduced to the one constraint that really was missing.
- It reported that git history contained no secrets. Later it found that the first commit had a `SESSION_SECRET` in the README, in a public repository. The secret was rotated, and production uses a different one.
- Its checks passed locally but the CI failed on GitHub, twice: the lockfile missed two optional packages that newer npm versions require, and the type check relied on route types that only exist after a local `next dev`. Each failure was reproduced locally before it was fixed. Running every CI step in a fresh clone then found a third problem (a shadow database setting that would have broken the tests) before it reached GitHub.

## AI proposals I rejected or changed

| Proposal | My decision |
|---|---|
| Convert roles and statuses to database enums | Rejected: it rewrites columns that hold data and is hard to undo. I chose PostgreSQL CHECK constraints instead, which give the same guarantee without code changes (see the README). |
| Docker for local development and deployment | Dropped: Vercel and Neon cover the demo, and I didn't want to require Docker. |
| Remove the one-click demo logins | Kept them, but only when `DEMO_MODE=true`, so a real deployment doesn't expose demo passwords. |
| Keep the fake Google/GitHub sign-in buttons | Removed them instead of building OAuth for the demo. |
| Keep the AI confidence-threshold setting | Removed it: the app never used it. |
| Show notification settings | Hidden until email notifications exist. |
| A visual redesign | Postponed in favour of correctness and security. |

## AI inside the app

- **What it does:** suggests a category, priority and self-help steps for a new ticket, summarises a ticket for IT staff, and translates tickets and comments.
- **Human in the loop:** suggestions are never applied automatically. The employee accepts or dismisses them.
- **Validated output:** Gemini must answer in a JSON schema, and the server only accepts the admin's categories and the four priorities.
- **Prompt injection:** ticket text is passed as data, with an instruction to ignore instructions inside it.
- **Data sent:** triage sends the ticket title and description. Summaries, which only IT staff and admins can request, also send the ticket's discussion. No emails, passwords or account data are sent.
- **Limits and fallbacks:** each user gets 30 AI requests per 10 minutes. If Gemini is overloaded, a second model is tried. If AI is unavailable, triage uses keyword rules that are labelled as such, and summaries and translation show an error instead of inventing text.
- **Error monitoring:** Sentry receives only the error, stack trace and route, never cookies, request bodies or AI prompts.

## What is still open

- Email (invites and password reset) is not implemented. Admins share a one-time password instead.
- There are no browser end-to-end tests yet (e.g. Playwright).
- The Content-Security-Policy is partial: it blocks framing, plugins and `<base>` tricks, but doesn't restrict script sources.
