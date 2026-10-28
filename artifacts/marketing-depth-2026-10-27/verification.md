# Country currency and public design refinement — 27 October 2026

Implemented:
- Country selector now retains the actual selected country rather than mapping every non-PK/UK/India country to US.
- Current national currencies mapped using Unicode CLDR data; Unicode license included at config/UNICODE-LICENSE.txt. Territories with no national currency retain USD quotes.
- PK/US/GB/IN retain their independently configured prices. Other supported currencies convert the international USD catalogue server-side, using currency-specific decimal precision. Annual total remains ten rounded monthly prices.
- Rates fetched server-side from https://open.er-api.com/v6/latest/USD with 5-second timeout, shared in-flight request, daily cache, retry throttling and maximum 3-day fallback age. No client-provided exchange rate or amount is trusted. A missing/expired rate prevents a local quote, rather than silently switching to dollars.
- Conversion attribution is displayed on pricing and converted quote pages as required by https://www.exchangerate-api.com/docs/free. Complete rate feeds are not exposed by application endpoints or stored in the repository.
- Foreign checkout remains blocked pending verified settlement support. Local currency display does not imply payment support.
- Navbar location picker moved before the login/trial actions; login/trial actions align at the right edge.
- ScreenshotCapture now displays only the image and existing privacy mask. Full-capture text, button and modal removed globally.
- Portal guide: layered genuine insights capture, animated 3D handbook, working role anchors, chapter cards and reduced-motion support.
- Login: contrasting split composition, real product screenshot with perspective depth, matching form surfaces and accessible text contrast.
- Demo: perspective product hero and clearer workspace tabs; existing tab keyboard navigation preserved.
- About: layered stage and refined philosophy/company surfaces.
- Pricing: balanced six-highlight cards, contrasting Professional plan, full comparison below, tighter spacing and readable currency amounts. Actual features remain sourced from existing plan definitions.

Verification so far:
- TypeScript passed before final build. A later concurrent dev/type run encountered generated .next type files being replaced; dev server was stopped and final production build started.
- 222 mocked-feed currency conversion/precision/annual-total/deduplication/unsupported-settlement checks passed.
- 105 regional pricing/contact checks passed.
- 249-country selector/mapping test passed with updated independent country codes.
- Actual backend GET quotes returned 200: AL ALL 2353; DE EUR 25.92; AE AED 106.5; PK PKR 2000; GB GBP 24; IN INR 2499 (Starter monthly, rate date 27 October 2026). Converted values can change with the daily feed.
- Actual browser Albania prices switched to ALL. Guide and login desktop compositions reviewed; no horizontal overflow observed. Full-capture text absent on Guide.
- Remaining final build result and responsive screenshots to be appended after verification.

Sources:
Unicode CLDR: https://github.com/unicode-org/cldr-json
Exchange feed documentation: https://www.exchangerate-api.com/docs/free

Final verification:
- Final production build passed with all 151 routes generated. Existing non-blocking hook-dependency and image-optimization warnings remain.
- 222 currency checks, 105 regional/contact checks, 24 pricing/guidance compatibility checks and the 249-country selector test passed. Existing subscription-payment regression suite also passed.
- Production-built public pages checked at actual CSS widths 1600px and 400px: /, /features, /about, /demo, /guide, /pricing, /contact, /login, /free-trial, /forgot-password, /reset-password, and the payment quote route. No horizontal document overflow or completed-but-broken images reported in these checks. Details: browser-checks.json.
- Saved desktop/mobile screenshots reviewed for primary page compositions; guide additionally reviewed at 800px tablet width. This is a public marketing-site visual/render audit, not a new authenticated-portal business-process audit.
- Pricing captures were retaken after actual price links loaded, rather than treating the loading state as pricing verification.
- Actual country change on /payment from AL to DE updated the URL market and rendered EUR 25.92 for Starter monthly. This remains an informational quote with international settlement disabled.
- Guide role link reached #teacher; demo Teacher workspace tab switched correctly. Guide animation computed as ac-screen-drift. Chapter badges measured 44×44px on tablet. Reduced-motion CSS is implemented; an emulated reduced-motion browser test was not performed.
- Mobile chatbot launcher reduced to an accessible labelled icon to reduce obstruction of form actions.
- Current feed covers 166 currencies. KPW is not covered and fails closed with a local-pricing-unavailable state. Territories without a national currency use USD quotes. No invented exchange rates are supplied.
- No new registrations, school data edits, real payment submissions, deployment, or production email tests performed in this visual pass.
- Initial preferred country restored to Albania after country-switch testing. Browser viewport override reset.
