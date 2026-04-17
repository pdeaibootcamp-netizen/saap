# ADR-0001 — MVP Tech Stack

*Owner: engineer · Slug: adr-0001-tech-stack · Last updated: 2026-04-17*

---

## Upstream links

- Build plan: [docs/project/build-plan.md](../project/build-plan.md) §4 (Phase 1 scope)
- Decision log: [docs/project/decision-log.md](../project/decision-log.md) D-001 through D-009; D-013 (Supabase Postgres + Vercel hosting)
- PRD §10 (Data and Technical Foundation), §11 (Go-to-Market), §9 (Release Plan)

---

## Context

Strategy Radar MVP is a time-boxed trial lasting less than one month. It must:

- Serve a Czech-only (D-004) web view of authored briefs to SME owner-operators via George Business embedding (PRD §11) or a browser link.
- Deliver those briefs in three formats: email, in-app web view, and downloadable PDF (PRD §9 Multi-Format Delivery).
- Provide a minimal back-end surface for ČS analysts to author and publish briefs — no automated generation (CLAUDE.md guardrail, D-005).
- Enforce architectural separation between data lanes (privacy is a product feature — CLAUDE.md, PRD §10).
- Be hosted without over-engineering for scale, SSO, multi-tenancy, or any Increment 2–5 concern.

The brief trial window rules out framework sprawl, significant operations investment, or exotic toolchain choices. The guiding principle: use the fewest mainstream, well-understood tools that satisfy the requirements above.

---

## Decisions

### ADR-0001-A — Web app framework: Next.js (TypeScript)

**Decision:** Use Next.js (App Router) with TypeScript as the single web framework for both the owner-facing brief view and the analyst authoring back-end.

**Rationale:**
- A single codebase for two surfaces (owner view, analyst admin) eliminates coordination overhead during a short trial.
- Next.js server-side rendering produces HTML that can be used as the source for PDF generation (see ADR-0001-D), avoiding a separate HTML template engine.
- TypeScript catches lane-boundary violations at compile time — a lightweight enforcement layer on top of module-level privacy boundaries (PRD §10).
- Well-understood, large ecosystem; no new dependency risk; deployable to managed platforms with zero ops overhead.
- Czech-only (D-004): no i18n library needed at MVP; static Czech strings in components are sufficient.

**Consequences:** Commits the front-end and the analyst UI to the same server. Acceptable at trial scale; Phase 2 may separate them if analyst traffic patterns diverge significantly.

**Rejected alternatives:**
- *Separate React SPA + Express API* — doubles deployment surface and the integration test surface for a one-month trial; no offsetting benefit.
- *Django/Python stack* — team familiarity is lower; Python does not improve on Next.js for SSR-to-PDF; breaks the "fewest tools" principle.
- *Plain HTML + server-side templates (e.g., Jinja2 or Handlebars)* — faster to bootstrap but makes the analyst authoring UI significantly harder to build without a component model.

**Status:** Accepted — 2026-04-17

---

### ADR-0001-B — Email delivery: Resend with React Email templates

**Decision:** Use Resend as the transactional email sending service, with React Email as the template layer.

**Rationale:**
- Resend has generous free-tier limits that cover a sub-one-month trial with a small analyst team and a limited pilot cohort; no procurement or contract required for a trial.
- React Email renders HTML email from React components — the same component model as the brief web view. A single brief component tree renders to both the web view (via Next.js) and the email (via React Email), keeping the two delivery channels in sync with minimal code duplication.
- Czech-only content (D-004) means no localization complexity in email templates.
- Resend provides delivery analytics (open/click tracking) that feed the engagement metric (G1).

**Consequences:** Trial email volume is small enough that Resend's free tier is adequate. If the trial extends and volume grows, escalation to a paid Resend plan is a billing-only change, not an architecture change. The email-sending API call must originate from the server side of Next.js (not the client) to keep the sending API key out of the browser — standard practice.

**Rejected alternatives:**
- *AWS SES* — requires AWS account setup, IAM policy configuration, and sandbox lift request; disproportionate ops overhead for a trial.
- *SendGrid* — comparable feature set but more complex onboarding; Resend is the leaner choice for a proof-of-concept window.
- *Nodemailer with SMTP relay* — requires managing SMTP credentials and a relay service; more fragile than a managed API.

**Status:** Accepted — 2026-04-17

---

### ADR-0001-C — PDF generation: Server-side Puppeteer (headless Chromium)

**Decision:** Generate PDFs server-side using Puppeteer to render the brief web view URL and print it to PDF.

**Rationale:**
- Briefs are already rendered as HTML by Next.js. Puppeteer navigates to that URL (or an internal equivalent) and calls `page.pdf()` — this produces a faithful rendering of the brief with no second template.
- The same CSS that styles the web view governs the PDF layout, so design parity is guaranteed without maintaining a separate print stylesheet beyond `@media print` overrides.
- Puppeteer is a well-understood tool with no licensing concerns.
- PDF is triggered on-demand at publish time by the analyst, not in a hot user-request path — so Puppeteer's startup cost (~1–2 s) is acceptable.

