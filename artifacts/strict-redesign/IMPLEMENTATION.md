> REVERTED: The UI changes documented below were rolled back at the user’s request on 8 October 2026. This is a historical report.

# Acadivo strict UI redesign pass

## Audit findings and corrections
The previous module refinement had not materially rebuilt the login page. Login retained a text-only pale panel; shared modal and launcher styles also retained oversized soft treatment. In addition, presentation classification recognized canonical roles but missed school-scoped `/admin` and `/staff` aliases.

This pass retains the earlier brand palette, licensed photography and 82 existing header compositions while completing those missed areas.

## Implementation
- Rebuilt login with a warm form column, original logo, licensed real classroom photograph, charcoal editorial panel, visible photo credit and school-product context. The mobile layout stacks purpose-built form and image sections; tablet proportions are defined separately.
- Account email, optional school code, password visibility, autofill, recovery, support and trial links remain accessible. Added password placeholder, busy form state and visible keyboard focus styling. No sample credentials or fabricated school statistics.
- Authentication submission logic, role destinations, payment return validation and API calls preserved. Auth preservation hash recorded in auth-preservation.json; the regression test normalizes Windows line endings before comparison.
- Corrected module presentation for school-scoped `/admin` and `/staff` routes. No middleware or permission changes.
- Added useful real-data summaries: matching student records, available classes/session options, teacher records and filter matches, today's actual collection/pending fees/challan count. Summaries wait for loaded data and remain hidden on loading/error states.
- Refined shared dialog surfaces, input treatments, buttons, keyboard focus states, skeleton corners and public guide launcher. The public guide's existing 1600ms typing delay remains unchanged.
- Existing print documents, authentication, backend routes, models, database records and CRUD handlers remain intact. No new dependency or server restart.

## Verification
- TypeScript no-emit passed.
- Production build passed (exit 0), all 132 static pages generated and optimization/build traces completed. Build isolated in `.next-strict-redesign`.
- Focused lint passed without warnings/errors. Pre-existing full-build image and effect dependency warnings remain elsewhere.
- 13 login presentation and unchanged authentication checks passed.
- 33 module composition, real context, scoped aliases, actual zero values and asset checks passed.
- 13 existing chart/UI checks passed.
- Text integrity passed for 27,440 text/string nodes.

## Visual verification limitation
Live authenticated login, browser screenshots, desktop/tablet/mobile layout review and print previews remain unverified. The browser-control tool fails before interaction with `node_repl kernel exited unexpectedly`, caused by `windows sandbox failed: helper_unknown_error: setup refresh had errors`. Static rendering and builds are not substitutes for that visual review. Resume those checks when the browser runtime is working. No screenshots or live layout approval are claimed.

## Photography
Existing verified local WebP assets retained. Classroom photograph by Quilia: https://unsplash.com/photos/students-in-classroom-with-teacher-presenting-zFSo6bnZJTw . License and full asset attribution: public/brand-editorial/ATTRIBUTION.md . Photography is decorative stock imagery, not a claim about a customer school.
