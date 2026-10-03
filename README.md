# Acadivo - Multi-School Management & ERP SaaS Platform

Developed by **AKTech Digital Solutions**.

Acadivo is a multi-tenant School ERP SaaS platform engineered for educational institutions.

---

## Key Platform Capabilities

### 1. Multi-Tenant Architecture & Security
- **Strict Tenant Isolation**: `schoolId` context is derived from authenticated JWT tokens. No school can ever query or modify data belonging to another school.
- **Role-Based Access Control (RBAC)**:
  - `SUPER_ADMIN`: Platform owner & operator console. School approvals, subscription management, global audit logs.
  - `SCHOOL_ADMIN`: Full institutional management for their single school context.
  - `TEACHER`: Workload management for assigned classes and subjects only.
  - `FINANCE`: Treasury desk, fee collection, bulk challans, receipts, expenses, and net financial summary.
  - `EXAM_STAFF`: Examination sessions, dynamic grading scales, result processing, ranking, certificate issuance.
  - `RECEPTIONIST`: Visitors, admissions desk, parent inquiries.
- **Zero Student/Parent Portals**: Students and parents are data records only.

### 2. Subscription Plans & 14-Day Free Trial
- **Starter Plan**: PKR 4,999/month (Up to 300 Students, 15 Teachers).
- **Professional Plan**: PKR 9,999/month (Up to 1,500 Students, 75 Teachers).
- **Enterprise Plan**: PKR 19,999/month (Unlimited Students & Teachers).
- **Automated 14-Day Trial Workflow**:
  1. School registers on marketing website (`/free-trial`).
  2. A single FREE_TRIAL subscription and active school-admin account are created.
  3. The standard 14-day trial starts immediately; no paid tier is selected.
  4. Expired admins can sign into the same account to upgrade; staff CRM access is restricted.
  5. Upon expiration, status transitions to `TRIAL_EXPIRED` (Data preserved without deletion).

### 3. Core Institutional Modules
- **Public SaaS Marketing Website**: Black, white & red branding (`/`, `/features`, `/pricing`, `/about`, `/contact`, `/login`).
- **Super Admin Operator Dashboard**: Manage schools, subscriptions, audit logs, and platform settings.
- **Academics & Timetable Builder**: Period allocation matrix with real-time **Teacher Conflict**, **Room Conflict**, and **Class Conflict** detection.
- **Student Attendance**: Mobile-friendly daily attendance register with large touch status badges (`Present`, `Absent`, `Late`, `Leave`).
- **Finance & Accounts Desk**:
  - Fee Structure Builder (Tuition, Admission, Exam, Transport, Computer, Library).
  - Student Fee Account Ledgers & Payment Receipts (`REC-2026-XXXXXX`).
  - 3-Copy Bank Fee Challans (Student Copy, Bank Copy, School Copy).
  - Expense Management & Net Financial Statement (`Net Revenue (-) Expenses = Operating Surplus`).
- **Examinations & Results**:
  - Configurable School Grading Scales (e.g. A+: 90-100%, A: 80-89%).
  - Teacher Marks Entry Grid & Audit Log tracking.
  - Automated Result Processing, Merit Position Ranking, and Result Publishing workflow.
  - Official Printable Marksheets & Report Cards.
  - Institutional Certificate Generator (Bonafide, Character, Leaving, Transfer, Result).

---

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons, shadcn/ui.
- **Backend**: Node.js, Express.js, TypeScript.
- **Database**: MongoDB & Mongoose schemas with compound indexes on `{ schoolId: 1, ... }`.
- **Authentication**: JWT access tokens & refresh tokens with bcrypt password hashing.

---

## Project Setup & Execution

### 1. Prerequisites
- Node.js (v18+)
- pnpm or npm
- MongoDB instance running locally (`mongodb://localhost:27017/acadivo_school_crm`)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Seed Initial Super Admin & Sample School Data
```bash
pnpm tsx src/server/utils/seed.ts
```

### 5. Start Development Server
```bash
pnpm dev
```
- Marketing Website: `http://localhost:3000`
- Super Admin Dashboard: `http://localhost:3000/super-admin`
- School Admin Console: `http://localhost:3000/school-admin`
- Teacher Portal: `http://localhost:3000/teacher`
- Finance Workspace: `http://localhost:3000/finance`

### 6. Production Build
```bash
pnpm build
pnpm start 
```

---

## Security Audit & Compliance

