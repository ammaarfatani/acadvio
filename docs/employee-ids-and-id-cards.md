# Permanent employee/student identity and ID cards

## Where to use it

School Admin → ID Card Management: choose student/staff, search by name, permanent ID, class, section or role, and select the branch through the existing branch selector. Open View ID Card to review the actual saved profile, front and back. Approve & issue requires confirmation. Return for correction and Revoke require reasons. Photograph upload/replacement is available for staff in this review panel; student photographs remain in the existing student admission/edit form.

Teacher, Finance, Examination and Receptionist → My ID Card. School Admin also has My ID Card. Parent → Child ID Card follows the existing linked-child selector, including multiple children. This application has no separate student-login portal; no parallel student authentication was introduced.

Issued cards support authenticated PDF downloads and Print / Open PDF. The PDF has two pages, front/back, each 85.6 × 54 mm. Print at 100% / actual size, not Fit to page. Admins may select up to 16 issued cards for A4 front-only sheets (eight cards per page). Automated duplex sheet alignment and physical printer calibration are not provided.

QR codes contain only `ACADIVO-CARD:` plus a random opaque card reference. They contain no password, session token, internal database ID or personal information. Scan the code and paste the reference into the administrator verification form. Verification requires a signed-in, authorized school administrator; this is deliberately not a public personal-record lookup.

## IDs and migration

New staff get school-wide sequential IDs such as EMPD001, including school administrators created through organization management. Parent accounts are not employees. Student creation generates permanent STUD001-style IDs and reserved admission references. Existing student IDs are preserved. Existing imported identifiers are retained where supported by the import flow. IDs do not change on profile edits/reissue.

`permanentidentities` has unique school/kind/value and school/kind/subject indexes. `identitysequences` uses atomic MongoDB counters; roll numbers are separately reserved per school/class/section/session using the same counter collection. Reservations are outside business-record transactions: gaps after a rollback are expected, and reserved IDs are never reassigned. IDs deleted before this registry existed cannot be recovered from unavailable history.

Staff identity remains the existing User; StaffEmployment and TeacherProfile retain compatible copies. Existing real employment/profile IDs take precedence during backfill. Historical internal User IDs used as placeholder employee codes are replaced with safe printable IDs. Conflicting legacy employee IDs or duplicate student IDs stop backfill for review rather than renumbering records silently.

Migration script: `scripts/backfill-permanent-identities.cjs`. It does not load project .env. Supply MIGRATION_MONGODB_URI and MIGRATION_SCHOOL_ID explicitly. Run without flags for a read-only preflight; use --apply only after reviewing conflicts and backing up the intended database. It preserves real existing IDs and records permanent reservations. Production migration has not been run. Opening ID Card Management also safely fills missing employee IDs for authorized existing records.

## Workflow and storage

IdentityCard stores PENDING_APPROVAL, ISSUED, NEEDS_CORRECTION or REVOKED, with a revision, issuance version, reference, source fingerprint and frozen snapshot. Important review/reissue/revocation transitions are audited. New people receive pending records. Legacy people without a card display pending until first review.

The existing IssuedSchoolDocument archive stores immutable issuance snapshots; the new workflow is not a second certificate or attendance system. Staff photos are decoded, bounded and normalized with the existing Sharp photo validator, stored privately on User (excluded by default). Student photos reuse existing private GridFS access. Card snapshots include the authorized normalized photo so a later photo replacement does not rewrite history.

Current profile, photograph, relevant employment details, school branding and card-template settings are fingerprinted. A mismatch blocks downloading an earlier issued card, shows Needs correction, and requires reviewing a fresh preview before reissue. The permanent identity remains the same. Reissued versions receive a fresh QR reference; older references no longer verify as current. Card approval uses optimistic revision checks and MongoDB transactions. The generic school-document issue endpoint refuses ID cards, so it cannot bypass administrator approval.

## APIs

All routes are under `/api/id-cards`, require the existing authentication/tenant middleware, return no-store responses and enforce school/branch scope.

