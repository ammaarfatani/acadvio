# Acadivo motion implementation

## Delivered

One lightweight animation system is now shared across the existing application, without a new package dependency. `src/components/Motion.tsx` implements retained overlay presence, route entrance and typing dots; `src/app/motion.css` defines consistent timing, easing and reduced-motion behavior.

- Public routes and all seven portal shells receive a 220ms fade/up entrance. Current content is animated without keeping an old page alive or remounting auth/data providers. Navigation is not delayed for an outgoing-page animation.
- Website guide: 260ms launcher-origin entrance, 200ms closing fade/scale, new-message entrance and staggered typing dots. Existing 1600ms answer delay and guide content remain unchanged. Closing/restoring uses the existing launcher state; conversation history is preserved.
- Authorized workspace assistant: drawer entrance/exit, message entrance and busy typing indicator. Provider and API requests are unchanged.
- Mobile portal navigation, public mobile menu, account/notification popovers and password dialog use retained exits. Closing content becomes aria-hidden/inert and stops receiving input while its pixels fade. Overlay triggers receive focus return handling; existing traps remain.
- Existing student/teacher forms, bulk import/history, finance collection/expenses/structures, salary/payroll, parent reports, marksheets, admissions/requests, sessions, leave review and Super Admin school/application dialogs use the same retained presence boundary.
- Existing feedback toasts slide/fade on appearance and retain their closing fade. Existing five-second timeout behavior is preserved.
- Buttons, links, fields and navigation have 160ms state transitions; appropriate action buttons and panels have restrained hover/press feedback. Alerts, accessible tab panels and tooltips receive finite entrance styling. Existing charts receive a single mounting entrance; data cells are not animated individually.
- Native screenshot dialogs and details accordions get progressive discrete transitions where the browser supports them. Unsupported native widgets retain working native behavior. Operating-system select popups are not replaced with a custom dropdown.
- `prefers-reduced-motion` disables CSS movement and route entrance; presence removes content without an exit delay when that preference is active at close. Print rendering disables animations.

## Verification

- TypeScript passed after integration.
- Next lint passed with existing hook-dependency and image-element warnings (see `lint.log`).
- Existing text-integrity, website-guide and trial-registration suites passed. Trial confirmation, paid checkout callback and guide privacy boundaries are preserved.
- Source/API preservation audit passed: all 141 protected backend/library files unchanged, and API call expressions in changed components match the pre-motion snapshots. No account, role, database, payment or business changes were made.
- Home, Login, Pricing and Demo returned HTTP 200 and delivered the new motion stylesheet; `delivery.json` records these checks. This is delivery verification, not proof of animation quality.
- Isolated production build passed (exit 0), including generation of all 132 pages. See `build.log`. The temporary `.next-motion-verification` TypeScript include was removed after completion.

## Rendered verification limitation

A fresh supported browser inventory attempt failed with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No supported alternate browser tool is exposed. No screenshots or visual interaction results were fabricated.

Rendered desktop/mobile behavior, perceived smoothness, rapid open-close sequences, actual focus return, keyboard navigation, reduced-motion playback, accordion interpolation and console/hydration behavior remain untested in a browser. The browser integration/runtime needs its missing kernel asset path repaired/reinitialized to complete these checks.

Some existing application-specific filters/tabs use their current state/content replacement. They receive shared control/feedback transitions, but there is no blanket animation of every search result or table row, and no fabricated sliding tab indicator. Authentication feedback remains in its existing layout; arbitrary multi-line messages can still change form height. These details need rendered review before further layout-specific refinements.

## Manual verification

Use http://localhost:3000/ and /login at desktop 1440×900, tablet 820×1180 and mobile 390×844. Open/close/reopen the website guide quickly, send a question and check typing/message entry. Navigate Home → Features → Pricing → Demo; verify immediate navigation and a short new-content entrance.

Log in through the existing school route, then inspect all permitted portal roles. Test mobile navigation, account/notifications menus, assistant, student/teacher add and history, imports, fee dialogs, payroll and parent reports. Close by each available control/Escape and verify focus returns correctly. Switch the system/browser reduced-motion preference and repeat. Verify native screenshot dialog and accordion behavior in supported browsers. Check no clipped overlays, lingering click blockers, scroll jumps or repeated table-cell animations.

## Changed files

- `src/app/finance/collection/page.tsx`
- `src/app/finance/expenses/page.tsx`
- `src/app/finance/structures/page.tsx`
- `src/app/layout.tsx`
- `src/app/receptionist/admissions/page.tsx`
- `src/app/receptionist/requests/page.tsx`
- `src/app/school-admin/academics/sessions/page.tsx`
- `src/app/school-admin/examinations/marksheets/page.tsx`
- `src/app/school-admin/students/page.tsx`
- `src/app/school-admin/teachers/leave-requests/page.tsx`
- `src/app/school-admin/teachers/page.tsx`
- `src/app/super-admin/applications/page.tsx`
- `src/app/super-admin/schools/page.tsx`
- `src/app/teacher/my-classes/page.tsx`
- `src/app/teacher/students/page.tsx`
- `src/components/AcadivoAssistant.tsx`
- `src/components/AppChrome.tsx`
- `src/components/FeeVerification.tsx`
- `src/components/Navbar.tsx`
- `src/components/ParentRecords.tsx`
- `src/components/ParentResources.tsx`
- `src/components/PortalShell.tsx`
- `src/components/StaffAdminWorkspace.tsx`
- `src/components/StaffAttendanceWorkspace.tsx`
- `src/components/SubscriptionPayments.tsx`
- `src/components/WebsiteGuide.tsx`
- `src/components/Motion.tsx` (new)
- `src/app/motion.css` (new)

Pre-motion backups are in `artifacts/motion/before/`. Keep changes scoped to these UI files; do not reset the existing dirty repository.
