# Navbar location selector — 27 October 2026

Implemented:
- Removed the country dropdown from PricingTable.
- Added a compact globe/flag/country-code selector to the shared public Navbar (including mobile). GB displays UK.
- Searchable, scrollable panel lists 249 ISO countries/territories, shows currency and English language availability truthfully, and indicates USD international pricing for countries without configured local rates.
- PK/US/GB/IN retain their independently configured PKR/USD/GBP/INR prices. No exchange-rate conversion or unapproved market prices introduced. Existing unsupported-currency payment restrictions preserved.
- Country persists separately from settlement market; existing stored market selections remain compatible. In-page pricing updates via the existing shared event.
- Escape/outside click/close button dismiss the panel; opening focuses search; choosing returns focus to the trigger. Mobile panel height is constrained and list scrolls internally.

Verified:
- TypeScript passed.
- tests/location-selector.cjs passed: all 249 unique countries, mappings, UK label, navbar-only selector.
- Actual browser: flags visibly load; UK selection updates monthly prices to GBP 24/49/99 and URL market GB; selection survives refresh; Escape closes panel.
- Desktop 1600px and mobile 320px visually reviewed. No horizontal overflow. Mobile panel bottom 885px within 900px viewport. Screenshots saved: desktop.png and mobile.png.
- No production build rerun for this focused selector change; Next development compilation and TypeScript passed. No deployment performed.
