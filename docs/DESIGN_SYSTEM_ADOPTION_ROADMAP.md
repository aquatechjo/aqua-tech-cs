# Aqua.Tech Design System Adoption Roadmap

## DS-01 — Design Foundation

Status: **implemented**

- Approve the 70/30 DNA model.
- Add canonical tokens.
- Add constrained product-theme configuration.
- Add design-system instructions for coding agents.
- Connect Aqua Tech CS to the token layer.
- Preserve current functionality and visual behavior.
- Add unit checks for theme boundaries.

## DS-02 — Bootstrap Primitives

Status: **implemented**

- Migrate AquaButton, AquaInput, AquaCard, AquaBadge, and AquaMark to semantic Bootstrap/CSS classes.
- Add select, textarea, alert, and toast contracts.
- Remove Tailwind dependency from shared primitives.
- Add component-state examples.

## DS-03 — Application Shell

Status: **implemented**

- Standardize sidebar, topbar, page shell, page header, breadcrumbs, and mobile navigation.
- Define compact/comfortable density modes.
- Fix logical RTL/LTR behavior.
- Add responsive navigation tests.

## DS-04 — Data and Workflow Patterns

Status: **implemented**

- Standardize form sections, filters, data panels, responsive tables, pagination, modals, confirmation dialogs, tabs, and detail lists.
- Define scroll and stacked mobile table strategies.
- Add loading, empty, error, success, and permission-denied page states.
- Add accessible modal focus management, Escape handling, body scroll locking, and reduced-motion behavior.
- Introduce `aqua-patterns.css` as the structured workflow layer above primitives and the application shell.
- Migrate the Clients CRM page as the first canonical implementation.

## DS-05 — Auth and Public Surfaces

Status: **implemented**

- Rebuild login, forgot-password, and reset-password using canonical components.
- Define marketing-to-product continuity through `aqua-public.css`.
- Separate transactional email templates from provider transport.
- Migrate password-reset email to the branded reusable template layer.
- Add the canonical AquaSystemDocument browser and print shell.
- Add public-surface, email-safety, and document-contract unit checks.

## DS-06 — Starter, Package, Showcase, and Governance

Status: **implemented**

- Extract `@aqua-tech/design-system` as a synchronized internal package containing components, contracts, and ordered CSS layers.
- Add a guarded in-product component Showcase at `/dashboard/design-system`.
- Add the Aqua.Tech Next.js product starter generator with constrained theme inputs.
- Add deterministic visual-contract regression for contracts, CSS, and Showcase structure.
- Add package synchronization checks so committed package files cannot drift from source.
- Add semantic versioning, release channels, migration notes, and release-gate rules.
- Keep browser screenshot review as a required human release gate before external stable publication.

## DS-06.1 — Showcase UX and Visual Polish

Status: **implemented**

- Give the Design System Showcase a dedicated full-width focus mode.
- Replace the long page with accessible section navigation and one focused panel at a time.
- Explain Package, Package Sync, Product Starter, and Visual Contract in plain language.
- Reorganize component examples, forms, workflows, and governance by intent.
- Clarify baseline status versus live command execution.
- Add a compact document preview and dedicated print flow.
- Fix light-document detail-list contrast and release package patch `0.6.1`.

## AD-01 — Dashboard Overview Adoption

Status: **implemented**

- Migrate the operational dashboard overview to canonical Aqua components.
- Preserve existing metrics, activity visibility, and role permissions.
- Add responsive metric, activity, and quick-action layouts.
- Use the company timezone with Latin digits for operational timestamps.
- Establish the dashboard as the first reference for Aqua Tech CS-wide adoption.


## AD-02 — My Day Adoption

Status: **implemented**

- Migrate My Day to canonical Aqua cards, panels, alerts, badges, and link actions.
- Preserve assignment visibility, due-date buckets, blockers, progress, and company timezone logic.
- Establish a daily focus hierarchy for overdue, today, upcoming, unscheduled, and later work.
- Add a responsive focus rail and direct operational links to tasks, projects, and time.
- Use Arabic Jordan date formatting with Latin digits and logical RTL styling.


## AD-02.1 — Compact Shell and My Day Polish

Status: **implemented**

- Reduce presentation-scale headings and spacing on the daily operational surface.
- Prevent action buttons from competing with or colliding with page content.
- Compact the Aqua Tech CS topbar, account identity, sidebar width, company card, and navigation rows.
- Keep the reusable Design System package unchanged by treating this as Aqua Tech CS Product Personality density.
- Preserve mobile drawer accessibility, RTL logical layout, reduced motion, and all My Day business behavior.


## AD-02.2 — Operational Density and Dynamic States

Status: **implemented**

- Derive the My Day status badge from actual task volume and attention signals.
- Reduce the hero, metric cards, empty state, focus rail, and action density for daily operations.
- Localize and shorten account identity presentation in the topbar while preserving the full email as supporting context.
- Compress the Aqua Tech CS sidebar to a 256px product-level density and hide nonessential stack metadata on typical laptop heights.
- Preserve task classification, assignment visibility, permissions, timezone behavior, mobile drawer accessibility, RTL, and reduced motion.