**Consequences:** Puppeteer requires a Chromium binary in the deployment environment. This is a new dependency that must be confirmed compatible with the chosen hosting platform before deployment (logged as Q-001). If the hosting platform does not support Chromium binaries, the fallback is `@react-pdf/renderer` (a node-native React-to-PDF library — weaker CSS fidelity but zero binary dependency). That fallback decision is deferred to Phase 2 deployment confirmation.

**Rejected alternatives:**
- *wkhtmltopdf* — unmaintained upstream; licensing ambiguities on some distributions; weaker CSS support than Puppeteer.
- *`@react-pdf/renderer`* — node-native (no binary), but uses a proprietary layout engine that does not match browser CSS, so the PDF would diverge visually from the web view. Acceptable fallback only.
- *`pdfkit`* — low-level, programmatic PDF construction; requires a fully separate document model from the HTML brief; doubles authoring work.

**Status:** Accepted — 2026-04-17. Deployment compatibility logged as Q-001.

---

### ADR-0001-D — Analyst brief-authoring back-end: Minimal admin UI in Next.js

**Decision:** The analyst authoring back-end is a password-protected route group within the same Next.js application (`/admin/*`), backed by a simple database (see ADR-0002 for storage). No CMS platform (e.g., Contentful, Sanity) is introduced.

**Rationale:**
- The trial window is less than one month. A CMS platform requires procurement, onboarding, content modeling, and integration — all disproportionate to that timeline.
- Briefs have a fixed structure defined in ADR-0002 (content sections, metadata, cohort targeting, publish state). This structure is stable enough to drive a bespoke form UI without a general-purpose CMS.
- Keeping authoring inside Next.js means the same deployment unit covers all surfaces; no second service to operate.
- Password-protected route group (`/admin/*`) using Next.js middleware provides sufficient access control for a small analyst team in a trial context. No SSO, no role hierarchy at MVP.
- No automated generation (CLAUDE.md guardrail, D-005) — the UI provides form fields for each brief section; the analyst fills them manually and hits "Publish."

**Consequences:** The admin UI is minimal and purpose-built. It will not generalize to a multi-tenant CMS or a rich WYSIWYG editor. Those are Phase 2–3 concerns.

**Rejected alternatives:**
- *Sanity or Contentful CMS* — flexible and powerful but require a content model definition, procurement, and cross-service integration; YAGNI for a one-month trial.
- *Flat-file workflow (Markdown files in a Git repo)* — avoids a database but makes the publish-to-email-and-PDF pipeline significantly harder to implement programmatically; requires analyst Git access and comfort.
- *Notion or Google Docs as authoring surface with a sync adapter* — introduces a third-party dependency and a sync complexity that the trial timeline cannot absorb.

**Status:** Accepted — 2026-04-17

---

### ADR-0001-E — George Business embedding posture: Redirect with auth token handoff (stub at MVP)

**Decision:** At MVP, the George Business embedding integration is a stub: a redirect link that ČS can place in George Business pointing to the Strategy Radar web view URL, with a query-parameter auth token for session identification. No iframe is implemented at MVP.

**Rationale:**
- PRD §11 names George Business embedding as the primary channel but the ČS integration is not available during the trial window.
- An iframe integration requires ČS to configure Content Security Policy headers and X-Frame-Options on both sides — non-trivial coordination that cannot happen inside a one-month trial.
- A redirect link requires only that ČS embed a hyperlink in George Business; no CSP negotiation, no cross-origin messaging.
- At MVP, the auth token in the query parameter is a simple signed token (e.g., JWT) that Strategy Radar validates to identify the user arriving from George — no full OAuth flow.
- The stub URL structure (`/briefs?token=<signed-jwt>`) is designed so that Phase 2 can replace the redirect with an iframe without changing the brief-rendering logic.

**Consequences:** The user leaves the George Business context to view the brief in a Strategy Radar browser tab. This is acceptable for a trial but must be revisited before a production launch. The stub also means RMs during the trial will introduce clients by sending a link, not by surfacing the brief inline.

**Rejected alternatives:**
- *Full OAuth / OIDC integration with George* — requires ČS API team involvement and security review; impossible in the trial window.
- *iframe embedding at MVP* — requires CSP coordination with ČS; deferred to Phase 2.
- *No authentication at MVP (public links)* — unacceptable; brief data is client-specific and must not be accessible without identity.

**Status:** Accepted — 2026-04-17. Phase 2 iframe upgrade logged as Q-002.

---

### ADR-0001-F — Hosting: Vercel (Next.js) + Supabase Postgres (managed database)

