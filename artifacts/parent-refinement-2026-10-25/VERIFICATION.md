# Parent portal refinement - 25 October 2026

Implemented in the existing application:
- Dashboard and Academics share ParentWeeklyTimetable: Monday-Saturday column headings, period rows, real subject/teacher/time/room details. Sunday is included when scheduled. Empty cells do not invent classes. Phone view scrolls inside the grid with a fixed period column.
- My Children / Academics profile: separate Subject, Category and Teacher columns; labeled student profile fields and optional initials/photo fallback.
- ParentFinanceRecords: invoice summaries, always-visible itemized charges, invoice status labels, Finance review table, approved transaction/receipt table, applicable class fee schedule. Existing bank-transfer submission and receipt preview callbacks preserved.
- Documents: explicit title/type/filename download labels; expanded marksheet and receipt entries; clearer issued-certificate cards. Existing secure downloads and document renderer retained.
- Profile: account details, real linked children and a clear school-support/contact panel.
- Announcements: refined notice cards; ID card: restrained identity/status panel, approval rules unchanged.

Subscription visibility and authorization:
- Parents, teachers, Finance, examination and reception roles have no subscription menu, expiry banner or direct-route access.
- Starter / Professional: main school administrator only.
- Enterprise: organization owner in organization-wide/main-branch context only. Secondary branch admins and owner viewing a secondary branch are denied.
- The API applies the same policy to subscription overview, school payment history/submission and subscription screenshot access. Super Admin payment verification remains available.
- Actual billing plan is distinct from FREE_TRIAL feature entitlement, preventing trial status from granting Enterprise branch administrators billing access.
- An unavailable secondary-branch workspace shows contact-main-admin guidance instead of looping through inaccessible billing pages.

Verification:
- 30 focused billing/timetable/finance rendering checks PASS.
- 237 real HTTP/MongoDB organization/parent/permission checks PASS on an isolated disposable local database at 127.0.0.1:27018; includes new main/secondary-branch and parent billing API checks. Email delivery stubbed.
- 30 feedback + 8 API freshness + 14 photo checks PASS.
- TypeScript passed after policy changes; final repeat result recorded separately below.
- Real authorized parent account: dashboard weekly grid, child subject table, fees, documents, profile, announcements and ID card loaded. No browser console errors in final check.
- Direct parent /subscription URL redirected to parent dashboard, zero Subscription links present.
- Actual screenshots: weekly-timetable.png, subjects-teachers.png, fees.png, profile.png, announcements.png, id-card.png.
- Phone 390px: fees and academic timetable screenshots reviewed; no page horizontal overflow. Timetable content 1020px scrolls inside 340px region.
- Tablet 768px: documents screenshot reviewed; no page horizontal overflow. Desktop default viewport screenshots 1600x900 reviewed. Temporary viewport override reset.

Limitations:
- This real parent child has no issued invoices or approved payments, so populated invoice/review/receipt presentation was checked with automated rendering fixtures, not by inventing live financial records. No real payment proof was submitted.
- Existing PDF generation/download plumbing retained; populated receipt PDF export was not re-tested in this pass.
- Staff and secondary branch billing rules verified through shared policy and isolated HTTP tests; every staff role was not separately logged into the browser.
- No deployment performed. No real school business records created or changed for these checks.

Review locally:
http://127.0.0.1:3000/aptechinternationalinstitute/parent
http://127.0.0.1:3000/aptechinternationalinstitute/parent/children
http://127.0.0.1:3000/aptechinternationalinstitute/parent/academics
http://127.0.0.1:3000/aptechinternationalinstitute/parent/fees
http://127.0.0.1:3000/aptechinternationalinstitute/parent/documents
http://127.0.0.1:3000/aptechinternationalinstitute/parent/profile

Final TypeScript repeat: PASS (exit 0). Total automated checks: 319.