## AD-02.3 — Desktop Topbar Simplification

Status: **implemented**

- Keep the desktop topbar limited to the project name, current page, global language entry, account identity, and logout.
- Display the approved project label exactly as `Aqua tech CS`.
- Remove breadcrumbs, descriptive subtitles, and the duplicated internal-system line from the topbar.
- Route the language control to the existing company language setting until full bilingual page dictionaries are implemented.
- Preserve the mobile navigation trigger, keyboard focus, RTL/LTR-safe layout, and compact operational density.

## AD-02.4 — Product Identity and Sidebar Brand

Status: **implemented**

- Rename every user-facing product reference to `Aqua tech CS`.
- Keep the visible product identity as `Aqua tech CS`; technical identifiers move to `aqua-tech-cs` through the separate ID-01 compatibility migration.
- Replace the generated initials mark with the official Aqua.Tech logo while preserving a theme fallback.
- Reduce the sidebar identity to the official logo and project name only.
- Remove the `Internal OS` badge and internal-environment description from the sidebar.
- Apply the same identity to authentication, metadata, transactional email, reports, and the browser icon.

## AD-02.5 — Dashboard Operations

Status: **implemented**

- Replace the presentation-scale dashboard hero with a compact daily operations summary.
- Remove duplicated product identity, simulated connection state, team count, active sessions, and the oversized quick-start panel.
- Prioritize overdue tasks, today's due work, active projects, and unread notifications.
- Add a role-aware action queue for blockers, unscheduled work, service requests, sales follow-ups, overdue invoices, timesheets, leave requests, and expense approvals.
- Add a focused task list ordered by urgency, due bucket, priority, and open blockers.
- Preserve company timezone handling, Latin digits, activity permissions, RTL/LTR behavior, reduced motion, and safe responsive fallback.

## AD-02.6 — Employee Dashboard Polish

Status: **implemented**

- Keep the dashboard employee-first: overdue work, today's due work, in-progress tasks, and active projects.
- Scope project counts to the employee's memberships and assigned work unless the role can manage company projects.
- Remove the duplicated attention-path badge, notifications shortcut, and notifications metric from the dashboard overview.
- Keep operational approval queues role-aware and display only items with an active count.
- Retain the activity summary as the latest five records only, showing the actor and readable message without raw action codes.
- Remove English panel kickers and reduce summary, metric, empty-state, activity, and responsive mobile density.

## AD-03 — Tasks Adoption

Status: **implemented**

- Rebuild Tasks as an employee-first operational surface using canonical data panels, filters, stacked tables, modals, badges, buttons, alerts, and confirmation dialogs.
- Replace the permanently open task form with a focused create/edit modal and keep the main surface centered on overdue, due-today, in-progress, and blocked work.
- Enforce task visibility on the server across the page, collection API, and detail API using personal, managed-team/project, and company scopes.
- Keep employees isolated to assigned, created, or participated work; let team, department, and project managers see only the people and projects they manage; preserve company-wide visibility for authorized task-management roles.
- Limit assignee, project, client, and automation-source controls to the user’s real scope instead of hiding only the final action.
- Add urgency filters, Latin-digit timezone-aware due dates, progress, blockers, next-step actions, mobile stacked rows, RTL-safe layout, reduced motion, and canonical archive confirmation.

## AD-04 — Projects Adoption

Status: **implemented**

- Rebuild Projects as a compact operational surface using canonical filters, data panels, stacked tables, badges, modals, date fields, alerts, and confirmation dialogs.
- Enforce company, managed-team/project, and personal project visibility in server pages and every project read API.
- Scope task progress, completion, and blocker summaries to the tasks each user may actually see instead of leaking company-wide execution totals.
- Keep project metadata creation and editing with company project-management roles while project leads and project managers retain execution controls for members, phases, and tasks.
- Restrict project-member and task-participant employee selection on both the page and API to the user’s real assignment scope.
- Hide project budgets from roles without finance-read permission and keep operational dates in the company timezone with Latin digits.
- Add responsive project overview and execution pages with logical RTL/LTR layout, reduced motion, accessible empty states, and canonical confirmation flows.

## AD-04.2 — Project Workflow Foundation

Status: **implemented**

- Require an active workflow template when a company project-management role creates a project.
- Resolve the workflow automatically when converting service requests and won sales opportunities, with a safe default fallback.
- Clone a versioned, independent workflow snapshot into operational phases, tasks, dependencies, approval definitions, role expectations, and automation rules.
- Keep the existing phase and task models as the execution engine so workflow-generated and manually adjusted work share one permission model.
- Backfill existing projects with a generic workflow link without replacing their established execution records.
- Synchronize project and workflow status, and write durable creation, start, and completion events for later notification, email, and n8n dispatchers.
- Show the selected workflow and generated counts in project creation, project lists, and the scoped execution view.

## AD-04.4 — Project Modal Viewport Safety

Status: **implemented**

- Keep the project create/edit modal inside the available viewport.
- Scroll only the modal body when the project form is taller than the screen.
- Keep the title, close control, cancel action, and save action visible.
- Preserve the shared modal focus trap, body scroll lock, RTL/LTR layout, mobile sheet behavior, and reduced-motion contract.

