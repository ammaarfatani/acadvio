# Acadivo Fee System Recovery Audit

## Scope and worktree

This audit records the state observed on 2026-11-11. The repository has extensive staged/unstaged and untracked work across academic categories, imports, admissions, finance, and unrelated modules. No changes were reset or reverted. The fee services and several supporting services are untracked in Git, so their presence in the working directory must be preserved.

## Status matrix

| Requirement | Status | Evidence and current behavior | Remaining work |
|---|---|---|---|
| Reusable fee structures | Implemented but untested | `fee.model.ts`, school admin service and fee structure UI include named structures and configured components. | Validate branch/session/class eligibility and custom charges end to end. |
| Student fee assignment and concessions | Implemented but untested | Admission form now selects class fee structure and fixed/percentage concession; backend validates school, class, and session. | Verify branches and actual session data integration. |
| Fee assignment history | Partially implemented | History schema preserves old/new structures, concessions, effective date, reason, and actor; generation resolves effective assignment. | Unpaid challan reissue workflow remains missing. |
| Central fee calculation | Implemented but untested | Recurring fixed/percentage, cap/grace, stage, waiver, early cutoff, and partial balance behavior covered by deterministic tests. | Currency service still uses JS numbers rounded to cents; verify financial edge cases in live payment integration. |
| Early payment discount | Implemented but untested | Calculation and challan snapshot fields exist. | Verify cutoff boundary, partial payments, and policy snapshot behavior in parent/finance payment paths. |
| Late fine policies | Partially implemented | Structure and challan schemas support one-time, stages, recurring, disabled; calculation snapshots policy fields. | Resolve recurring branch ordering and percentage recurring support; verify caps, grace-day boundary, stage replacement/accumulation, waiver audit. |
| Student challan generation | Implemented but untested | Finance service resolves per-student structure, prevents duplicate month/session challans, and snapshots data. | Verify category/branch/session filters, missing assignment errors, transaction/idempotency behavior. |
| Class-wide bulk generation | Implemented but untested | Generation resolves per-student history; bulk PDF service now receives stored challans. | Verify endpoint/query workflow against isolated test DB. |
| Three-copy A4 PDF | Implemented but untested | Fictional stress sample renders as one portrait A4 page with three copies; long names, full itemization, and bank details inspected with no overlaps. | Poppler warns about Symbol/ArialUnicode fonts; confirm in other PDF viewers/printers. |
| Challan history and reprinting | Implemented but untested | Challans persist with document snapshots; finance and parent PDF endpoints render saved challans. | Verify saved branding and detail completeness; add/audit revision/reprint history if absent. |
| Payments and receipts | Implemented but untested | Fee payments are ledger records with idempotency keys; submission and finance flows update challan state. | Validate partial payment + discounts/fines, duplicate request handling, reconciliation, and portal consistency. |
| Branding and bank data | Partially implemented | Issued challans now snapshot school/bank details; historical PDF reads snapshot branding. | Verify all official document types and branch settings. |
| Optional photos | Implemented but untested | Photo services and document snapshot hydration exist; certificate/marksheet PDFs modified. | Search all document renderers and test absent photos visually. |
| Class categories | Partially implemented | Category model/management and class/student category fields exist; challan snapshots include category. | Resolve authoritative relationship consistently and verify reports/admission selectors. |
| Universal Excel import | Partially implemented | Templates/import services include fee structures, student concessions, challans and payments with duplicate checks. | Confirm all plan template variants, payment linking, balances, and imported financial snapshot safety. |
| Financial reports | Partially implemented | Dashboard and analytics aggregate challans/payments; finance ledger endpoints exist. | Reconcile original charge, concessions, discounts, fines, payments, opening balances, refunds and branch filtering. |
| Authorization and tenant isolation | Implemented but untested | Routes use existing auth/permission middleware; models use branch scoping; services filter by school. | Run security tests specifically for finance, branch scope, payment verification, imports. |
| Automated tests / PDF visual verification | Missing | Existing `tests/fee-print-math.cjs` covers fee-period utilities and print grouping, not fee calculations/PDF rendering. | Add isolated calculation/PDF tests, run TypeScript and render a fictional PDF for visual inspection. |

## Immediate defects identified

- PDF after-due display previously had a hardcoded PKR 100 fallback; the current working file uses the saved amount without inventing a fine.
- Challan PDF default is portrait with vertical copies, but the existing panel content was designed for an entire page height. It is likely to exceed the one-third-page panel and needs a compact rendering pass plus visual verification.
- `evaluateCurrentPayable` has recurring fine logic after a fixed `amountPayableAfterDueDate` branch, so recurring fines can be treated as a fixed maximum. Policy snapshots currently store daily rate/cap/grace values, but percentage recurrence is not represented.
- Partial-payment fine/discount handling needs careful reconciliation: evaluation starts from remaining balance, while challan totals and prior payments may have already affected the base.
- The schema default for fee structure late fine model is `ONE_TIME`, which can conflict with the requirement that an unconfigured policy means no fine.

## Suggested implementation sequence

1. Fix policy defaults and snapshot shape, including fixed/percentage recurrence and waiver support.
2. Correct centralized payment-date evaluation and add deterministic calculation coverage.
3. Build a compact three-row PDF panel with bounded content and safe overflow; render and inspect sample PDFs.
4. Verify admission assignments, effective date history, duplicate-safe generation and historical reprints.
5. Verify payment/report reconciliation and Excel plan templates.
6. Run TypeScript, targeted tests, PDF rendering and relevant security checks; update this matrix with measured results.

## Verification state (2026-11-11)

- `node tests/fee-calculation.cjs`: PASS, 13 assertions.
- `node tests/fee-print-math.cjs`: PASS, 11 assertions.
- `node tests/render-fee-sample.cjs`: generated fictional PDFs under `artifacts/fee-verification/`.
- Poppler `pdfinfo`: single sample is exactly 1 page, 595.28 × 841.89 pt A4; two-challan batch is exactly 2 pages, same A4 size.
- Poppler raster rendering was visually inspected. Three copies fit with clear labels; stress case long names and all fee lines have no overlap/clipping. Unsupported embedded Symbol/ArialUnicode font warnings remain.
- `npx tsc --noEmit`: fee files were clean after fixes, but project-wide check fails on existing errors in `schoolAdmin.controller.ts`, `finance.service.ts` and `schoolAdmin.service.ts` (inferred Mongoose document unions and authenticated user type). No type errors matched touched fee calculation, fee schema, PDF, admission service/page, student schema, or import files on filtered rerun.
- `tests/web-security.cjs`: PASS, 81 checks.
- `tests/finance-payroll.cjs`: NOT RUN; requires an explicit local `MONGODB_URI` and no local test database was configured.
- `scripts/verify-universal-import.ts` and `scripts/verify-plan-specific-templates.ts`: blocked by ESM extension resolution under direct Node; `npx tsx` then failed with `uv_os_get_passwd returned ENOMEM` before script execution.
- No production data or destructive migration was used.
