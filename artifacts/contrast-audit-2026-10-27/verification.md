# Public website contrast audit — 27 October 2026

Scope: all 12 linked public routes: home, features, pricing, demo, guide, about, contact, login, free trial, forgot password, reset password and payment quote. Existing authenticated portal workflows were not redesigned in this pass.

Concrete fixes:
- Homepage examination card: white headings/links and pale body text on a white surface replaced by dark text and accessible red links.
- About philosophy cards: dark headings and body text on light cards; visible red icons.
- Professional pricing plan: replaced heavy charcoal with a soft #fff5f5 recommendation surface, dark #222831 text, restrained red border/CTA. Shared by homepage and pricing; annual savings text is a darker green.
- Captions, frame labels, onboarding numbers, guide steps/descriptions, contact labels, payment instructions/progress and registration instructions darkened where necessary.
- Trial/payment approval notice uses an explicit readable paragraph color; existing approval/authentication behavior unchanged.
- Demo tab labels and pricing comparison dashes made readable.
- Chat launcher/header/message gradients now have explicit solid fallback backgrounds. Chat quick actions, labels, date and privacy note darkened.
- Country list currency labels/codes and footnote darkened; placeholders given a readable gray.
- Fixes are scoped to .marketing-site in marketing-contrast.css, imported after the prior marketing styles. No price, account, permission or payment business logic changed.

Verification method:
- Read actual rendered DOM text and computed colors, composite ancestor background colors, calculate luminance ratios. Thresholds: 4.5 for regular text and 3 for large text.
- Scans cover rendered text below the fold as well as the first screen. Save files: before.json, after-desktop.json, after-mobile.json and reusable read-only contrast-dom.js.
- This is a targeted computed-style scan plus visual review, not a formal accessibility certification. Text embedded in screenshots, background image sampling, all possible server-returned states and every possible hover combination are outside this scan.
- Reviewed expanded pricing FAQ, annual billing, open country panel and a chatbot response in addition to default page states.
- Internal public link paths were covered; matching section anchors were found. No missing internal anchor targets detected. External AKTech/mail/phone destinations were preserved, not independently audited.

Progress:
- Desktop recheck found no remaining candidates on the 12 default public route states.
- Mobile scan at 400px found one late-loaded trial notice candidate, which was fixed. Fully loaded trial and payment forms were rechecked with no candidates. Final production/mobile scan pending build completion.
- TypeScript passed during implementation. Final production build is currently running.
- Screenshots: pricing-desktop.png, home-examinations.png, about-beliefs.png.

Final production verification:
- Production build PASS: all 151 routes generated. Existing non-blocking hook-dependency and image-optimization warnings remain.
- Final production-built desktop (1600px) and mobile (400px) scans: all 12 public routes returned zero remaining contrast candidates and no horizontal overflow. Trial and payment forms were explicitly awaited before scanning to include late-rendered approval notices.
- Final JSON files replaced the intermediate findings: after-desktop.json and after-mobile.json.
- Monthly/annual pricing, expanded FAQ, open country list, open chatbot and a completed local guide response were also checked during the interactive verification pass.
- Final pricing recommendation surface is rgb(255,245,245) with rgb(34,40,49) price text, replacing the heavy dark card.
- Final screenshots include pricing-desktop.png and pricing-mobile.png; lower-section proof saved as home-examinations.png and about-beliefs.png.
- Internal link paths and section anchors checked; no missing anchor targets found among the audited public pages.
- Preview restarted at http://127.0.0.1:3000; viewport override reset. No deployment performed.