## ID-01 — Technical Identity Migration

Status: **implemented**

- Adopt `aqua-tech-cs` as the canonical application package, product-theme ID, DOM product selector, session-cookie prefix, and website-intake header prefix.
- Rename the canonical product theme export to `aquaTechCsTheme`.
- Keep the deprecated `aquaFlowTheme` export and legacy CSS selector temporarily so existing Design System consumers do not break.
- Accept the legacy `aquaflow_session` cookie while issuing only `aqua-tech-cs_session` on new logins, and clear both names on logout.
- Prefer `X-Aqua-Tech-CS-Intake-Secret` while accepting `X-AquaFlow-Intake-Secret` during the integration migration window.
- Preserve the old seed marker when detecting an existing welcome notification so reseeding does not create duplicates.
- Treat the local folder, future repository, deployment project, and integration names as `aqua-tech-cs`; database table names and historical batch records are unchanged.

## PROJ-14 — Governed Contract Amendments

Status: **implemented**

- Create one frozen contract amendment from an administratively and financially approved commercial Change Request.
- Move the amendment through draft, internal review, internal approval, client delivery, and recorded client acceptance or rejection.
- Separate amendment authoring from internal approval, except for the Owner role.
- Require durable references for internal approval, delivery, and client decision, with tenant-scoped locking and Activity evidence.
- Block commercial scope application until the amendment is accepted by the client.
- Keep budget changes, invoice creation, external signatures, and automated delivery outside this batch.

## CRM-02 — Leads Management Adoption

Status: **implemented**

- Add a dedicated Leads qualification surface within the canonical application shell.
- Use the DS-04 filter, data-panel, stacked-table, pagination, modal, alert, badge, and confirmation patterns.
- Keep read and mutation capabilities aligned with server-side sales permissions.
- Support manual Lead intake, ownership, qualification, next actions, source and priority tracking, duplicate review, and conversion to sales opportunities.
- Preserve Service Request synchronization without overwriting the original intake message.
- Keep Latin-digit operational dates, logical RTL/LTR layout, responsive table behavior, accessible confirmations, and reduced-motion coverage through canonical components.

## CRM-03 — Client Accounts and Contacts

Status: **implemented**

- Keep `Company` as the internal Aqua Tech tenant and use `Client` as the external customer account.
- Add tenant-scoped contact master records with one active primary contact per client.
- Preserve current client email and phone compatibility by synchronizing them from the primary contact only.
- Backfill legacy client communication data without deleting or rewriting client, project, invoice, Lead, or opportunity records.
- Create a primary contact for new clients and preserve additional opportunity contacts without replacing an established primary contact.
- Add a scoped client-detail surface for contact creation, editing, primary selection, decision-maker flags, archive, and restore.
- Apply server-side client-read and client-management permissions, audit events, transactions, and accessible confirmation workflows.
- Use canonical DS-04 data panels, detail lists, stacked tables, modals, alerts, badges, and confirmation dialogs.

## DISC-01 — Discovery Intake Foundation

Status: **implemented**

- Start the roadmap's Discovery phase only after the CRM and contact foundation is complete.
- Add one tenant-scoped intake session per Lead with optional opportunity linkage.
- Define shared and service-specific question contracts for websites, software, automation and AI, marketing, and general services.
- Preserve the distinction between customer facts, uploaded evidence, AI inference, internal notes, and approved decisions.
- Calculate completion from trustworthy answer sources only and keep unknown answers as explicit information gaps.
- Materialize requirement gaps with severity, resolution, documented waiver, and reopen behavior.
- Block review readiness while an open gap remains, while allowing a documented exception to remain visible to the human reviewer.
- Add a canonical Discovery list and focused section-based intake editor using DS-04 panels, filters, tables, tabs, form sections, alerts, badges, and accessible modals.
- Enforce server-side discovery read and management roles, tenant scoping, row locks, transactions, and durable activity events.
- Keep the public chatbot, conversation messages, uploads, AI extraction, and versioned discovery report for subsequent batches.

## DISC-02 — Conversational Discovery

Status: **implemented**

- Add a public, resumable customer conversation on top of the structured `DISC-01` question and gap contracts.
- Issue 256-bit opaque access links while storing only their SHA-256 hashes, with expiry, rotation, immediate revocation, no indexing, and no referrer leakage.
- Require contact confirmation and versioned privacy consent before accepting customer answers.
- Ask one contextual question at a time, skip already captured information, save every message in sequence, and preserve explicit unknown answers as review gaps.
- Keep public customer facts isolated from internal notes, AI inferences, approved decisions, and the internal session summary.
- Add a customer-editable answer summary, final confirmation, resumable progress, and a documented staff-escalation path.
- Move confirmed conversations to `READY_FOR_REVIEW` only when no open gap remains; otherwise keep them in `NEEDS_INFO` for human follow-up.
- Add an internal link-management panel with one-time link disclosure, rotation, canonical revocation confirmation, conversation timestamps, message counts, and escalation status.
- Protect public mutations with origin checks, body limits, per-token/IP rate limits, row locks, transactions, tenant ownership inherited from the session, and durable activity events.
- Keep uploads, AI extraction, versioned discovery reports, human report review, pricing, proposals, and automatic channel delivery for subsequent batches.