- GET `/`: authorized administrator directory, 25 records per page. Status filtering performs live validation and requires narrowing searches exceeding 500 candidates.
- GET `/self`: own staff status/card.
- GET `/:kind/:id`: authorized metadata, plus a preview fingerprint for administrators.
- POST `/:kind/:id/review`: issue, correction or revoke with expected revision; issue requires the fingerprint from the reviewed preview.
- PUT `/staff/:id/photo`: authorized administrator photo update/removal, JPG/PNG/WebP up to 5 MB, decoded pixel limits.
- GET `/:kind/:id/front.svg`, `back.svg`, `card.pdf`: authorized issued outputs; administrators may explicitly preview unissued SVGs with preview=1 and a watermark.
- POST `/sheet`: administrator-only printable sheet of issued cards.
- GET `/verify/:reference`: administrator-only current-validity result without private profile data.

Parents must pass the existing linked-child ownership check. Staff cannot select another employee. Only SCHOOL_ADMIN with users.manage can approve, issue, revoke, verify or upload staff photos. A parent cannot obtain another student's card by changing a URL.

## Main changed files

New: permanentIdentity.service.ts, identityCard.service.ts, identityCardRender.service.ts, identityCard.routes.ts, identityCard.model.ts, IdentityCards.tsx, portal id-cards pages, migration script and tests/identity-cards.cjs.

Updated: User/Student schemas, staff/teacher/student creation and editing, employment saving, bulk import, portal navigation, private-file download helper and school-document archive integration. Dependencies: official npm pdfkit and qrcode. Existing manual/biometric attendance, payroll calculations and authentication remain in their original services.

## Verification

Only loopback MongoDB port 27018 and disposable test databases are used. Run `node artifacts/production-upgrade/run-local.cjs identity-cards.cjs`. The test runner refuses online MongoDB. Logs and synthetic PDF/PNG examples are in artifacts/id-cards and artifacts/document-templates/id-card-*.log.

Actual PDF pages were read with pypdf, dimensions checked and rendered using pypdfium2. Synthetic student/staff front/back and A4 sheets were visually reviewed. Physical printer output, duplex alignment, every real school's branding and every possible script/font combination have not been verified. Some test runs emit a local Fontconfig cache warning; PDF pages rendered successfully.

### Recorded results

- Identity cards: 101 real HTTP/MongoDB checks passed, including all supported employee roles, concurrent staff/student creation, simultaneous approval, ownership isolation, photo validation, immutable IDs, legacy ID preservation, PDF bytes, QR verification, correction and revocation.
- Existing school lifecycle: 86 checks passed.
- Existing organization/security: 229 checks passed.
- Existing production/financial regression: 87 checks passed.
- Existing document templates: 62 checks passed.
- Full 1,001-student/teacher bulk-import regression passed, including duplicates, rollback, access control, capacity and interrupted-worker recovery. The employee-ID duplicate fixture now uses the generated ID rather than an obsolete manually supplied code.
- TypeScript and final production build passed (exit 0); lint warnings remain, including native img optimization guidance.
- Browser: local admin pending preview, confirmation/issuance controls, issued front/back images and actual Download PDF verified. The downloaded two-page PDF was independently checked for physical dimensions.
- Migration dry-run on the isolated practice school found five staff, one student and no legacy identity conflicts; no migration --apply was run.

Local database/test helpers were restarted on loopback only. No production migration, deployment, commit or push was performed.

Responsive DOM checks at 389px, 768px and 1440px found no page-level horizontal overflow. The directory table scrolls within its own container on small screens. Front/back images loaded. The desktop screenshot API failed to capture one viewport, so no complete desktop screenshot is claimed.
School logos are normalized into issued snapshots from uploaded inline PNG/JPEG/WebP or contained local public assets (including legacy /logo.png). Remote URLs are not fetched server-side; upload a legacy remote-only logo through School Settings.

The generic document-library ID-card previews are explicitly watermarked as not issued. They cannot be archived/issued through the old generic endpoint; final cards come only from the approval workflow. Permanent Student ID is also shown in the student directory/history and document detail rows.

Owner-authorized branch-administrator transfers move the card record to the new campus, preserve the permanent Employee ID, require correction/reissue and add an audit event. Old-campus access remains blocked.

Final verification on 16 October 2026: production build completed successfully (148 generated pages, exit 0), with lint warnings but no build errors. Final feature checks also cover branch-administrator transfer and preserving the existing rejection of parent accounts as payroll employees. Production database/.env were not modified.
