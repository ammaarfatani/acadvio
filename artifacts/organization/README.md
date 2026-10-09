# Acadivo organization, notices and plan authorization

Implemented 5 October 2026. Existing School remains the organization; branches use the same database. Existing records are assigned additively to their school's main branch. Migration is idempotent and deletes no business records. Main-branch identity is deterministic. Scope-aware indexes replace only incompatible legacy class/session name uniqueness indexes after replacement indexes exist.

## Delivered behavior

- Theme customization controls/state/configuration removed. The approved default design, school logo, contact details and bank settings remain.
- Database notices support creator, organization/branch, dynamic role audiences, priority, publication/expiry, draft/published/archived status and per-user read tracking. Visibility is enforced on backend reads, including existing dashboard queries.
- Central configuration: Starter includes core school administration, notices and basic reports. Professional adds finance, examinations, departmental staff and advanced reports. Enterprise includes organization reports, branch management/switching and branch administrator management. Free trial uses Professional features. All access still requires role permissions and approved school status.
- Enterprise organization overview, branches and reports are under `/school-admin/organization`. Enterprise owner's home opens the organization overview. Existing earliest eligible School Admin becomes owner; newly created branch admins are explicitly non-owners. Organization management permission is required.
- Owner defaults to All branches. A specific branch must be selected before campus writes. Inactive branches and branch access after downgrade are rejected. Non-owners cannot switch branches through headers or IDs.
- Parent accounts are created and linked to actual branch students transactionally from School Admin Parent accounts. Parent portal exposes only linked children. Teacher history requests enforce assigned students.
- Async request scope enforces organization and branch constraints on relevant model queries, writes, aggregates and foreign references. Quotas remain organization-wide. Background imports restore and revalidate their branch and actor permissions.
- Existing registration approvals, login, subscription payments and bulk import flows retained.

## Verification

- `node tests/organization-security.cjs`: 75 real MongoDB/HTTP checks passed, covering roles, plan restrictions, cross-tenant/branch IDs, references, branch switching, parent links, notice audiences, expiry/drafts, read tracking, migration idempotency, inactive branches and downgrades.
- `node tests/bulk-import.cjs`: passed, including 1,001 students, teacher login/profile/assignments, atomic rollback and worker leases.
- `node tests/trial-approval.cjs` and `node tests/trial-registration-form.cjs`: passed.
- `node tests/subscription-payments.cjs` and `node tests/trial-branding-analytics.cjs`: passed.
- TypeScript and production build passed. Lint has no errors; existing nonblocking image/hook warnings are recorded in `lint-summary.json`.
- Live existing School Admin login and database Notice Board verified in browser. Isolated Enterprise owner dashboard, branch switching, branch directory and administrator form verified. Screenshots are included here.
- Parent backend access tests passed. Parent/mobile final visual checks could not finish because the browser connection disappeared after the session reset; no browser is currently exposed.
- The UI verification database was checked by its exact random name and fixture identity, then removed. No test records were added to the real school database. Temporary servers stopped during session reset. The completed local backend was restarted on port 5000; the existing website was restarted on port 3000.

## Boundaries

There is no existing biometric-device module in this codebase. No fictitious hardware integration or statistics were introduced. The reusable organization/branch model scope can cover such a future module when it exists. A production deployment outside this local workspace has not been performed.