## DISC-03 — Versioned Discovery Reports and Human Review

Status: **implemented**

- Create one tenant-scoped discovery report per intake session with immutable, numbered AI and human versions.
- Generate evidence-grounded Arabic drafts through the OpenAI Responses API and Structured Outputs without sending contact fields, raw conversation messages, or internal notes.
- Disable provider-side response storage, cap evidence size and hourly generation attempts, validate model output again on the server, and discard stale responses when source evidence changes in flight.
- Preserve manual report authoring when the external AI provider is not configured or available.
- Store the exact evidence snapshot and hash used by each version, flag stale versions, and let authorized users inspect prior version content.
- Require a human revision before review submission; never allow an AI draft to be submitted or approved directly.
- Enforce `DRAFT`, `IN_REVIEW`, `CHANGES_REQUESTED`, and `APPROVED` transitions with tenant scoping, row locks, transactions, and durable activity events.
- Complete Discovery only after explicit human approval, then qualify the Lead and eligible opportunity and set the next action to human scope review and pricing.
- Keep uploads, pricing, the central Proposal Engine, delivery channels, acceptance, contracts, and project creation for later independent batches.

## PRIC-01 — Human Scope and Pricing

Status: **implemented**

- Start pricing only from a completed Discovery session with an explicitly approved human Discovery Report version.
- Create one tenant-scoped pricing workspace with immutable, numbered human versions instead of overwriting commercial history.
- Seed the first draft from the approved report scope while requiring the team to enter quantities, client prices, and internal costs manually.
- Separate `CLIENT` lines and client notes from `INTERNAL` cost lines, item notes, workspace notes, profit, and margin data.
- Support service, deliverable, phase, and optional line kinds with fractional quantities and server-authoritative decimal calculations.
- Keep discount and tax configurable as none, percentage, or fixed amount without assuming a tax rate.
- Calculate client subtotal, discount, net revenue, internal cost, gross profit, margin, tax, and final total; keep tax outside profit and margin.
- Add a central, tenant-scoped pricing queue so Sales and Finance reviewers can find ready, draft, returned, in-review, and approved work without access to raw Discovery content.
- Enforce `DRAFT`, `IN_REVIEW`, `CHANGES_REQUESTED`, and `APPROVED` transitions with tenant scoping, row locks, transactions, and durable activity events.
- Separate authoring from approval: authorized non-owner users cannot approve the pricing version they created, while the system owner may self-approve when no higher approver exists.
- Update the opportunity amount and next Lead action only after approval; do not create, send, accept, or reject a Proposal in this batch.
- Keep the central Proposal Engine, client-safe proposal projection, delivery channels, negotiation, acceptance, contracts, and project creation for later independent batches.

## PROP-01 — Central Proposal Engine

Status: **implemented**

- Start proposal authoring only from an explicitly approved Pricing version and preserve the approved Discovery and Pricing version hashes in every Proposal version.
- Create one tenant-scoped Proposal workspace with immutable, numbered human versions and a durable proposal number.
- Seed client narrative from the approved Discovery Report while requiring humans to decide the duration, payment milestones, review, and approval.
- Derive the commercial snapshot on the server from approved Pricing instead of accepting browser-supplied prices.
- Generate a client-safe projection containing only client sections, safe commercial lines, adjustments, totals, payment milestones, and client notes.
- Exclude internal sections, costs, profit, margin, raw Discovery data, and internal Pricing notes from the client projection and preserve a separate projection hash.
- Add a central Proposal queue plus a focused workspace with canonical DS-04 panels, stacked tables, tabs, forms, alerts, badges, modals, and confirmation patterns.
- Enforce `DRAFT`, `IN_REVIEW`, `CHANGES_REQUESTED`, and `APPROVED` transitions with tenant scoping, row locks, transactions, and durable activity events.
- Require duration, positive client value, and payment milestones totaling exactly 100% before review.
- Separate authoring from approval for non-owner users while preserving the owner exception used by previous human approval gates.
- Block the legacy proposal-creation route for opportunities that entered the managed Discovery and Pricing journey.
- Update the Lead next action only after approval; do not send the Proposal, change the opportunity to sent, record client acceptance, or create a contract or project in this batch.
- Keep delivery channels, negotiation, client acceptance or rejection, contracts, and project creation for PROP-02 and PROJ-01.

## PROP-02 — Secure Proposal Delivery and Client Decisions

Status: **implemented**

