# School reports and intelligence

## Open the feature

After restarting the existing backend with the new code, sign in as a school administrator whose role includes `reports.view` and the relevant module permissions. Advanced Reports must be included in the school's subscription (Professional, Enterprise or the existing trial entitlement).

Use the sidebar:

- **Reports & Data Export**: `/<school-slug>/admin/reports`
- **School Intelligence & Improvement**: `/<school-slug>/admin/intelligence`

For the existing school, the local routes are:

- `http://localhost:3000/aptechinternationalinstitute/admin/reports`
- `http://localhost:3000/aptechinternationalinstitute/admin/intelligence`

The existing Basic reports page remains available. Branch selection uses the existing header, authorization middleware and Mongoose branch scope; report requests cannot supply a tenant or branch override.

## Reports

The server catalogue is the source of truth for accessible reports, columns, supported filters and definitions. Its 23 available definitions include student profiles, guardian/emergency contacts, issued student document references, staff and employment registers, leave, teaching assignments/timetable, classes/sections/subjects, exam schedules, processed published results with separate subject-mark rows, student attendance, real workforce attendance, a separate original teacher-register report, actual fee payments, non-voided invoices/expenses, paid payroll and announcement references.

Choose one or several reports, use a category selection or Select all, expand **Choose columns**, apply a period and optional compatible filters, then preview. Name/ID lookup filters search existing authorized records rather than requiring MongoDB IDs to be typed. Status/method/category values are taken from the actual model enums where available. Department search uses recorded employment departments. A filter unsupported by any selected report is rejected, never silently ignored.

To export one student: choose compatible student sections, select **Student** in Optional filters, search the child by name, choose the matching student, apply the filter and download. The UI uses the dedicated student export endpoint. That endpoint checks the child's school/branch and forces that child's ID on every selected section. Student and guardian profile sections are not excluded because the child was admitted before the selected period; dated attendance, fees, results and issued documents retain their respective date filters.

Preview is 25 rows per report per page. CSV text is quoted and escaped, with formula-leading values neutralized. XLSX uses distinct worksheets, red/bold headers, readable widths, autofilters and totals for summable amount/time/day fields. Totals are ordinary computed values, not user-controlled formulas. PDF uses real school/branch naming, report definitions, period/filter metadata, repeated table headers and page numbering. Wide selections are split into panels of at most four columns rather than shrinking text to an unreadable size. Multiple CSVs or several selected formats are returned in a ZIP.

All downloads are authenticated `private, no-store` responses, generated in memory. Nothing is published in `/public`; there are no reusable public download URLs or temporary export files. Audits record actor, authorized scope, selected reports/filters, format, row count and outcome, not exported rows, credentials or private document content. A consolidated owner export is audited in the main branch with its original all-authorized-branches scope recorded explicitly. Its data queries retain the original authorization context.

### Bounds

- At most 731 calendar days per request.
- At most 5,000 rows per report and 10,000 combined export rows.
- PDF: at most 1,000 combined rows; up to four columns per panel.
- At most 20 MB final output.
- Database aggregation timeout: 10 seconds per report query.
- Each export endpoint: five requests per minute per authenticated user.
- At most 50 presets per user in a branch workspace.

This is a bounded synchronous export system, not a background job queue. Progress identifies the operation in progress; it does not show invented percentages. Narrow dates/filters or split a large selection if a limit is reached. Creating presets and changing action reviews require a specific branch, consistent with the existing write rules. Consolidated read/export remains available to authorized organization owners.

## Definitions and limitations

- Collections sum `FeePayment.amountPKR` by `paidAt`. Billed invoices and unapproved parent payment submissions do not become collections.
- Expense totals use non-voided `Expense` ledger entries by `expenseDate`.
- Outstanding amounts are current balances on the selected non-voided invoice cohort, not reconstructed historical balances. Historical overdue growth is deliberately unavailable.
- Paid payroll uses `PAID` records and frozen net salary less the recorded payroll adjustment. It is a separate ledger. The fee/expense balance does not subtract payroll a second time or claim that salary expense entries have been reconciled to payroll payments.
- Student attendance rate is `(PRESENT + LATE) / marked entries`. LEAVE and ABSENT remain distinct recorded states. Unmarked days/registers are unknown, not absent or present. Expected-register coverage is not currently calculated.
- Staff attendance uses the actual `StaffAttendance` collection. Simulator events are in the separate biometric punch collection and never enter these reports. Legacy teacher-only batches are not merged into the new workforce report; the report definition states this explicitly.
- Academic charts/reports include published, processed results with numeric percentages, excluding pending/stale result records. Subject averages include numeric subject scores. A cross-sectional average is not described as a progress trend. Comparable-term cohort tracking is not implemented here; incompatible examinations are not compared.
- Admissions and status distributions use actual inquiry/current record states. A current LEFT/TRANSFERRED status is not an inferred withdrawal event date. Historical enrollment snapshots, bank reconciliation, audited profit, transport operations, inventory and missing-document checklists are not fabricated.
- Active-student/teacher and unassigned-section KPIs are current snapshots, clearly labelled, rather than historical cohort counts.
- Ongoing-period dated KPIs stop at calculation time. Comparisons use the exact same elapsed duration immediately before the selected period; the API returns the exact instants and the UI labels the period. A zero/missing baseline returns `null` percentage change rather than infinity or a fictional growth rate.