**Decision:** Deploy the Next.js application to Vercel on the Pro plan (or an existing ČS Vercel organization if available). Managed PostgreSQL is provided by Supabase Postgres. (D-013, 2026-04-17.)

**Rationale:**
- Vercel is the canonical deployment target for Next.js; zero configuration required beyond connecting the Git repository.
- Serverless functions handle the analyst publish pipeline and email trigger without an always-on server.
- The trial duration does not justify a Kubernetes cluster, a Docker Compose setup, or AWS infrastructure configuration.
- Vercel's Preview Deployments give the analyst team a staging environment for every branch at no extra setup cost.
- Czech-only, small-cohort trial means traffic is low enough to stay comfortably within Vercel's Pro limits.
- Supabase provides managed Postgres with row-level security (RLS) enabled by default — the same RLS approach used for lane enforcement in ADR-0002-C transfers unchanged. Supabase is upstream Postgres; no proprietary API is added to the lane-enforcement path.

**Consequences:** Puppeteer on Vercel requires the `@sparticuz/chromium` package (a Chromium build sized for serverless environments) — this is the specific dependency confirming Q-001 (see ADR-0001-C). `DATABASE_URL` will be a Supabase connection string (pooler or direct, depending on Vercel serverless connection limits — a Phase 2 deployment detail). If ČS security policy prohibits a third-party hosting platform, this ADR must be revised. That is a procurement/security gate, not a technical one — logged as Q-003.

**Rejected alternatives:**
- *Vercel Postgres (Neon-backed)* — engineer-recommended initially; rejected by user at OQ-002 in favour of Supabase (D-013). Functionally equivalent for RLS; user preference for Supabase's broader auxiliary service set was decisive.
- *AWS ECS / Fargate* — adequate but requires significant infrastructure configuration; YAGNI for a one-month trial.
- *Self-hosted VPS (DigitalOcean, Hetzner)* — requires ops: TLS, process management, monitoring; disproportionate for a trial.
- *Azure App Service + Azure DB (ČS-native cloud)* — plausible if ČS security requires internal hosting; deferred to Q-003 resolution.

**Status:** Accepted — 2026-04-17. Updated 2026-04-17 to reflect D-013 (Supabase Postgres). ČS security/procurement gate logged as Q-003.

---

## Data contracts

ADR-0001 defines the hosting and runtime surface. Actual brief data contracts (storage schema, lane separation, delivery pipeline) are in [ADR-0002](adr-0002-brief-storage-and-delivery.md). This ADR depends on the data lane definitions from the Data Engineer's [docs/data/privacy-architecture.md](../data/privacy-architecture.md) (Phase 1 parallel artifact — not yet landed).

---

## Test plan

*No `src/` code is produced by this ADR. Tests will be specified in the Phase 2 engineering artifact for each feature. The following test obligations arise from choices made here:*

- **ADR-0001-C (Puppeteer):** Integration test confirming PDF is generated without Chromium binary errors in the Vercel (`@sparticuz/chromium`) environment. Blocked on Q-001 resolution.
- **ADR-0001-E (George embedding stub):** Unit test confirming signed JWT is validated correctly and an invalid/expired token returns a 401 before any brief data is served.
- **ADR-0001-D (admin auth):** Integration test confirming `/admin/*` routes return 401 without the session cookie and 200 with a valid session.

---

## Deployment + rollback

- **Deploy:** Push to `main` triggers Vercel production deployment automatically.
- **Env vars required (production):** `RESEND_API_KEY`, `JWT_SECRET` (for George stub token signing), `DATABASE_URL`, `ADMIN_PASSWORD` (hashed, for analyst route group). All set in Vercel project settings — never committed to the repository.
- **Rollback:** Vercel retains the previous deployment; one-click instant rollback from the Vercel dashboard. No database migration rollback complexity at MVP (schema is append-only during trial).
- **Feature flag:** Not applicable at this ADR level. Individual features in Phase 2 will carry flags where needed.

---

## Open questions

| ID | Question | Blocking |
|----|----------|---------|
| Q-001 | Does `@sparticuz/chromium` work correctly in Vercel serverless functions for the PDF use case? | ADR-0001-C deployment confirmation; Phase 2 PDF delivery feature |
| Q-002 | Phase 2 plan for iframe embedding with ČS George Business (CSP negotiation, cross-origin message API) | Phase 2 George integration |
| Q-003 | Does ČS security policy permit hosting on Vercel, or must the app run on Azure/ČS-managed infrastructure? | ADR-0001-F; if blocked, revise to Azure App Service |

*Entries Q-001 through Q-003 are also logged in [docs/project/open-questions.md](../project/open-questions.md).*

---

## Changelog

- 2026-04-17 — initial draft — engineer
- 2026-04-17 — §F updated: managed Postgres moved from Vercel Postgres (Neon) to Supabase Postgres per D-013; Vercel Postgres added as rejected alternative; upstream-links decision-log reference updated — engineer
