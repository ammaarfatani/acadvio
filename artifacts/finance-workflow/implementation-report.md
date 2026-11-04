# Finance, Payroll and Fee Reminders — implementation report

Date: 1 November 2026 (Asia/Karachi)

## Scope and data safety

The existing workforce payroll, fee challans/payments, parent profiles, notification collection, school/branch middleware and document infrastructure were extended. No production database was connected to for testing. Existing financial records were not deleted, renumbered or backfilled with invented payments. School names and branding come from the saved school/branch profile, rather than hardcoding the brief's example school name.

## Implemented workflow

### Payroll and Finance
- Existing attendance/payroll calculations remain in use. Existing approval and period-lock rules are retained, including locks after partial payment.
- States are CALCULATED → PENDING (approval) → APPROVED → PARTIALLY_PAID / PAID. Calculating or approving does not create a payment.
- Pre-approval adjustments support additional allowances/bonuses as well as existing other deductions, with a mandatory reason and audit trail.
- School Admins with payroll management access and explicitly authorized Finance users record actual externally made salary payments through a dedicated dialog. Amount, date, method, reference, notes and optional JPG/PNG/WebP proof are validated server-side.
- Salary payment choices: Bank Transfer / Online and Cash. The non-cash option requires a transaction reference. Optional image proof is attached to the payment record.
- SalaryPayment is an append-only cash-disbursement ledger. Saving the payment, updating payroll, persisting the employee notification and writing the audit event occur in one MongoDB transaction.
- Unique request IDs make retries idempotent. Repeated transaction references for the same payroll are rejected even when a new request ID is supplied. Concurrent final payments and overpayments are rejected.
- Finance and School Admin accounts cannot record their own salary payment. Another authorized payer is required. School Admins can pay from Monthly Payroll; they can enable or revoke Finance payment access from Staff & Roles. The permission is stored on a school-specific Finance role, never the shared global role; an Enterprise branch admin cannot change the school-wide setting.
- Proof bytes are private in MongoDB, excluded from ordinary query responses, and downloaded only through an authorized employee/payroll endpoint.
- Salary is removed from ordinary expense entry/filtering. Water is supported as an operational category. Existing historical Salary expense records are preserved and continue to count as legacy accounting.
- Finance dashboard and Finance Reports include new salary disbursements exactly once. Salary transactions appear separately in report exports. Calculated salary liabilities are shown separately from cash actually paid.

### Employee My Salary
- Existing shared My Salary pages show own payroll history, allowances, gross/net amounts, actual paid/remaining amounts, last payment date and clear status badges.
- Received/outstanding totals cover the employee's own payroll records rather than summing only the latest 36 displayed rows.
- The detail/payslip view includes actual payment history and a private proof preview plus download when present.
- A dedicated PDF download produces a real PDF, with school branding, employee details, earnings/deductions, net/paid/outstanding summaries, payment history and authorized signature area. Normal two-payment layout was rendered and checked as one A4 page.
- Existing browser print / Save PDF remains available.

### Parent fees and notifications
- Challan generation persists an immediate parent portal notification. Successful manual collection and approved parent-payment submissions persist payment notifications within their payment transaction.
- Seven-day pre-due reminders, due-day reminders, overdue notices and configurable recurring overdue reminders use actual challan balances.
- If the seven-day run was missed, an upcoming-fee notice catches up before the due date without falsely claiming it is exactly seven days away. Overdue restart recovery sends the current appropriate notice rather than replaying a backlog of obsolete daily messages.
- Existing configured flat late-fine amounts are snapshotted on newly generated challans and applied once when overdue. Previously applied fines are not applied again. Older challans without a saved rate do not receive an invented charge.
- Paid, zero-balance and voided challans stop reminders. Partial payments update balances before subsequent reminders.
- Notifications are persisted in the existing notification model, with read/unread state, a unique deduplication key and the relevant record link.
- Parent notification visibility is restricted to currently linked children. Removing a child link also removes access to that child's stored financial notifications and challan downloads.
- Parent fee summaries include current-month fees, balances, overdue amounts, late charges and next due date. Each invoice offers an authorized PDF preview/download, with browser PDF printing available from Open PDF / Print.
- Existing bank proof submission and Finance verification are preserved; no payment gateway was introduced.