- Deliver only the explicitly approved current Proposal version and bind every access record to its immutable version and client projection hash.
- Generate 256-bit opaque public tokens, persist only their SHA-256 hashes, and return raw manual links once during preparation.
- Support direct email through Resend plus explicit prepare-and-confirm flows for secure-link and WhatsApp delivery.
- Revoke prior active links when a newer delivery is confirmed, while preventing revocation of an unrelated prepared link from changing an already sent Proposal.
- Add a client-safe, no-index, no-referrer Proposal page that excludes internal narrative, cost, profit, margin, raw Discovery evidence, and internal Pricing content.
- Require responder identity and authority confirmation for acceptance, requested changes, or rejection; require meaningful notes for changes and rejection.
- Store one immutable response per Proposal version with client hash, timestamp, IP address, user agent, and statement version.
- Track first view, last view, view count, delivery failures, send events, revocations, and client decisions through durable activity records.
- Apply company-timezone expiry, token-and-IP rate limiting, same-origin checks, bounded bodies, row locks, transactions, and tenant scoping.
- Move sent opportunities to Proposal, accepted opportunities to governed negotiation handoff, requested changes back to authoring, and explicit rejection to Lost with a reason.
- Keep client creation, contract creation, workflow creation, project creation, and Won conversion for PROJ-01.

## PROJ-01 — Accepted Proposal Conversion

Status: **implemented**

- Convert only an explicitly accepted central Proposal whose sent version,
  customer response, full content hash, and client projection hash all match.
- Recalculate both Proposal hashes on the server before any conversion
  mutation and preserve the accepted version, hashes, response, and timestamps
  as immutable Project provenance.
- Limit the conversion action to Owner and Admin while preserving broader
  read-only Proposal visibility for Sales, Operations, and Finance.
- Reuse the uniquely linked or identity-matched active Client, create a Client
  only when no match exists, and stop for conflicting, ambiguous, or archived
  Client matches.
- Preserve the Opportunity contact and accepting customer representative as
  Client contacts without silently replacing an established primary contact.
- Create the Project in `PLANNING` and clone an explicitly selected active
  Workflow template in `NOT_STARTED`.
- Clone phases, tasks, dependencies, approvals, and rules without assigning
  employees, setting operational dates, or activating delivery.
- Make conversion transactionally locked and replay-safe with one Project per
  Proposal workspace and customer response.
- Link and close eligible Lead, Service Request, and Opportunity records, update
  the commercial value from the accepted Proposal, and write durable audit
  events.
- Surface the conversion from the Proposal workspace and queue, and preserve
  the accepted-Proposal origin on the Project execution page.
- Keep contracts, payment readiness, administrative readiness overrides,
  scheduling, team assignment, Workflow activation, invoicing, notifications,
  and n8n dispatch for later governed batches.

## PROJ-02 — Project Readiness Gate

Status: **implemented**

- Create one tenant-scoped readiness record for every Project and preserve
  existing active Projects by backfilling their activation state.
- Require accepted-Proposal Projects to document a signed contract and a
  positive required payment amount before delivery may start.
- Derive paid readiness only from posted Payments on Invoices linked to the
  same Project, Company, and currency instead of accepting browser-supplied
  paid totals.
- Separate contract verification, finance configuration, operational
  activation, and Owner/Admin-only documented override permissions.
- Keep contract references and verification actors, payment configuration
  actors, override reasons, activation actors, and timestamps in a durable
  audit chain.
- Recheck readiness under a serializable transaction and row lock, then
  activate the Project and Workflow, schedule the cloned phases and tasks,
  and assign only the explicitly selected Project lead.
- Block server-side execution mutations before activation, including team
  assignment, participant assignment, active phase or task changes, progress,
  and blockers, while preserving planning edits.
- Create manual Projects only in `PLANNING`, and route the first start through
  the readiness gate instead of generic status editing.
- Surface a scoped, responsive readiness card with canonical alerts, badges,
  modals, and confirmations while masking exact payment values from users
  without finance-read permission.
- Keep contract document storage, invoice generation, notification delivery,
  broader staffing, kickoff records, risks, deliverables, change requests,
  and n8n dispatch for later governed batches.

## PROJ-03 — Delivery Baseline and Deliverables

Status: **implemented**

- Create a tenant-scoped deliverable register for every Project output instead
  of leaving accepted scope only inside Proposal narrative or commercial JSON.
- Copy only explicit client-visible `DELIVERABLE` items from the exact accepted
  Proposal version, preserve deterministic source references, and backfill
  existing converted Projects without duplicating records.
- Keep Proposal-derived titles and descriptions immutable while allowing
  Project managers to plan phases, due dates, ordering, and acceptance criteria.
- Support manual operational deliverables without mixing them with accepted
  Proposal provenance.
- Enforce the governed state path from planning through execution, review,
  requested changes, and acceptance, with documented cancellation.
- Require Project activation before execution states, require meaningful notes
  for changes or cancellation, and require an external acceptance reference
  before final acceptance.
- Make accepted and cancelled deliverables terminal in this batch and reserve
  contractual scope changes for a later Change Request workflow.
- Write durable Activity records for creation, updates, transitions, and
  permitted removal while keeping all APIs tenant-scoped and row-locked.
- Surface the register through a canonical Aqua Data Panel with responsive
  modals, badges, alerts, and readiness-aware actions.
- Keep delivery files, public client review links, risks, Change Requests,
  automatic phase progression, notifications, n8n dispatch, milestone invoice
  generation, closure, feedback, and follow-up for later governed batches.

## PROJ-04 — Change Requests and Scope Control

Status: **implemented**

