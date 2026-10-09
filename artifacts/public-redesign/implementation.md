# Acadivo public website redesign — 9 October 2026

Implemented in the existing application. CRM dashboards, backend APIs, database schemas, role permissions and authentication logic were preserved.

## Pages

| Route | Implemented composition |
| --- | --- |
| `/` | Warm editorial hero with a real school-admin capture; red product backdrop; connected workflow; alternating teacher/examination showcases, charcoal finance section, role directory and trial CTA. |
| `/features` | School-reporting montage; admissions and teaching showcases; examination section; existing module details and anchors retained. |
| `/pricing` | Asymmetric pricing introduction, warm plan surfaces, distinct Professional tier, existing monthly/annual catalogue amounts, comparison matrix, FAQs and payment process. Pricing card actions remain **Pay Now**. |
| `/about` | Education photograph, product story, numbered principles, actual school insights capture and verified AKTech company details. No invented team/history/statistics. |
| `/contact` | Sand-colored introduction, direct company contact details, real front-desk capture and existing email-draft form with clearer field placeholders. |
| `/demo` | Real portal hero, accessible role tabs and original-resolution screenshot viewer. Teacher capture remains the complete 1272×1432 image. |
| `/login` | Classroom photo split screen, original logo, warm form surface, password visibility, loading/error feedback, recovery link and original role-aware authentication handler. |
| `/free-trial` | Registration beside a numbered submission/review/email explanation. Existing pending-approval confirmation, validation and registration handler preserved. |
| `/forgot-password` | Brand-accented account recovery panel; existing API submission preserved. |
| `/reset-password` | Matching recovery presentation; hash-token lookup and password handler preserved. |
| `/payment` | Selected-plan/payment-review introduction, explicit three-step guide, warm checkout surface and existing quote, UBL copy, registration, proof submission and status components. |

Public navbar, announcement, footer, CTA and website guide presentation were also updated. Announcement **Try Free Now** remains linked to the existing trial route. Guide response timer remains 1600 ms.

## Implementation

- `src/app/marketing.css`: public-only visual system, warm paper/sand/rose surfaces, original brand red, restrained charcoal, small radii, typography, mobile/tablet breakpoints and reduced-motion handling.
- `src/components/Marketing.tsx`: reusable actual-product frames, actions, module stories and workflow diagrams.
- `src/components/ScreenshotCapture.tsx`: actual asset display, native full-resolution dialog and HTML privacy masks on unredacted account headers. Original screenshot pixels and recorded numbers are unchanged. Original files remain existing public assets; masks apply to website previews rather than rewriting those files.
- `src/components/AppChrome.tsx`: only its public return has the `marketing-site` wrapper. Authentication guards and protected portal branch unchanged.
- `src/app/layout.tsx`: imports scoped marketing CSS; root authentication provider unchanged.
- Public page files, Navbar, Footer, CTASection, PricingTable, ProductShowcase, ContactInquiry and WebsiteGuide.

## Images

| Asset | Placement |
| --- | --- |
| `/marketing/classroom.webp` | Login photo panel. Quilia / Unsplash, credited visibly. |
| `/marketing/learning-desk.webp` | About editorial panel. Element5 Digital / Unsplash, credited visibly. |
| `/product-showcase/school-admin.jpg` | Home hero and Demo school-admin tab. |
| `/product-showcase/school-admin-insights.jpg` | Features montage and About product story. |
| `/product-showcase/teacher.jpg` | Home/Features teaching sections. |
| `/product-showcase/teacher-full.jpg` | Complete teacher preview in Demo. |
| `/product-showcase/finance.jpg` | Home finance section and Demo. |
| `/product-showcase/examination.jpg` | Home/Features examination sections and Demo. |
| `/product-showcase/receptionist.jpg` | Admissions showcase, Contact and Demo. |

Two previously licensed local WebP assets were reused. Attribution/source/license records: `public/marketing/ATTRIBUTION.md`. Product assets and original `/logo.png` were not regenerated. Local HTTP delivery confirmed all ten images return 200 with image MIME types and nonempty bytes.

## Verification evidence

- All eleven public routes returned HTTP 200 with the new public wrapper.
- New marketing CSS was present in the CSS actually served by localhost.
- The login response contains the local classroom photo reference.
- Live read-only backend catalogue and all six monthly/annual quotes agree on the expected amount.
- TypeScript: passed.
- Text integrity: passed.
- Website guide regression tests: passed.
- Actual trial form regression test: passed (single submission, exact confirmation, no trial auto-login/redirect, paid callback preserved).
- Subscription payment regression tests: passed, with mocked persistence (quote validation, selected plan/amount, upload restrictions, duplicate prevention, ownership, roles, rejection and approved activation).
- 141 backend/library files compared with before-change hashes: unchanged.
- Existing login submission handler unchanged. Shared FreeTrialForm, SubscriptionPayments, PaymentCheckout and PaymentBankDetails unchanged.
- Final isolated production build: passed; 132 pages generated. See `build.log`. Repository lint warnings remain, including image-element performance recommendations and existing hook dependencies; a successful build is not a visual approval. Temporary build include removed from tsconfig after completion.

## Visual verification — not completed

The supported browser tool and supported native fallback both failed during initialization with:

`trusted Node process exited unexpectedly; kernel reset, rerun your request`

Consequently, **desktop/tablet/mobile rendered appearance, image crops, actual dialog/navigation interaction, console output and browser login/payment clicks have not been visually or interactively verified**. Responsive CSS and HTTP delivery are implemented/checked, but those do not prove visual quality. Existing image files were visually inspected; those inspections are not screenshots of the redesigned rendered pages. No new rendered UI screenshots are claimed.

## Manual visual review

Open `http://localhost:3000/` and hard-refresh with Ctrl+Shift+R. Review every route in the table above at:

- Desktop: 1440×900.
- Tablet: 820×1180.
- Mobile: 390×844 and 360×800.

Check heading wrapping, horizontal overflow, photo crops, screenshot detail and readable form labels. The pricing comparison and payment history tables may scroll horizontally inside their containers.

1. Header **Try Free Now** → `/free-trial`. Submission must show pending confirmation rather than opening a dashboard; regression tests verify this without creating a real school.
2. `/pricing`: switch billing cycles, select **Pay Now**, confirm `plan` and `billingCycle` carry into `/payment`, and compare quote/amount.
3. `/payment`: check copy feedback, upload/replace/remove preview and pending-review messaging. Browser actions and genuine payment submission were not performed in this pass.
4. `/login`: check optional school code, account email, show/hide password, loading/error feedback, forgot-password link and normal existing-account redirect.
5. `/demo`: switch all five tabs and open/close the screenshot viewer with its button and Escape. Confirm the complete teacher image and account-name masks.
6. `/contact`: confirm Prepare email inquiry opens a draft with entered details. It does not send an email automatically.
7. Guide: ask a public company/product question and verify the existing typing delay.

Remaining uncertainty is rendered/interactive visual QA, not hidden behind a compilation claim. Photography and screenshot URLs are confirmed to resolve; exact crops/layouts still require browser review. Email transport configuration was not changed or tested for real delivery.

## Rollback safety

Before-change source snapshots are in `artifacts/public-redesign/before/`, with `.txt` extensions so they are excluded from TypeScript. Restore only this pass’s scoped files if a rollback is requested; do not reset the unrelated existing CRM worktree changes.