## Models changed

- PayrollRecord: paidAmount, allowance, PARTIALLY_PAID status.
- SalaryPayment (new): payroll/employee links, amount, payment date/method/reference, request ID, normalized reference key, payer, notes and private proof. Unique request/reference indexes.
- TeacherNotification (reused for portal notifications): dedupeKey and optional studentId, with partial unique deduplication index.
- FeeChallan: snapshotted lateFeePolicyAmount and lateFeeAppliedAt.
- School: financeReminderDays (1–90, default 7).
- FinanceJobLease (new): persistent owner/expiry lease for scheduled processing.
- Expense retains legacy Salary values for preservation; new API salary expense entries are rejected.

## APIs added or extended

- POST /api/workforce/payroll/:id/payments
- GET /api/workforce/payroll/:id/payments
- GET /api/workforce/payroll/:id/payments/:paymentId/proof
- GET /api/workforce/payroll/:id/pdf
- GET /api/parent/children/:id/challans/:challanId/pdf
- GET /api/finance/reminder-settings
- PUT /api/finance/reminder-settings (authorized main School Admin)
- Existing payroll ADJUST accepts an optional allowance.
- Existing self summary adds salarySummary; payroll reads accept PARTIALLY_PAID.
- Existing dashboard/report-data include the salary cash ledger. Detailed salary export rows require payroll.view.
- Existing workspace notifications include record links and parent financial read-state support.
- GET/PATCH /api/users/finance-payroll-access (School Admin only; PATCH is organization-owner-only on Enterprise). This updates a school-specific Finance role, reassigns existing Finance accounts, affects future Finance accounts, and writes an audit event.
- Legacy PAY action cannot silently mark a salary paid: clients must use the amount/idempotency-aware payment workflow.

## Scheduler

`startFinanceReminders()` is wired into the normal backend startup in src/server/index.ts. It runs on startup and every minute, independently of browser sessions. MongoDB stores deduplication keys and a renewable lease to coordinate instances and survive restarts. Processing rechecks the current balance inside a transaction. Normal paid/voided status changes therefore take precedence over stale reminder reads.

The reports-audit startup and isolated demo createApp scripts intentionally do not start production background jobs. Tests invoke the real worker with controlled dates. An always-running backend/worker is required for on-time notifications; a sleeping or stopped hosting instance cannot send at the scheduled time. Current overdue/upcoming state is recovered when it resumes.

## Authorization / activation

Finance users must have the explicit payroll.pay permission in addition to their Finance user type. The School Admin can grant or revoke it from Staff & Roles; shared global roles are not changed. Custom cashier roles can remain unable to pay salaries.

Employees can only read their own payments/proofs/PDFs; authorized Payroll viewers can review staff records. Audit salary resources also require payroll.view. Parent endpoints verify the active parent-child relationship. Existing school and branch filters remain applied.

## Verification evidence

See adjacent/top-level artifact logs:
- artifacts/finance-workflow-tests.log — latest isolated HTTP/MongoDB/scheduler test result.
- artifacts/finance-workforce-regression.log — existing workforce regression result (136 checks).
- artifacts/finance-workflow-types.log — source TypeScript result.
- artifacts/finance-workflow-build.log — production build result.
- artifacts/finance-workflow-lint.log — lint result; existing warnings are not claimed to be fixed.
- artifacts/finance-payslip-layout.pdf and .png — isolated PDF layout fixture, inspected as one A4 page.
- artifacts/finance-dashboard-desktop.png — actual rendered local Finance dashboard, using the previously authorized synthetic demo school.

Local-only commands:
```
node artifacts/run-finance-tests.cjs
node artifacts/run-workforce-finance-regression.cjs
node tests/salary-pdf-layout.cjs
```
The integration runners force MongoDB to 127.0.0.1:27018 and use randomly named disposable databases. They refuse an online MongoDB URI and clean up their own test databases.

## Visual verification and limitations