- Protect the PROJ-03 delivery baseline by moving every governed addition,
  modification, or cancellation through a tenant-scoped Change Request.
- Generate annual `CR-YYYY-NNNN` document numbers and record business reason,
  schedule impact, commercial impact state, client-approval requirement, and
  durable review evidence.
- Separate authoring from approval: scoped Project execution managers may
  author and apply, while Owner, Admin, or Operations Manager reviews under a
  four-eyes rule with an explicit Owner exception for small-company operation.
- Store the exact target deliverable update timestamp in every modification or
  cancellation item and reject stale application instead of overwriting newer
  work.
- Apply all approved items under one serializable transaction with request and
  deliverable row locks, deterministic references, result links, and complete
  Activity logging.
- Add `CHANGE_REQUEST` deliverable provenance and keep Proposal-derived and
  Change-Request-derived scope immutable through ordinary deliverable editing.
- Keep contract amendments, automatic budget changes, invoice generation,
  public client approval links, risks, delivery files, notifications, n8n,
  closure, feedback, and follow-up for later governed batches.

## PROJ-05 — Project Risks, Issues, and Decisions

Status: **implemented**

- Add one tenant-scoped Project governance register with database-enforced
  contracts for Risks, Issues, and Decisions.
- Number records with annual `RSK`, `ISS`, and `DEC` company sequences while
  preserving Project and company ownership on every relation.
- Track Risk probability, impact, exposure, owner, response plan, contingency
  plan, trigger, review date, mitigation, closure, and reopening.
- Convert a realized Risk into exactly one linked Issue inside a serializable
  transaction instead of copying or losing its original context.
- Track Issue severity, owner, due date, progress, durable resolution, closure,
  and documented reopening.
- Keep Decisions immutable after recording; changing direction creates a new
  linked Decision and marks the prior record as superseded.
- Require active Project membership for operational owners and reuse existing
  Project execution-management permissions for all mutations.
- Block governance mutation on completed, cancelled, or archived Projects and
  write durable Activity events for every lifecycle action.
- Surface the register through a canonical responsive Aqua Data Panel with
  tabs, cards, modals, semantic states, confirmations, RTL/LTR logic, keyboard
  focus, and reduced-motion coverage.
- Keep automated inference, notifications, n8n, client visibility, delivery
  files, closure, feedback, and follow-up for later governed batches.

## PROJ-06 — Project Closure & Post-Project Review

Status: **implemented**

- Replace direct completion with an evidence-backed closure record and review lifecycle.
- Count incomplete deliverables, active Change Requests, open Risks, unresolved Issues, and incomplete Tasks server-side.
- Require outcome, summary, lessons learned, client handover evidence, and internal archive reference.
- Preserve documented exceptions, approval, completion, archive timestamps, and Activity events.
- Move the Project to `COMPLETED` and `ARCHIVED` only through the governed closure transitions.

## PROJ-07 — Client Feedback & Governed Follow-up

Status: **implemented**

- Record one tenant-scoped post-project feedback record only after governed closure.
- Preserve NPS, satisfaction, customer feedback, internal improvement notes, and testimonial publication consent.
- Automatically flag low scores and explicit follow-up promises as `ACTION_REQUIRED`.
- Require an active Project member, due date, and explicit action for every follow-up.
- Resolve or waive follow-up only with a durable management note, actor, timestamp, locking, and Activity audit.
- Keep public survey delivery, automation, Task generation, publishing, and aggregate dashboards for later batches.

## PROJ-08 — Feedback Action Handoff

Status: **implemented**

- Convert every required feedback follow-up into one owned Project Task inside the existing My Day and Tasks workflow.
- Derive urgent or high priority from the recorded score, and preserve the feedback record as the task source.
- Reuse and update the active linked Task on feedback edits instead of creating duplicates.
- Require completion or cancellation of the linked Task before resolving the feedback record; a documented waiver cancels active work atomically.
- Keep public survey delivery, channel automation, testimonial publishing, and aggregate customer-success dashboards for later batches.

## DS-07 — Viresto Adoption

- Map Viresto tokens to the shared contract.
- Preserve teal/copper product personality.
- Replace duplicated primitives gradually.
- Keep legal-domain UX where it is genuinely domain-specific.

## UI-01 — Project-wide Typography Foundation

Status: **implemented**

- Add one semantic operational type scale for body copy, labels, navigation, headings, and exceptional display text.
- Set Aqua Tech CS body, controls, headings, and shell typography from approved tokens instead of page-level arbitrary sizes.
- Remove the legacy Arial and operating-system color-scheme overrides from the application root.
- Keep the desktop-first compact operational character without reducing essential text below the approved readable scale.
- Preserve Bootstrap behavior, RTL/LTR logic, responsive layout, reduced motion, and all PROJ-20 business behavior.

## UI-02 — Sidebar and Top Bar Polish

Status: **implemented**

