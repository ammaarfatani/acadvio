# School document templates

## Using the feature

Open School Admin → Settings → Document Templates. Select a category, choose Modern Premium, Classic Academic or Elegant Institutional, adjust the controls, and save. Each of the 16 document categories has its own setting (48 category/family combinations). The optional first-login notice can be skipped to retain defaults. School name/contact/logo remain in the existing school settings; authorized signature/stamp and affiliation fields are optional.

Open the Documents workspace in School Admin, Finance, Examination or Receptionist. Choose a real record and preview it. Archive/issue creates an immutable snapshot with a unique reference and audit event. Reopen an archived record to print it. Browser Print / Save PDF uses A4 portrait/landscape and physical ID-card dimensions. A specific branch must be selected before issuing campus documents.

Student admission/edit forms include optional additional identity, address, previous-school and medical/support fields. Uncollected optional information is not fabricated. Dates are formatted in Asia/Karachi. B-Form and secured student photographs use the existing student media service.

## Categories

Admission application, registration, student information sheet, student ID, report card, academic transcript, character certificate, school leaving certificate, bonafide certificate, transfer certificate, fee receipt, outstanding dues statement, student attendance report, staff ID, teacher experience certificate and general school certificate. General certificates have general, achievement, participation and appreciation purposes; statements must be supplied by an authorized user.

## Architecture and safety

Catalogue/defaults: `src/lib/document-templates.ts`. Renderer: `SchoolDocumentTemplate.tsx` and `src/app/documents.css`. Editor: `DocumentTemplateManager.tsx`. Gallery: `SchoolDocumentGallery.tsx`. Print overlay: `SchoolDocumentPreview.tsx`. Additive API: `/api/school-documents`, implemented by `schoolDocument.routes.ts` and `schoolDocument.service.ts`.

School settings are revision-controlled and audited. Existing authentication, tenant/branch scoping and category permissions apply. Finance can access only fee documents; examination and receptionist categories are separately limited. Issuing requires the corresponding write permission, not merely preview access. Parent downloads use the existing linked-child authorization path.

The new `IssuedSchoolDocument` collection stores immutable issued copies; the existing `SchoolDocument` parent-upload model remains intact. Idempotency protects repeated/concurrent issue requests. Snapshots preserve branding, template choices and data; archived student photographs receive private GridFS copies. Historical fee transactions retain their captured style and values. Existing certificate records retain their own snapshot. No public student image URLs or artificial results/signatures are introduced.

Older records that predate snapshots cannot recover historical information that was never stored. Legacy receipts use fixed default document styling when no captured style exists. The Documents preview/print renderer applies the full configurable layout; older standalone financial pages retain parts of their existing print layout.

## Verification — 15 October 2026

Tests ran against loopback MongoDB on port 27018 with disposable databases and test secrets. The online database and project .env were not changed.

- Document templates: 62 real HTTP/MongoDB checks passed.
- School lifecycle: 86 integration checks passed.
- Production upgrade / financial regression: 87 checks passed.
- Organization/security regression: 229 checks passed following restoration of the original parent-upload model.
- TypeScript: passed after final code changes.
- Production build: successful; existing lint warnings remain (including native img optimization guidance).

Commands from project root:

    node artifacts/production-upgrade/run-local.cjs document-templates.cjs
    node artifacts/production-upgrade/run-local.cjs school-lifecycle.cjs
    node artifacts/production-upgrade/run-local.cjs production-upgrade.cjs
    node artifacts/production-upgrade/run-local.cjs organization-security.cjs
    node node_modules/typescript/bin/tsc --noEmit

Local visual review: isolated practice website on port 3001. Admission preview masthead, structured real fields, formatted dates, declaration and signature footer were reviewed. Classic Academic selection was saved and persisted after reload. At 389px mobile and 768px tablet widths the editor page had no horizontal overflow. Loaded images were verified through rendered DOM. Screenshots are under `artifacts/document-templates/screenshots`; the in-app browser captures visible portions rather than a complete page. This is not exhaustive visual approval of every category and pagination scenario.

## Remaining manual print checks

Native browser print export is not exposed by the supported in-app browser automation. The alternative local HTML/PDF runtime could not load its required Windows libgobject DLL. No generated PDF or PDF-pagination test result is claimed.

On the running website, open a real document → Print / Save PDF. Select A4, enable background graphics and disable browser headers/footers. Check short and multi-page report cards, transcripts, fee statements and attendance reports in portrait and landscape. Confirm repeated table headings, no clipped rows, signature blocks, grayscale readability and the 85.6 × 54mm ID output at 100% scale. Production deployment and real-school visual review have not been performed.