## Improvement reviews and AI

Rule review defaults are configurable per calculation: attendance below 80%, expense increase of at least 20%, open applications older than seven days. Recurring-absence charts show at least three recorded absences. These are practical review defaults, **not official educational standards**. Rules provide evidence, a suggested action, priority, a non-guaranteed expected outcome, measurement and a suggested review date. Saved reviews remain visible even when the current period no longer triggers their rule.

Review states are NEW, IN_PROGRESS, COMPLETED and DISMISSED. Notes/review dates are persisted per school and branch with an audit event. They do not change attendance, marks, fees, payroll or student status.

Optional interpretation reuses the existing server-side provider boundary and the existing `AI_*` / `OPENAI_*` configuration. No new provider/account is required by this implementation. No environment file was changed. Unconfigured/failed/invalid AI leaves deterministic metrics and rules available.

Only computed metric values, fixed rule evidence and quality limitations go to the provider. Student/staff names, contact details, raw attendance rows, uploaded documents, credentials, action notes and school identifiers are not included. Responses must pass a strict JSON schema and cannot introduce numeric tokens absent from the supplied evidence. This limits unsupported numeric claims; it is not a guarantee that AI prose is correct. Human review remains necessary.

The existing provider timeout is 30 seconds. Interpretations are limited to ten requests per 15 minutes per user and cached for five minutes with a key including school, branch, filters and current aggregate evidence. Provider details/secrets are not returned on failure.

## Local verification — no production data

Use the existing isolated MongoDB replica set on `127.0.0.1:27018`, then run:

```powershell
node artifacts/production-upgrade/run-local.cjs smart-reports.cjs
```

The runner overrides the database URI and JWT secrets. The suite refuses any database endpoint outside local port 27018, creates a randomly named disposable test database and checks its name before cleanup. Email delivery is stubbed. It does not seed or modify the normal school database or `.env`.

Coverage includes real HTTP authorization, tenant/branch filtering, module permissions/entitlements, all-report previews, nested child attendance, actual ledger totals, void exclusions, DEMO isolation, pending/stale result exclusion, CSV formula protection, readable XLSX data, valid PDF/ZIP bytes, PDF blank-page regression, presets/actions, AI cache/failure/schema/minimized payloads, pagination, export row limits and rate limits.

Verification artifacts use synthetic test data only:

- `artifacts/smart-reports-tests.log`
- `artifacts/smart-reports/practice-report.pdf`
- `artifacts/smart-reports/practice-report.png` (rendered PDF inspection)
- `artifacts/smart-reports/practice-reports.zip`
- `artifacts/smart-reports-build.log`

## Manual visual checks

Browser automation and its supported computer-use fallback both failed initialization with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No rendered-browser desktop/tablet/mobile approval or screenshots are claimed for these pages.

Once the desktop browser tooling is restored (or manually in your browser), open the routes above and check at 1440px, 768px and 390px:

1. Choose collections, preview real received payments, then download CSV/XLSX/PDF together and open the ZIP.
2. Choose only student-compatible sections, search one child, and confirm the export contains only that child.
3. Save/reload a preset in one branch, switch branch, and confirm other branch records/presets are not leaked.
4. Calculate intelligence; check ledger totals against source reports and read the displayed definitions.
5. Update a review, recalculate a period where the rule does not trigger, and confirm its saved review remains available.
6. Check form wrapping, long names/labels, horizontal table scrolling, chart readability, keyboard focus and download error feedback at each width.

Live configured-provider success, native spreadsheet app appearance and rendered-browser responsiveness remain separate manual verification items. Production migration/deployment was not performed.


## Verification record

- 76 real HTTP/MongoDB feature checks passed (`artifacts/smart-reports-tests.log`, exit 0).
- 87 existing production-upgrade regression checks passed (`artifacts/smart-reports-regression.log`, exit 0).
- Next production build completed with 149 generated pages, exit 0. Existing unrelated image/hook lint warnings remain.
- Final TypeScript check passed after removal of the temporary verification-build include. This includes the final drilldown date correction, which uses the dashboard's evaluated period rather than a requested period extending into the future; that small link-value correction followed the production build.
- The current synthetic PDF was rendered and inspected; one-page output has the school header and Page 1 / 1 footer. ZIP CRC, unique XLSX package entries, all XML parts and applied header styles passed inspection.
- Browser desktop/tablet/mobile layout and live configured-provider success were not verified. No production database or environment configuration was modified by these checks.
