# Reports and marksheet repair — implementation and verification

Updated: 21 October 2026 (Asia/Karachi).

## Root causes fixed

- `privateFile` posted JSON export requests without `Content-Type: application/json`. Express could not parse their filters/format selections correctly. It now sends JSON correctly, preserves branch/auth headers on refresh, rejects empty/HTML/JSON success responses and surfaces server validation messages.
- Frontend download handling could report success without checking the returned file. It now checks the blob first, uses dated filenames, attaches/removes the download anchor and delays blob URL revocation. The success message accurately says that a download was requested.
- Annual marksheets assumed a fixed latest Mid + Final cumulative scheme; the selected examination page had a separate exam-only calculation/display path. There is now one authoritative backend calculation used by preview and PDF, with explicit exam-only and annual views.
- Parent/session/class selectors lacked sufficient dependencies. Reports now reset dependent selections and refresh an existing preview after a filter change; result reports resolve academic session/term through their examinations and subject filters apply after subject-row unwinding.
- Stock PDF fonts could not render Urdu. Noto Sans and Noto Sans Arabic are bundled under OFL, with script fallback that retains the original font shaping tables. The Urdu PDF was rendered and visually checked after correcting a failed merged-font attempt.

## Main implementation files

- `src/lib/api.ts`: shared private binary download helper.
- `src/components/SchoolReportCenter.tsx`: dependent filters, asynchronous preview refresh and honest download/error states.
- `src/server/routes/smartReports.routes.ts`: scoped options/export endpoints, exposed download headers, filenames, safe export error logging.
- `src/server/services/smartReports.service.ts`: session catalogue, term/subject filters, reference validation and real scoped aggregation/export selection.
- `src/server/services/reportExport.service.ts`: PDF font registration; existing CSV/XLSX/ZIP paths retained.
- `src/server/models/assessmentPolicy.model.ts`: class/session assessment policy, revision and branch-scoped unique index.
- `src/server/services/assessmentMath.ts`: shared annual calculation and configured grade boundaries.
- `src/server/services/marksheet.service.ts`: authoritative exam/annual data, historical class/session labels, completeness, publication filtering and preview hash.
- `src/server/services/marksheetPdf.service.ts`, `reportFonts.ts`: authentic school branding, paginated subject rows/component panels, summary/signature areas and bilingual fonts.
- `src/server/routes/exam.routes.ts`: marksheet candidates, preview/PDF, assessment-policy GET/PUT.
- `src/server/routes/parent.routes.ts`: linked-child, published-only PDF export.
- `src/components/MarksheetWorkspace.tsx`, `AnnualMarksheet.tsx`: shared workspace/preview/download controls.
- `src/app/school-admin/examinations/marksheets/page.tsx`, `src/app/exam-staff/marksheets/page.tsx`, `src/lib/portal-navigation.ts`, `src/app/documents.css`: route integration, navigation and responsive/print styles.
- `src/server/app.ts`: CORS exposes Content-Disposition, Content-Length and X-Report-Records.
- `public/fonts/`: original Noto fonts, OFL and attribution.

## Assessment policy

The school must save its actual policy for each class/session. No example weights are installed as production policy.

- WEIGHTED: normalize each entered paper to its real maximum, multiply by its saved percentage weight, require total weights of 100%. Do not show a misleading combined raw total.
- CUMULATIVE: sum only the explicitly selected assessments' obtained marks and maxima.
- FINAL_ONLY: exactly one final-term assessment.
- EXAM view: one selected Mid/Final assessment only, labelled EXAM_ONLY.
- Missing, duplicate, stale, withheld and unentered records do not become zero. Exempt entries remain incomplete pending policy review. Recorded absence follows the saved ZERO_FAIL or INCOMPLETE choice.
- Required subjects and configured subject passing thresholds are checked; a missing grade configuration cannot create a complete annual pass. Display/grade/pass comparisons use two-decimal percentage rounding consistently.
- An unchanged preview hash is required when supplied to PDF download; changed marks, grading or policy produce a reload message instead of a different result.
- Existing historical marks are retained. An unconfigured class/session has a clearly labelled legacy cumulative summary requiring policy review before official annual use.

