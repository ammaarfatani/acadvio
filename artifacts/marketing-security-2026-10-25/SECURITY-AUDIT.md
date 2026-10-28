# Acadivo marketing and security review

Completed 26 October 2026. This is a code and regression-test review, not a guarantee against every attack or an independent penetration test.

## Implemented

- Marketing pages: Home, Pricing, Features, Demo, About and Contact now explain included portal guides and onboarding guidance. Navbar/footer link the new `/guide` handbook. Six real role workflows are documented; permissions and school approval remain required.
- Final monthly catalogue prices: Starter PKR 2,000, Professional PKR 4,000, Enterprise PKR 8,000. Annual billing has a real 20% saving: PKR 19,200 / 38,400 / 76,800 per year. No fabricated reference prices or countdowns.
- Only the requested Plan catalogue prices were updated in the configured database. Historical payments, invoices and existing subscriptions were not rewritten. Before/after amounts are saved beside this report.
- Patched vulnerable dependencies, including Next.js, image processing, validation, mail and CSS tooling. Final saved dependency audit reports zero advisories. This does not prove the absence of undiscovered vulnerabilities.
- Added failed-login and recovery throttling, strict production CORS, bounded trusted-proxy configuration, restricted JWT verification algorithms, generic API errors and browser security headers.
- Password, refresh and reset/verification secret fields are excluded by default in the User model and stripped from document serialization. Authentication explicitly selects only the private fields it needs.
- Added repeatable `pnpm security:check` scanning source, public assets and compiled browser JavaScript. It reports file/category names without printing matched secrets.

## Actual verification

- Final production build: passed, exit code 0, all 151 pages generated. Non-blocking image-optimization and React-hook lint warnings remain in the saved build log.
- TypeScript: passed after the User-model changes.
- Web/authentication security: 69 checks passed; no database used.
- Organization security: 239 checks passed against a disposable local MongoDB database on port 27018. Includes real login, tenant/branch isolation, parent linkage and plan/role gates.
- Marketing pricing: 21 checks passed.
- Subscription payments: mocked-persistence suite passed, including server-owned amount, tenant authorization, uploads, duplicates, rejection and approval.
- Earlier in this implementation: workforce 136, school lifecycle 114, document templates 108, private downloads 22, parent presentation 30 and connector durability 6 checks passed; marksheet PDF smoke checks passed. These suites were not all repeated after the final presentation-only pricing adjustment.
- Secret scanner: 616 text files checked, no matching findings in the scanned scopes. This is pattern/configured-value scanning, not proof that every possible sensitive string is absent.
- All test fixtures used the explicitly isolated local database. No test fixtures were run against the configured school database.

## Browser evidence and limits

Screenshots beside this report show actual rendered Home, Pricing, Features, Demo, About, Contact and Portal Guide pages. Monthly and annual amounts were checked in the rendered DOM against the live catalogue. Desktop review found a pricing badge/header alignment defect; the card layout was corrected. Mobile pricing (400 CSS px) and tablet guide (800 CSS px) were reviewed. This is not a manual review of every portal page or every breakpoint. No physical biometric machine was connected.

## Deployment work still required

- Use HTTPS and the production frontend origin; configure `TRUST_PROXY_HOPS` only for the known reverse-proxy topology.
- Keep production secrets in private server environment settings, restrict database network access and database-user permissions, and maintain tested backups and monitoring.
- Real biometric credential provisioning requires a private absolute `BIOMETRIC_PROVISION_DIR` outside public/static paths with restricted filesystem access. The UI reports readiness; no device secret is exposed to the browser.
- Hardware must support authenticated JSON push or a compatible local HTTP JSON adapter. Software/connector tests do not certify a physical device or vendor SDK.
- No deployment, Git commit or push was performed. The local product still needs a production-environment smoke test after deployment.

## Sources for dependency remediation

- Next.js security advisory: https://github.com/advisories/GHSA-p293-qw3h-jr36
- Official upgrade guidance: https://nextjs.org/docs/app/guides/upgrading/version-15
- Zod advisory: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
