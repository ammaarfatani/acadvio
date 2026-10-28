# Production upgrade implementation and verification

Updated 13 October 2026. Changes are local and have not been deployed. Existing production data and `.env` were not modified. This report distinguishes implementation from visual approval.

## Implemented

- Shared subscription overview on School Admin, Teacher, Finance, Examination, Receptionist and Parent subscription routes. Catalogue prices and payment history come from the backend; staff do not receive administrator payment history. Dates use Asia/Karachi. Unknown dates stay unknown.
- Backend paid expiry and protected-route restrictions, existing trial approval preserved, admin billing recovery retained. Dismissible 7/3/1/expired notices and expiry-specific atomic reminder claims.
- Independent account activation/deactivation with revision checking, reason, audit and existing Super Admin authorization. Activation cannot approve a pending registration or silently renew a subscription.
- Accessible shared confirmation/reason dialog, logout confirmation, cancellation and duplicate-action safeguards, persistent error toasts. Existing native confirm/prompt calls replaced.
- Transactional payment collection shared by Finance and School Admin, positive two-decimal validation, authoritative balances, retry IDs, historical branding/student/payment snapshots, unique receipt references and paid-history void restrictions. Batch generation preserves existing payments and configured discounts under concurrent requests.
- Shared fee documents and academic document header/print styles. Removed invented bank/student/fee fallback data and invented behavioural grades. School Admin challan and receipt ledgers now open selected-document previews. Exact receipt lookup uses payment ID, preserving earlier partial-payment amount and balance.
- Branded HTML/plain-text emails, inline real logo, safe action URLs, generic delivery failure logs, atomic single-use password reset. Subscription approval email does not falsely claim that independently deactivated accounts have portal access.

Principal components: `SubscriptionOverview.tsx`, `OrganizationAccountControl.tsx`, `ConfirmationHost.tsx`, `SchoolDocuments.tsx`, `FinancialDocumentPreview.tsx`, `AnnualMarksheet.tsx`, `AppChrome.tsx`, `PortalShell.tsx`. Existing models/services/routes were extended rather than replaced. Pre-existing biometric simulator and manual attendance changes were preserved.

## Actual verification

All database integration tests use loopback MongoDB port 27018 with disposable database names. No production URI is used by the local runner.

- Production-upgrade suite: **87 HTTP/MongoDB checks passed**, including expiry, activation/CAS, approval restrictions, payment isolation, historic receipts, admin/finance idempotency, renewal, reset races and reminder deduplication.
- Organization security: **229 checks passed** on the final code.
- Previously executed during this upgrade: workforce 121, biometric 111, lifecycle 47, email 35, workforce math 30 and connector 6 checks; trial approval and subscription-payment regression suites passed. See individual logs in `artifacts/production-upgrade`.
- Final UTF-8/string audit: **27,435 nodes passed**.
- TypeScript and final production build passed (exit code 0). Build/lint warnings remain for existing image optimization and hook dependencies; they are not presented as a warning-free audit. Evidence: `typecheck-final.log`, `build-final.log`, `build-final-exit-code.txt`.
- Email delivery tested against a local SMTP server with synthetic recipients only. Real provider delivery, DNS/sender identity and inbox appearance are not verified.

## Visual verification and limits

Earlier browser inspection used the isolated practice application at `127.0.0.1:3001`, never the production school. Subscription page was inspected at measured CSS widths 1440 and 389 pixels without horizontal document overflow. Saved `billing-desktop.jpg` and `billing-mobile.jpg` show only captured portions, not a complete all-page audit. These captures predate the later practice subscription fixture and final document-preview changes.

Latest browser reconnect failed twice with: `failed to write kernel assets: The system cannot find the path specified (os error 3)`. Consequently the new print previews, all other portal pages, tablet layouts and full print output are **not visually approved**. No new screenshots were fabricated.

Real local records were rendered through the actual React document components to `artifacts/production-upgrade/documents/challan.html`, `receipt.html` and `report-card.html`. These are HTML proofs, not verified PDFs. The isolated HTML-to-PDF dependency installed, but import fails because Windows cannot load `libgobject-2.0-0` (error 0x7e). No PDF was generated or claimed as tested. The application retains browser Print / Save PDF; a browser print check remains necessary.

## Manual inspection on isolated practice school

Keep local MongoDB 27018 and practice backend 5001/website 3001 running using the existing biometric helper scripts. Only use practice accounts for these checks.

1. Open `http://127.0.0.1:3001/biometric-practice/admin/subscription`; check authoritative dates, catalogue plans and actual history.
2. Open `/biometric-practice/admin/finance/challans`; select one row's print action. Check the selected challan, school branding and fee breakdown. Choose Print / Save PDF. The ledger and navigation should be absent from the print preview.
3. Open `/biometric-practice/admin/finance/receipts`; select a receipt and check its amount, reference and historic balance. Close with Escape and confirm keyboard focus returns to the trigger.
4. Open `/biometric-practice/admin/examinations/report-cards`; choose the DEMO exam/student and check actual subject marks, total and print pagination.
5. Inspect at desktop, tablet and mobile sizes, including long names, empty states, image loading and modal keyboard navigation. These checks are still pending, not implied by compilation.

## Deployment/configuration requirements

- Financial transactions and Super Admin account changes require MongoDB replica-set support. The application refuses unsafe standalone financial fallback rather than partly updating balances.
- Configure verified `FROM_EMAIL`, SMTP credentials and public HTTPS `FRONTEND_URL` on the server. Do not put secrets in the frontend. Only enable `SUBSCRIPTION_REMINDERS_ENABLED=true` after these are verified. Local tests do not validate external delivery.
- Existing records receive additive fields/defaults; older documents without captured snapshots are labelled as legacy/current-profile fallback. Their historic branding cannot be recovered retroactively.
- Review indexes and backup procedures before production deployment. No deployment, database reset or hardware-connectivity verification was performed.

The code and regression improvements are implemented. Complete application-wide visual approval, tablet QA, PDF pagination and external email verification remain open.