No production migration or data reset was performed. The new policy model requires normal deployment index creation. Existing authentication, tenant/branch scope and role checks remain in place.

## Automated verification

Executed against disposable databases on **127.0.0.1:27018 only**, with email disabled:

- `node tests/assessment-math.cjs`: 25 calculation checks passed.
- `node tests/private-download.cjs`: 22 checks of the actual frontend helper passed, including JSON request headers, binary MIME responses, auth refresh, branch headers, empty files and error responses.
- `node artifacts/production-upgrade/run-local.cjs smart-reports.cjs`: 76 HTTP/MongoDB checks passed: report values, permissions, isolation, CSV/XLSX/PDF/ZIP, nested rows/pagination, bounds and export limits.
- `node artifacts/production-upgrade/run-local.cjs school-lifecycle.cjs`: 107 checks passed, including authorized candidate selection and invalid session rejection. Logs: `integration.log` / `integration-exit.txt`.
- Final TypeScript noEmit completed successfully (exit 0). Logs: `artifacts/repair-types.log` and `types-exit.txt`.
- Targeted Next lint of the four changed client components/helper passed without warnings.
- Final production build passed (exit 0), with 150 generated pages. The final source build result is recorded in `build-exit.txt` (`0` means pass), with `build.log`. Existing unrelated image/hook lint warnings were not suppressed.

## PDF evidence

- `annual-weighted-verification.pdf` / `.png`: generated through authenticated HTTP from disposable saved records; PDF parsed successfully and contains the expected 86.00% weighted result.
- `urdu-marksheet-verification.pdf` / `.png`: generated from saved, explicitly DEMO-labelled local practice records; rendered and visually inspected. Urdu is readable after the font correction.

These are test evidence, not production student results.

## Browser verification and limits

The supported browser was restored after resetting its viewport override. Testing used actual application routes and saved, clearly DEMO-labelled local records. Production data/settings were not changed.

- Session/class/student switching worked. Mid-only showed 80% (200/250), Final-only 90% (225/250), annual legacy summary 85% (425/500). Urdu subject names appeared correctly in the UI.
- The first PDF attempt hit ENOENT because a still-running local backend held a superseded font path. Restarting that backend loaded the corrected font service. After renewing its deliberately ephemeral login, the PDF button completed without a displayed error or new ENOENT error.
- Student directory preview showed two saved local records. XLSX, CSV and PDF button flows reached the explicit valid-file generation/download-request message. Native browser file-save completion was not independently confirmed.
- Both pages were measured at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Root/body widths stayed within the viewport. Marksheet table scrolling remained inside its labelled region. See responsive.json and reports-responsive.json.
- Captures are saved as marksheet-<width>.jpg and reports-<width>.jpg. They were inspected, but the browser screenshot surface crops parts of the emulated viewport, especially desktop sizes. This is not full-page visual approval of every control. The existing practice multi-branch subscription warning remains visible.
- Final browser error-console check was empty. System Print dialog and production school login/data were not fully verified. PDF HTTP bytes, MIME, expected summary and rendered readability were checked separately.

Manual routes after signing in:

- `http://localhost:3000/aptechinternationalinstitute/admin/reports`
- `http://localhost:3000/aptechinternationalinstitute/admin/examinations/marksheets`
- Examination staff: `/<school-slug>/exam-staff/marksheets`

For browser follow-up, use the real existing UI: select session/class/student, check Mid exam-only, Final exam-only and annual policy; download the PDF; compare marks and summary; test reports CSV/XLSX/PDF with the same preview filters; inspect at each required width. Keep table scrolling inside its labelled region. Production assessment policy should be set by the school using its real approved scheme.



