# Portal UI refinement and verification - 24 October 2026

## Implemented
- Shared portal controls: consistent heights, focus states, constrained widths, warm neutral headings, restrained red accents and mobile wrapping. Scoped through PortalShell to 7 portals / 136 inventoried route pages. This is shared coverage, not 136 individually redesigned or visually approved pages.
- Notifications: structured inbox, real unread/total counts, search, unread filter, loading/empty/error/retry states and guarded read actions.
- Announcements: structured notice feed, search/priority filters, aligned editor and audience controls; existing publishing/permission rules retained.
- Parent portal: child context and selectors, profile/academic/fee headings, child avatars, document/notice/notification search and account profile layout. Browser review caught a collapsed child dropdown; corrected flex sizing and verified width 249px at a 910px viewport.
- Optional missing photo: brief empty cache + initials fallback; no global 404 popup for optional photo GET. Authentication, forbidden and genuine record errors remain visible. Service errors use plain user-facing messages.
- Subscription reminder: persistent shell banner for 0-7 days remaining, expiry and deactivation; refreshes every minute/on focus/data changes, cannot be dismissed and stays outside the scrolling page. Billing actions remain restricted by role. Printed documents exclude the reminder.

## Actual checks this continuation
- TypeScript: PASS after final changes.
- tests/portal-feedback.cjs: PASS 30 checks.
- tests/api-freshness.cjs: PASS 8 checks.
- tests/profile-photo.cjs: PASS 14 checks, including 404 cache, retryable service failure and invalid staff business-ID handling.
- tests/organization-security.cjs: PASS 229 real HTTP/MongoDB checks against a disposable database on 127.0.0.1:27018. Covers parent linkage, permissions, tenant/branch isolation, notice audiences and existing portal APIs. Email delivery stubbed. Initial attempt failed because local MongoDB was stopped; rerun after starting local test service passed.
- Total: 281 assertions/checks. A concurrent first TypeScript invocation encountered disappearing Next-generated files during dev startup; rerun after startup passed.

## Browser evidence
Authenticated with the user's authorized existing school-admin and parent accounts. Read-only checks; no notices published, no invoices created, no payment submissions, no account/password changes, no real expiry changes.
- Admin organization overview: real data loaded (DOM verified).
- Admin notifications: real unread feed loaded; 1440x900 and 390x800 DOM geometry checks found no document-level horizontal overflow. Screenshots at overridden dimensions failed in the browser capture tool; these are geometry/data checks, not screenshot-based visual approval.
- Admin announcements: real feed and editor controls loaded. Editor opened then cancelled. Actual screenshot reviewed at default viewport 910x425; image saved as admin-announcements.png. 1280x800 geometry check found no overall horizontal overflow.
- Parent: all 10 page routes loaded and DOM reviewed: dashboard, children, academics, fees, documents, notices, notifications, profile, id-cards and subscription. Selected child had no photo; initials rendered and no photo error toast appeared. No invoices for this child, so payment submission was not exercised. ID card correctly showed pending approval. Current browser console error log returned no errors.
- Actual screenshots reviewed/saved: parent-children.png and parent-notifications.png. Parent-dashboard.png was captured before the child-selector fix and is historical, not final evidence.
- Browser viewport override reset. Default viewport is controlled by the user's side-panel size.

## Exact local routes
Base: http://127.0.0.1:3000/aptechinternationalinstitute
- /admin/communication/notifications
- /admin/communication/announcements
- /parent
- /parent/children
- /parent/academics
- /parent/fees
- /parent/documents
- /parent/notices
- /parent/notifications
- /parent/profile
- /parent/id-cards
- /parent/subscription

## Remaining verification / limitations
- Other staff portals and remaining admin pages have shared styling and source inventory coverage, but were not individually visually approved in this pass. See route-inventory.csv. No claim that every page or every action has been tested.
- Full screenshot-based desktop/tablet/phone approval remains incomplete because explicit viewport overrides caused screenshot capture failures. Geometry checks cannot establish typography/crop/visual balance.
- The live subscription warning was not triggered by changing real school expiry; boundary behavior is covered by automated checks. Real renewal/expiry lifecycle needs a separate disposable browser fixture.
- Parent account has one child; live multi-child switching not exercised. Isolation is covered by integration checks.
- No new stock photographs or invented UI/data were introduced. Existing official document styling/printing templates were excluded from general control refinements.
- Frontend local dev server runs on port 3000; backend on port 5000 uses --reports-audit, which disables maintenance/seed/email scheduling. This is local verification, not deployment.

Historical notification screenshots are named historical-notifications-narrow.png and admin-notifications.png; they are not desktop screenshot evidence. Parent announcement search was tested with a nonmatching query, showed a clean empty state, then was cleared.
