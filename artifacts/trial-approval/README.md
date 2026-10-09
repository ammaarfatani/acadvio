# Free-trial approval verification

Form design, existing schemas and approved schools are preserved. Trial registration saves School, Admin and Subscription as PENDING_APPROVAL, without trial dates, academic session, tokens, auto-login, redirect or approval email. The form displays the exact requested confirmation text and clears its password.

Pending trial accounts cannot log in, refresh, use stale tokens, reach protected/billing APIs or render a portal. Paid pending administrators retain billing-only access. Applications reuse existing School records and now include owner/admin name/email, school email/phone, selected plan/trial, date and pending status; the list refreshes every 30 seconds.

Manual Super Admin approval atomically starts the existing 14-day TRIAL state, activates pending users, initializes the academic session and records SCHOOL_APPROVED. The existing email sender runs only after commit. Competing/repeated approvals return 409 without another email. Rejection retains existing SUSPENDED school/subscription and DEACTIVATED user states, clears refresh tokens and saves the required reason in SCHOOL_REJECTED audit. No schema migration or new application collection is introduced.

Transactions require Atlas/replica-set MongoDB, already used by bulk imports. Registration failures roll back school/user/subscription together; existing unique indexes prevent concurrent duplicate accounts.

Passed checks:
- tests/trial-approval.cjs: real HTTP/MongoDB in a disposable acadivo_approval_test_ database, with email intercepted. Pending persistence, login/refresh/stale-token denial, application fields/RBAC, concurrent approval, exact duration from approval, approval-only email, rejection/reason, duplicate races, rollback, existing approved login/dashboard and paid checkout access. Existing production records were not modified; no real test emails were sent.
- tests/trial-registration-form.cjs: real component handler, repeat-submit protection, exact confirmation text, cleared password, no trial auto-login/redirect, preserved paid login/callback.
- Existing subscription/payment and trial/branding/analytics regression suites.
- TypeScript; production build with lint checked separately; all changed approval files pass Next core-web-vitals lint. Previously reported unrelated project lint issues remain.

Actual browser inspection confirms the existing form design and approval notice at localhost:3000/free-trial. Screenshot: free-trial-form.jpg. No test school was submitted to production via the browser.
