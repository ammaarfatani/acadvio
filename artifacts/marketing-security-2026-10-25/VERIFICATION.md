# Marketing verification — 26 October 2026

## Prices confirmed against the running API

| Plan | Monthly | Annual total | Annual monthly equivalent |
|---|---:|---:|---:|
| Starter | PKR 2,000 | PKR 19,200 | PKR 1,600 |
| Professional | PKR 4,000 | PKR 38,400 | PKR 3,200 |
| Enterprise | PKR 8,000 | PKR 76,800 | PKR 6,400 |

All six live quote responses are saved in `live-quotes.json`. Monthly prices are the final prices confirmed by the user. The 20% badge describes annual billing savings relative to twelve monthly payments; it is not an additional monthly discount.

## Rendered pages

Actual browser screenshots: home-desktop.png, features-desktop.png, demo-desktop.png, about-desktop.png, contact-desktop.png, guide-desktop.png, pricing-desktop.png, guide-tablet.png and pricing-mobile.png.

- Desktop: reviewed the seven marketing routes `/`, `/features`, `/pricing`, `/demo`, `/about`, `/contact`, `/guide`. All rendered successfully after starting the local API. No horizontal page overflow was observed. Loaded images on the five screenshot-led marketing routes had no broken-image results in the DOM check.
- Mobile: annual pricing reviewed at 400 CSS px; no horizontal page overflow. Stacked plan cards and billing controls remained usable.
- Tablet: handbook reviewed at 800 CSS px. Role navigation and chapter/sidebar layout remained readable.
- New handbook: separate administrator, teacher, finance, examination, reception and parent workflow sections. Public guidance does not grant access to protected records.
- Public pricing: verified the rendered monthly amounts and annual totals; Pay Now links retain plan and billing-cycle selection. Free trial stays a separate approval flow.

The first desktop pricing screenshot exposed unequal heading positions caused by badges participating in a flex layout. The final correction gives every plan an equal badge slot, keeps the plan content at the top and pins payment buttons below the feature list. The final desktop and mobile pricing screenshots were replaced after the successful production rebuild. The final build exited 0 with 151 pages generated; existing non-blocking lint warnings remain.

Final browser interaction: Starter Pay Now opened `/payment?plan=STARTER&billingCycle=monthly`, showing Starter Plan, PKR 2,000 and one-month duration from the backend quote. Announcement-bar Try Free Now opened `/free-trial` with approval instructions. No registration or payment was submitted.

## Limits

This pass does not certify every portal screen at every breakpoint. Automated authorization tests cover representative protected routes, roles, plans and tenant boundaries. It is not an external penetration test. No real biometric hardware, payment transfer, real payroll update or public deployment was performed. See SECURITY-AUDIT.md for deployment requirements and actual automated test results.