- **No Frontend `schoolId` Trust**: Context is derived from `req.user.schoolId` in Express tenant middleware (`enforceSchoolTenant`).
- **Audit Logs**: Recorded for marks changes, result processing, result publishing, payment collections, challan voids, expense logging, and user creation.
- **No Hard Deletes**: Financial transactions use `VOIDED` status with audit reasons instead of hard deletion.

## Subscription payment verification

School admins submit bank transfer proof at /school-admin/payments (or /{school-slug}/admin/payments). Super admins review submissions at /super-admin/payments. Pending school administrators can authenticate to view and submit payment proof, but CRM APIs remain blocked until approval. Suspended/cancelled schools and deactivated users remain blocked.

Configure bank details using PAYMENT_BANK_NAME, PAYMENT_ACCOUNT_TITLE, PAYMENT_ACCOUNT_NUMBER, and PAYMENT_IBAN in the backend environment. Defaults use UBL, Ammar Afzal, 2139402047933, and PK22UNIL0109000402047933. Amount, plan, and billing cycle are taken from the existing subscription; the amount is its configured price for that billing cycle.

Screenshots accept JPG/JPEG, PNG and WebP up to 5 MB. They are stored privately as binary data on the subscription payment record; authenticated, ownership-checked API endpoints provide the image. No public upload URL is created. One pending payment per school and screenshot reuse are prevented by unique database indexes.

Payment reviews use an atomic review lease and a persisted subscription period, supporting standalone MongoDB as well as replica sets. Partial activation can be resumed with Complete Activation without extending the paid period twice. Approval updates the existing subscription, activates pending users and school access, and retains academic records. Rejection requires a reason. Existing passwords remain valid. SMTP delivery failure does not undo the saved review.

Run node tests/subscription-payments.cjs and node tests/trial-branding-analytics.cjs for security/lifecycle/API checks with mocked persistence, and npx tsc --noEmit for type checking. Live MongoDB index enforcement, SMTP delivery and browser drag/drop/clipboard behavior still require deployment verification.

Pricing cards now use Pay Now and open /payment with the plan code and billingCycle. The top announcement bar uses Try Free Now and continues to /free-trial. Checkout reuses FreeTrialForm and the existing registration/authentication endpoints for new schools, or lets existing admins sign in and return to their selected payment. Paid registration grants no CRM access until payment approval; standard free-trial registration activates its limited-duration trial immediately.

Public plan/quote endpoints under /api/subscription-payments reuse the existing Plan catalogue. Only active plans can be selected. priceAnnualPKR follows the existing catalogue convention: the monthly-equivalent annual rate; the annual payment total is that rate multiplied by 12. Submission revalidates the selected code and billing cycle and computes the payment amount on the server. The live school/subscription plan changes only on payment approval.

Optional isolated browser preview: run tests/payment-ui-preview.cjs with Node to use port 3001 and a separate .next-payment-qa build folder. For local fixture API testing only, set PAYMENT_TEST_PREVIEW=1 before running tests/subscription-payments.cjs; this keeps the mocked API on port 5000 with CORS for the preview. Do not use that test server as a real backend. Stop both processes after testing.

Super-admin revenue uses APPROVED payment records and Asia/Karachi calendar boundaries for today/week/month/year. Demo seeding is opt-in through SEED_DEMO_DATA=true; analytics exclude schools explicitly marked isDemo. Previously seeded unmarked records are retained for manual review.

School logos use the authenticated school context and a validated, maximum 1 MB image stored in its private school profile. All school portals share that branding. Public academy branding uses the existing public/logo.png asset separately.



## Public site and product captures

Company contact details are centralized in src/lib/company.ts. The public website guide uses curated public knowledge in src/lib/website-guide.ts; it has no school-record access, no external AI dependency and no conversation persistence. Responses use a 1.6-second typing state, with overlapping submissions prevented and pending timers cleared on unmount. Unknown questions direct visitors to AKTech rather than inventing answers.

The contact form prepares a mailto draft; it does not claim to deliver email or save a lead. Users review and send the draft in their email app. Public portal screenshots are in public/product-showcase. The teacher capture is full length, with identifiers redacted. Receptionist preview omits the private inquiry list. Do not copy the original private captures in artifacts/ui-review to the public folder.

Authorized filming uses ?capture=private for presentation-only redaction and &full=1 for full-length capture. This affects only rendered text/layout and does not change authentication, authorization, or database records. Normal portal mode continues to show actual account and student names.

The video storyboard is in artifacts/video/storyboard.md. Final Motion rendering depends on the installed Motion connector exposing its tools and an authorized Super Admin session for platform footage. No rendered video is claimed by this handoff.