- Actual browser login and Finance dashboard rendering were reviewed. New cards and reminder settings were adjusted after observing unwanted grid stretching.
- The Finance reminder settings dialog and My Salary empty state were inspected in the rendered local app.
- A 400×800 CSS mobile viewport had no page-level horizontal overflow; the reminder dialog fit within 376px. An 800×1000 tablet dashboard also had no page-level horizontal overflow. Temporary viewport overrides were reset.
- Desktop screenshot capture succeeded. Mobile screenshot capture failed; mobile/tablet evidence is DOM geometry, not screenshot-based visual approval.
- A complete populated, end-to-end browser walkthrough of every employee role, the payment dialog and Parent Portal was not completed. Their new API/security/payment/scheduler workflows have isolated integration coverage. Do not treat the module as fully visually signed off across every portal.
- School logo rendering is supported, but the layout fixture had no real school logo/signature. Those assets were not visually approved in this test.
- My Salary initially displays the latest 36 payroll records. View selected month loads the employee’s own older records through the existing authorized payroll API. Aggregate received/outstanding totals cover all records.
- Historical PAID records are preserved without manufacturing new SalaryPayment rows. Historical Salary expenses remain accounted for separately. Ambiguous historic salary/expense duplicates require an explicit reconciliation rather than automatic guessing.
- Saving a salary payment confirms the application's transaction record; it does not verify a bank settlement or transfer funds. No bank, SMS, WhatsApp or email delivery is claimed.
- No production deployment, production scheduler uptime or real-money disbursement was tested.

## Final verification results

| Check | Result |
|---|---|
| Finance/payroll HTTP, MongoDB and controlled scheduler tests | PASS — 103 checks (final run, 2 November 2026) |
| Existing workforce HTTP/MongoDB regression | PASS — 136 checks |
| Existing fee-period/totals/print grouping regression | PASS — 11 checks |
| Final source TypeScript | PASS — exit 0 |
| Production build (.next-finance-workflow) | PASS — exit 0 |
| Full project lint | PASS — exit 0, warnings remain |
| Revised salary PDF layout fixture | Rendered successfully; 1 A4 page |

The Finance suite includes actual fee-structure and challan generation, immediate notification, generation retry deduplication, missed pre-due catch-up, recurring overdue reminders, partial/full fee collection, salary partial/full/concurrent payments, duplicate reference rejection, private proof access, report/dashboard totals and parent PDF authorization. The final run also verifies School Admin disbursement, school-scoped Finance permission grant/revoke, global-role isolation, Enterprise branch-admin restriction, and each employee's own payment history.

## Payroll access completion — 2 November 2026

- Added a School Admin control in Staff & Roles to enable or revoke salary payment access for every existing and future Finance account in that school. It creates or updates a school-specific Finance role, reassigns existing Finance users, and writes an audit entry without editing the shared global Finance role. On Enterprise, only the organization owner can change this cross-branch permission.
- School Admin can record payment from Monthly Payroll when an approved payroll row has an outstanding balance. Finance requires the separately enabled `payroll.pay` permission. Existing and subsequently created Finance accounts inherit the school's Finance role. Both roles are blocked from paying their own payroll.
- Employees can view their own payroll entries, payment history, payslip PDF and a secure download of any attached payment proof. Proof appears as a protected download; it is not automatically embedded into the payslip PDF.
- Salary payment methods are restricted to Bank Transfer / Online or Cash. Bank Transfer / Online requires a transaction reference. Employee portal proof images can be previewed and downloaded through the authorized proof endpoint.
- Verification used disposable local MongoDB databases only. No production school or financial records were edited.

## Currency conversion status — 2 November 2026

- Currency conversion is not implemented yet. The database and finance models still store monetary amounts in PKR, and the currency setting is currently PKR-only/read-only. Finance pages, payroll, challans, statements, receipts, reports and notification text contain PKR-specific presentation.
- The requested safe approach is now defined: the admin supplies an exchange rate; original amounts/currency are retained for audit; historical and future portal amounts use the selected school currency. This requires a coordinated audit ledger, server-side conversion boundaries, and updates across financial forms, reports, PDFs, notifications, and branch settings. No currency selector or partial relabeling was added because it would misstate stored balances.
- Existing salary-payment feature tests and build do not verify any non-PKR currency behavior.

Normal backend deployment entrypoint is `pnpm run backend` (`src/server/index.ts`). Restart/deploy the updated backend and frontend together. Starting only the Next.js frontend does not start the reminder worker. Deployment was not performed by this task.
