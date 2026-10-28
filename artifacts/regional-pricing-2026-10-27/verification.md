# Regional pricing and SMTP contact verification — 27 October 2026

- Brand remains Acadivo.
- PKR monthly payable: 2,000 / 4,000 / 8,000. Approved reference prices: 3,350 / 6,700 / 13,350. Displayed savings are 40.3%, 40.3%, 40.07% (rounded to two decimal places), not a false uniform 40%.
- USD: 29 / 59 / 119; GBP: 24 / 49 / 99; INR: 2,499 / 4,999 / 9,999. Independently configured in config/regional-pricing.json; server REGIONAL_PRICING_JSON can override without frontend changes.
- Annual totals are 10 times monthly. Historical payments/subscriptions are not rewritten. New renewal quotes use the current catalogue.
- Only PKR manual UBL payments are enabled. Foreign markets are quotes only, with no foreign registration/payment activation. Enabling foreign settlement requires a verified payment method/provider supporting those currencies.
- Contact form POST /api/public/contact uses existing SMTP sender and CONTACT_INQUIRY_EMAIL if set, otherwise the existing public business inbox hello@aktech.tech. No Google Sheets or additional email provider.
- Server validates input, applies honeypot and 5/hour/IP rate limit, and persists request UUID + payload digest. Concurrent/duplicate delivery is guarded. Failed SMTP sends can be retried. A process failure after SMTP acceptance but before recording SENT requires operator review of SENDING records; do not automatically replay uncertain sends.
- Contact inquiry records contain private visitor details and must remain restricted to backend database operators. No public listing endpoint exists.

Verified so far:
- TypeScript: passed after regional pricing/contact changes; final pass/build pending.
- 105 regional/contact tests passed with fake persistence and SMTP; no real school data used.
- 35 email checks passed against a local SMTP fixture, including rejection.
- 24 marketing compatibility checks passed with updated annual policy.
- Existing real SMTP connection/authentication verified.
- One explicitly labelled TEST contact notification accepted by the configured SMTP provider through the real contact service, using disposable in-memory persistence. Inbox receipt is not independently verified. No school database records created by that test.
- Browser: real PKR monthly values and honest percentage labels observed; US annual totals 290/590/1190 observed; selected quote shows international payment unavailable. Responsive verification and final visual captures pending.

Commands:
node tests/regional-contact.cjs
node tests/email-quality.cjs
node tests/marketing-pricing.cjs
pnpm exec tsc --noEmit
pnpm build

Final verification update:
- Production build passed (151 routes). Existing non-blocking hook dependency / img optimization warnings remain.
- TypeScript passed repeatedly during implementation; final post-test run recorded separately in the session.
- Existing subscription-payment regression suite passed with annual expected totals updated to the approved 10× policy; it covers server-owned amounts, tenant isolation, review/approval, authentication and screenshot checks using mocked persistence.
- Real HTTP/local MongoDB contact test passed concurrent claims, persisted SENT status, validation, changed-payload conflict and replay. Test database was guarded by a random acadivo_contact_test_ prefix and removed afterwards. Production database untouched by these tests.
- Actual desktop contact layout reviewed at 1600px; tablet contact reviewed at 800px; mobile contact/recovery/login reviewed at 400px; narrow pricing reviewed at 320px. No horizontal document overflow observed in those checks. Visible contact images loaded. Password visibility control verified on login.
- Screenshots saved beside this report: contact-desktop.png, contact-mobile.png, pricing-desktop.png, recovery-mobile.png.
- These checks do not constitute a visual approval of every authenticated portal page. The broader all-portal audit is not completed in this pricing/contact pass.
- No new photography or invented product captures added. Existing genuine receptionist capture remains on Contact.
