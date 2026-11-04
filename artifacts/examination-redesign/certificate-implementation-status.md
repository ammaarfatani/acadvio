# Certificates implementation and verification — 31 October 2026

## Implemented
- Existing issuance and issue-date behavior retained; new individual requests support idempotency, and existing bulk request idempotency remains intact.
- Replacement issuance creates a new record, links it to the original, and appends lifecycle/audit history. Originals are not deleted or overwritten. The original remains valid until explicitly revoked.
- Revocation requires a reason and preserves the certificate and history. Revoked documents are visibly marked in preview and are refused by normal print/PDF/bulk-print endpoints.
- New certificates receive unpredictable verification IDs and QR images. The public rate-limited verification API returns certificate number, type, date and current status; it does not return student names, contacts or IDs. Historical certificates without a verification ID are not silently backfilled.
- Server-side literal search, type/class/date/status filters and 25-record pagination. The directory response omits private snapshot contacts.
- Actual PDF download from saved certificate data. Logos/signatures/stamps use the existing safe image normalization; unsupported configured images produce an actionable error rather than being silently omitted.
- RESULT issuance requires an examination and a complete, published, current processed result. Saved subject scores, totals, percentage, grade and status are used. Incomplete historical RESULT snapshots require reissuance.
- Certificates UI connects directory filters, individual/selected/class issuance, section/student selection, details/history, replacement/revocation, PDF download and class printing. Replacement dialog includes date, optional updated conduct and examination selection.
- School/branch scoping and existing results.view/results.publish permissions retained. No Classes, Sections or Teacher Assignment functionality was changed for this task.

## Actual verification
- `certificate-complete-tests.log`: PASS 78 HTTP/MongoDB checks using a disposable local database on 127.0.0.1:27018. Includes individual and selected/whole-class bulk issuance, idempotency, selected dates, replacement, revocation, QR status/privacy, tenant/role denial, published RESULT snapshot/PDF, pagination without overlap, literal-regex search and revoked print/PDF refusal.
- `certificate-release-build.log`: production build exit 0. Public verification page generated. Build preceded the last small correction-dialog and directory callback changes; those final UI changes passed source TypeScript and focused lint separately.
- `certificate-final-ui-types.log`: final source TypeScript exit 0.
- `certificate-lint-latest.log`: focused lint exit 0. Full build lint has existing project warnings; no claim of a warning-free repository.
- Actual PDF API output saved as `fixture-certificate.pdf`; Poppler reports one A4 page. Rendered `fixture-certificate.png` was inspected. This fixture did not have school signature/stamp/logo assets, so their visual rendering is not verified.
- Browser: isolated local launch-demo school on port 3005 only. Issued a Bonafide for synthetic Ali Ahmed; record appeared in the directory. Details/history and saved snapshot preview loaded, including the QR image. Download PDF saved `CERT-BON-2026-146EE27FA39045B1B597.pdf` in the local Downloads folder.
- Rendered DOM geometry: 1600x1000 desktop, 800x1000 tablet and 400x800 mobile had no page-level horizontal overflow. Wide directory tables scroll inside their container. Mobile issuance dialog width 376 at viewport 400; tablet replacement dialog width 672 at viewport 800. Mobile image check found zero broken images.
- Browser screenshot capture failed; no screenshot-based visual approval is claimed. Tablet/mobile checks were DOM geometry and accessible-content checks, not photographic visual inspection. Temporary viewport override was reset.
- Production database and .env were not changed. Local synthetic browser issuance created one demo certificate; disposable automated-test databases are cleaned up by the test workflow.

## Remaining limitations — module is not fully complete
1. Dedicated PDF uses PDFKit; the existing browser preview uses SchoolDocumentTemplate HTML/CSS. Content is shared, but exact font/layout/template-family parity is NOT implemented. Achieving it requires a shared print renderer or a supported server-side HTML-to-PDF runtime and deployment dependency. The current PDF must not be described as pixel-identical to preview.
2. Pre-issuance preview is not implemented: issuance has confirmation, then the saved document is available for preview. No draft is misrepresented as an issued certificate.
3. Existing historical certificate numbers are not migrated. New protected numbers have a partial unique index; full historical uniqueness needs a separate duplicate audit/migration.
4. Existing legacy individual API callers may omit an idempotency key for compatibility; the updated UI supplies one.
5. Physical QR scanning, remote production deployment, real school asset PDF rendering, and exhaustive browser testing of every certificate type were not performed. HTTP tests cover the supported types and lifecycle operations.

## Local review
Use the authorized local demo login and open:
`http://127.0.0.1:3005/acadivo-launch-demo/exam-staff/certificates`
Only use local synthetic records for further lifecycle testing. Set the deployed FRONTEND_URL correctly so newly generated QR URLs point to the public application.