- Replace accumulated operational-shell overrides with one governed Aqua Tech CS shell layer.
- Keep a stable 256px desktop Sidebar and align the Top Bar and content gutter to the same layout contract.
- Add one Lucide icon for every navigation destination and give active, hover, focus, and disabled states a consistent visual hierarchy.
- Remove the non-operational technology-stack footer and keep the Sidebar focused on product identity and navigation.
- Replace the generated account initial with a consistent outlined account icon and keep role and email presentation compact and readable.
- Preserve navigation permissions, nested-route activation, responsive drawer behavior, RTL/LTR mirroring, reduced motion, and every business workflow.

## UI-03 — Page Structure and Spacing

Status: **implemented**

- Replace the duplicate page-level product brand box with compact workflow context.
- Standardize optional page actions and metadata within the shared page-header contract.
- Tighten shared form, filter, data-panel, and table spacing for a denser desktop operational rhythm.
- Use semantic typography, spacing, radius, and shadow tokens instead of new page-level literals.
- Preserve existing page-header calls, Bootstrap behavior, RTL/LTR layout, mobile stacking, and all business workflows.

## UI-04 — Buttons, Forms, and Interaction States

Status: **implemented**

- Standardize small, medium, and large button and field heights for compact desktop workflows.
- Align legacy Bootstrap controls with canonical Aqua component styling through one dashboard-scoped compatibility layer.
- Unify hover, active, focus-visible, disabled, readonly, loading, success, and danger feedback.
- Keep action meaning visible without adding page-specific button recipes.
- Preserve existing event handlers, form validation, permissions, RTL/LTR behavior, and reduced motion.

## UI-05 — Cards, Status Badges, and Page States

Status: **implemented**

- Tighten shared card padding, radius, shadow, and loading-skeleton density.
- Standardize semantic badge sizes and status colors across canonical and legacy dashboard markup.
- Replace oversized text-only empty surfaces with a compact dashed operational state treatment.
- Unify loading, empty, error, success, and permission page-state hierarchy.
- Preserve data conditions, status meaning, accessibility announcements, RTL/LTR, and reduced motion.

## UI-06 — Modals, Toasts, and Confirmations

Status: **implemented**

- Tighten modal widths, spacing, backdrop, close control, alerts, and toast feedback.
- Add one backwards-compatible dismissibility contract for modal interactions.
- Block backdrop, Escape, and close-button dismissal while a confirmation action is loading.
- Preserve focus trapping, active-element restoration, scroll lock, accessibility roles, RTL/LTR, and reduced motion.
- Keep the remaining browser-native confirmations visible in the adoption backlog for page-level migration.

## UI-07 — Tables, Tabs, and Pagination Polish

Status: **implemented**

- Tighten canonical table rows, sticky headers, action cells, state rows, and scrollbars.
- Standardize line and pill tab height, padding, focus, active state, and count indicators.
- Standardize pagination controls and result summaries on the compact operational scale.
- Align legacy Bootstrap tables through one dashboard-scoped compatibility layer.
- Preserve captions, URLs, mobile stack/scroll strategies, RTL/LTR, keyboard focus, and reduced motion.

## UI-08 — Dashboard and My Day Final Polish

Status: **implemented**

- Apply the completed shared foundation directly to the employee Dashboard and My Day reference pages.
- Tighten summary, metric, priority, attention, activity, task, blocker, and progress hierarchy.
- Reduce repeated metric action labels to accessible icon actions.
- Keep role-aware data, task classification, dates, links, permissions, RTL/LTR, and reduced motion unchanged.
- Keep this product-specific polish outside the shared Design System release contract.

## UI-09 — CRM and Sales Workspace Polish

Status: **implemented**

- Apply one product-specific workspace rhythm to Clients, client contacts, Leads, Sales Pipeline, and opportunity details.
- Tighten CRM and sales metrics, action rows, forms, pipeline stages, opportunity cards, and closed-opportunity tables.
- Keep canonical CRM pages and legacy Bootstrap sales pages visually aligned without rewriting workflow logic.
- Preserve lead qualification, ownership, follow-up, conversion, permissions, RTL/LTR, and reduced motion.
- Keep this product-specific polish outside the shared Design System release contract.

## UI-10 — Discovery, Pricing, and Proposal Workspace Polish

Status: **implemented**

- Apply one product-specific workspace rhythm to Discovery sessions, intake, reports, pricing, and proposals.
- Tighten action rows, operational metrics, long-form evidence, commercial forms, tables, and review panels.
- Align the authenticated workspaces with the existing public Discovery and Proposal experiences.
- Preserve evidence provenance, versioning, approvals, pricing calculations, delivery, permissions, RTL/LTR, and reduced motion.
- Keep this product-specific polish outside the shared Design System release contract.

## Release gate for every stage

- Lint
- Typecheck
- Unit tests
- Production build
- Keyboard test
- RTL/LTR review
- Mobile review
- Contrast review
- No unapproved hard-coded product colors in shared primitives
## PROJ-09 — Secure Client Feedback Collection

Status: **implemented**

- Issue, rotate, copy, and revoke a finite client feedback link after project closure.
- Store only an opaque token hash and expose a minimal no-index public form.
- Enforce one transactional submission with rate limiting, audit events, and automatic PROJ-08 follow-up handoff for low scores.
- Keep automatic email and WhatsApp delivery outside this batch.

## PROJ-10 — Governed Feedback Invitation Delivery

