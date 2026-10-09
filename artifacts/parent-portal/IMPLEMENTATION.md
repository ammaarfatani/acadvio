# Acadivo parent, finance and security implementation

Implemented in the existing CRM on 5 October 2026. No deployment or business-record replacement was performed.

## Delivered

- Parent account supports one or multiple linked children; School Admin can create accounts and edit links. A single child is selected directly. The selected child controls profile, attendance/history, subjects/teachers, timetable, published examination results, fee structures, invoices, balances, payment history and report printing. Empty records stay empty.
- Manual bank-transfer submission uses the existing School/Branch bank configuration. School Admin/Finance can enable payment instructions and bank details in their existing settings. An unconfigured branch inherits organization settings; an explicitly disabled branch stays disabled.
- Authenticated parents submit proof, amount and reference against their own child's invoice. Finance/School Admin reviews the private proof and approves or rejects with a reason. Approval atomically updates the existing FeeChallan and FeePayment ledger and receipt. Duplicate/concurrent approval cannot create duplicate payments. Pending submission never marks an invoice paid. Parent payment status refreshes periodically.
- Published parent forms have authenticated downloads, branch scope, optional child/class/section audiences and plan restrictions. Internal/draft/expired forms are excluded. Existing Student document URLs were not made public.
- Existing notices were extended with student/class/section targeting. Parents see linked-child notices, actual fee reminders and payment review updates. Teachers' targeted notices use assigned students. Existing notice read tracking remains.
- Account-menu Change Password works across all portals. Current password validation, bcrypt hashing, confirmation, token-version revocation and re-login are enforced. Forgot/reset password uses the existing mail service and keeps the reset credential out of API responses and HTTP URLs.
- Enterprise branch selection remains. Real database report queries include scoped expenses/category/trends, collections/balances, student/staff breakdowns, attendance and published subject/result performance, with applicable date filters. Existing charts, cards and tables are reused.
- Plan features are checked in navigation/actions and backend APIs, including parent finance/results, document categories and bank settings.

## Existing modules reused/modified

Parent account/link service, School and Branch bank configuration, Finance FeeChallan/FeePayment and receipts, Announcement/notice read state, workspace notifications, organization reports, authentication/JWT middleware, PortalShell/account menu, API client, existing settings and centralized plan features. School remains the organization; its campuses are Branch records. The owner manages authorized branches within that organization, rather than a newly invented cross-organization login system.

## Added modules

- FeeSubmission: private proof and verification request; it does not duplicate the actual payment ledger.
- SchoolDocument: private published forms, since no existing parent-safe published-file store existed.
- `/parent/children/:id/payments`, `/parent/payments/:id/proof`.
- `/finance/payment-requests`, `/:id/proof`, `/:id/review` under that route.
- `/documents` publication/list/status and authenticated `/:id/download`.
- `/auth/change-password`, forgot/reset pages and account modal.
- ParentDocuments, FeeVerification and reusable parent/teacher audience helpers.

## Security and cleanup

Backend validates role, permission, tenant/branch, linked child, invoice ownership, amount, proof and plan. Screenshot/document buffers are excluded from normal query responses, served privately with no-store/nosniff, and type/size checked. Bank settings cannot be changed by unrelated roles or excluded plans. Payment indexes and transactional review enforce idempotency.

Hardcoded JWT fallbacks and seed passwords were removed. Secrets are mandatory server environment values; a blank `.env.example` documents configuration. Local ignored JWT values were rotated without printing them. Refresh-token hashing now covers the entire JWT, accepts legacy hashes during rotation, and uses unique refresh identifiers. Password changes/resets invalidate old access and refresh sessions. Password-reset tokens and raw sensitive error/email logs were removed from responses/logs. Unused imports and theme controls/state/API settings were removed where confirmed obsolete; historical business data was preserved. Temporary Next build directories are ignored and their task-specific TypeScript includes were removed.

The source secret-pattern scan has zero findings (`../organization/security-secret-scan.json`), no tracked real environment files, and no private server-secret imports in frontend source. Pattern scans are not a guarantee of the absence of every possible credential.

## Verification

- `tests/organization-security.cjs`: **203 real MongoDB/HTTP checks passed**, including child separation/link changes, tenant/branch/role/plan rejection, notices, document/proof access, bank inheritance/disable, concurrent payment approval, rejection/resubmission, real analytics and password revocation across nine roles.
- `tests/bulk-import.cjs`: passed real database integration checks, including 1,001 students, teacher login and transaction rollback.
- Trial approval and registration-form regressions passed. Subscription-payment and trial-branding analytics suites passed with their existing mocked persistence.
- TypeScript passed. Production Next build passed. Lint has no errors; existing nonblocking image/hook warnings remain. Git whitespace check passed.
- Tests use separate disposable databases and clean them up; production school records were not test fixtures.
- Browser tools currently report no connected apps/browsers. Final responsive rendering, browser console/network and visual UI checks could not be performed in this session. Prior organization screenshots are not proof of these new Parent screens.

## Required operational configuration

1. Configure and enable the school's actual bank details in School Admin/Finance settings, then publish real parent forms. No payment gateway was found, so the school's manual verification workflow is used.
2. Production requires independent random server JWT secrets. Rotate any previously used default credentials/secrets outside this local workspace. Existing accounts may need to log in again after local secret rotation.
3. SMTP must be configured for real password-reset/notification delivery; tests stub email delivery and do not prove mailbox receipt.
4. Parent payment review requires MongoDB Atlas or a replica set for transactions; it fails closed on standalone MongoDB. Tested with the configured transaction-capable database.
5. Reconnect a browser for the remaining visual/mobile and console/network checks. Deployment was not requested/performed.
