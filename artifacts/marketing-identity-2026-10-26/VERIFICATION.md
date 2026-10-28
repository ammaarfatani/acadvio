# Acadivo marketing identity — 26 October 2026

- Public-site design tokens: pearl, ivory, blush, ruby and burgundy. Styles are scoped to `.marketing-site`; protected portal styling and backend behavior were not redesigned.
- Home: central CSS 3D dashboard with genuine school-admin, finance, examination and school-insights captures, separate depth planes, staged entrances, pointer parallax and reduced-motion handling.
- Shared navigation, feature surfaces, pricing, onboarding, CTA and footer use the same material system. About has an editorial introduction, layered captures, connected-record journey, product philosophy and genuine AKTech company details.
- Website companion: custom chevron identity, launcher glow, header/minimize/close controls, message surfaces, quick questions, input/send controls and responsive panel. Existing public answer source, 1.6-second delay, duplicate-submit guard and privacy boundary remain in place.
- Browser testing found that plural “portal guides” incorrectly matched portal login. The existing guidance matcher now handles singular/plural wording; three regression cases were added.
- Actual automated result: 24 pricing/guidance/compatibility checks passed. Live catalogue prices were read and saved in `prices-verified.json`; no subscription records were changed.
- Actual mobile browser evidence: 400 CSS px, no horizontal overflow; four-screen hero composition reviewed. Companion opened, typing state appeared and minimize worked. Its panel fit within the viewport.
- No invented UI, customer statistics or testimonials. No WebGL/animation dependency added. Operating-system reduced-motion preferences are implemented; no physical-device lab or exhaustive accessibility certification is claimed.

Screenshots in this folder are real browser captures. No deployment, commit or push was performed.

## Final production checks

- Production build exited 0; all 151 pages generated. Existing non-blocking image-optimization and React-hook warnings remain in `build.log`.
- Desktop: Home, About, Features, Demo, Pricing, Contact and Guide rendered and their screenshots were visually reviewed. No horizontal overflow or broken loaded images were found in the checked views. An early Contact capture was taken during navigation; it was replaced after confirming the settled layout.
- Mobile: all seven routes checked at 400 CSS px for page overflow. Home, About and companion were visually reviewed; mobile menu opened and the Pricing link navigated and closed the menu.
- Companion production test: opens, accepts a question, shows “Acadivo is typing…” and returns portal guidance with its handbook link; minimize and close work. The stale development-bundle error did not prevent interaction in the fresh production build.
- Central dashboard full-capture dialog opened and closed successfully after the additional depth layers were added.
- Pay Now opened Starter monthly checkout and displayed the backend quote “PKR 2,000 · 1 month · monthly billing”. Top-bar Try Free Now reached `/free-trial`. No registration or payment was submitted.
- Reduced-motion handling was reviewed in code; an operating-system preference toggle and physical mobile-device tests were not performed. No exhaustive accessibility certification or manual review of every below-fold state is claimed.