Status: **implemented**

- Send a freshly rotated 14-day feedback link through the existing transactional email provider.
- Require an explicit verified recipient and preserve attempt, provider, success, and failure evidence.
- Revoke failed-attempt tokens and write durable prepared, sent, and failed Activity events.
- Keep manual copy/revoke as a separate channel; defer WhatsApp, reminders, automatic retries, and n8n dispatch.

## PROJ-11 — Governed Feedback Reminders

Status: **implemented**

- Send a manual audited reminder only for an active delivered feedback request.
- Require 72 hours between successful contacts and stop after three successful reminders.
- Prepare a new server-side token hash while preserving the current active link during provider delivery.
- Rotate to the new 14-day link only after provider acceptance; preserve the previous link on failure.
- Block concurrent reminders and all reminders after feedback receipt.
- Keep automatic scheduling, WhatsApp, retries, and n8n outside this batch.

## PROJ-12 — Scheduled Feedback Reminder Operations

Status: **implemented**

- Add explicit per-project opt-in and stop controls for scheduled feedback reminders.
- Compute eligibility from the last successful contact while preserving the 72-hour cooldown and three-reminder cap.
- Reuse PROJ-11 locking, provider-acceptance token rotation, and active-link preservation.
- Protect a bounded 20-item worker with `CRON_SECRET` and durable Activity events.
- Stop scheduling on feedback receipt, manual recording, link revocation, a new invitation, reminder cap, or provider failure.
- Keep automatic retries, WhatsApp, and n8n outside this batch.

## PROJ-13 — Governed Change Financial Approval

Status: **implemented**

- Require a positive amount and ISO currency for new commercially impacted Change Requests.
- Separate scope review from a tenant-scoped finance decision with four-eyes protection.
- Preserve the finance actor, timestamp, reference, notes, and Activity evidence under a row lock.
- Reset financial approval when the draft changes and block management approval until finance approves.
- Keep Project budgets, invoices, payments, contract amendments, notifications, WhatsApp, and n8n unchanged.

## PROJ-14 — Governed Contract Amendments

Status: **implemented**

- Freeze approved commercial scope, value, currency, and schedule impact in a governed amendment.
- Preserve internal approval, delivery, and client decision evidence with ordered transitions.
- Block commercial Change Request application until the client accepts the amendment.

## PROJ-15 — Apply Accepted Amendment Impact

Status: **implemented**

- Apply the accepted amendment value and schedule delta to the Project through one explicit, audited action.
- Preserve immutable before/after budget and due-date snapshots under row locks.
- Block missing baselines, currency mismatch, and duplicate application.
- Keep invoices, payments, notifications, WhatsApp, and n8n unchanged.

## PROJ-16 — Amendment Invoice Handoff

Status: **implemented**

- Create one finance-owned draft invoice only after the accepted amendment impact is applied.
- Preserve a unique amendment-to-invoice link, actor, timestamp, amount, currency, and Activity evidence.
- Require a Project client and matching operational, Project, and amendment currencies.
- Keep issuance, tax and due-date confirmation, delivery, payments, notifications, WhatsApp, and n8n manual and unchanged.

## PROJ-17 — Govern Amendment Invoice Issuance

Status: **implemented**

- Lock the approved amendment amount, currency, Project, client, and single invoice line against draft edits.
- Require Finance to confirm tax treatment, due date, and an issuance reference before issuing the linked invoice.
- Preserve issuer, timestamp, tax decision, reference, and Activity evidence under invoice and amendment row locks.
- Keep external delivery, payment reminders, online collection, WhatsApp, and n8n outside this batch.

## PROJ-18 — Secure Amendment Invoice Delivery

Status: **implemented**

- Deliver only an issued amendment invoice to an explicit normalized recipient through transactional email.
- Send a client-safe summary without exposing an internal dashboard link or creating an unprotected public route.
- Preserve prepared, sent, and failed provider evidence and block duplicate successful or concurrent delivery.
- Keep PDF attachments, a secure public invoice portal, payment reminders, online collection, WhatsApp, and n8n outside this batch.

## PROJ-19 — Governed Amendment Invoice Document

Status: **implemented**

- Provide an authenticated, tenant-scoped, print-ready document only for a linked issued amendment invoice with complete issuance evidence.
- Render the frozen commercial lines, amendment and issuance references, client, Project, totals, payment summary, notes, and terms through the canonical Aqua system-document pattern.
- Keep the page outside the dashboard shell, no-index, and available for browser print or save as PDF.
- Keep server-generated PDF attachments, a public invoice portal, online collection, payment reminders, WhatsApp, and n8n outside this batch.

## PROJ-20 — Secure Client Invoice Portal

Status: **implemented**

- Issue, rotate, and revoke an opaque 1–30 day client invoice link under Finance authority and tenant-scoped locks.
- Store only its hash and preserve issue, expiry, revocation, first-view, last-view, view-count, and Activity evidence.
- Show a client-safe, no-index, no-referrer invoice document without any internal route or dashboard data.
- Keep automatic link delivery, online collection, payment reminders, WhatsApp, and n8n outside this batch.
