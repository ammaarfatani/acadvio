import {PortalGuideStage} from "@/components/PortalGuideStage";
import Link from "next/link";
import { BookOpen, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { CTASection } from "@/components/CTASection";
export const metadata = {
  title: "Portal Guide & Getting Started - Acadivo",
  description:
    "Practical guidance for setting up Acadivo and using the school admin, teacher, finance, examination, reception and parent portals.",
};
const guides = [
  {
    id: "school-admin",
    n: "01",
    title: "School administrator",
    intro: "Build the school structure before everyday records are added.",
    steps: [
      "After your school is approved, sign in with your school administrator account.",
      "Create the academic session, classes, sections and subjects. Add teachers and staff with the right responsibilities.",
      "Admit students with their guardian details. Share parent credentials securely through the credential handoff provided by your school.",
      "Set the attendance method and school policy. Configure fee structures and examination settings when your plan includes those modules.",
      "Review school records and reports. In Enterprise, the organization owner manages branches and school billing.",
    ],
  },
  {
    id: "teacher",
    n: "02",
    title: "Teachers",
    intro: "Work from your assigned classes and students.",
    steps: [
      "Use the account supplied by your school. Check your assigned classes, subjects and weekly timetable.",
      "Open student attendance and choose the correct class and date before saving a register.",
      "Enter marks only for the examinations and subjects you are authorized to manage.",
      "Read announcements and use your own staff attendance, leave and salary pages when enabled.",
    ],
  },
  {
    id: "finance",
    n: "03",
    title: "Finance",
    intro: "Keep charges, collections and verification connected.",
    steps: [
      "Check the school or branch context, then configure the applicable fee structures.",
      "Issue challans for the intended students and billing period. Review the amount and fee breakdown before printing.",
      "Record collections or review parent bank-transfer proofs. Approve only after confirming the actual transfer; provide a reason when rejecting.",
      "Use verified receipts, ledgers and reports to reconcile collections. Staff payroll access follows assigned permissions.",
    ],
  },
  {
    id: "examinations",
    n: "04",
    title: "Examination team",
    intro: "Follow the examination from schedule to published documents.",
    steps: [
      "Create the named examination and select the academic session and participating classes.",
      "Prepare the subject date sheet, enter marks and review incomplete entries.",
      "Process and review results before publishing. Missing marks should be reviewed rather than assumed to be zero.",
      "Use marksheets and certificates for individual or class printing. Review the document preview and issue status first.",
    ],
  },
  {
    id: "reception",
    n: "05",
    title: "Reception & admissions",
    intro: "Give front-desk records a clear next step.",
    steps: [
      "Review inquiries, appointments, visitors and incoming requests from your workspace.",
      "Capture admission and guardian details carefully, and check existing records to avoid duplicates.",
      "Use the student directory and the document library within your assigned permissions.",
      "Route requests to the appropriate school team and review their current status.",
    ],
  },
  {
    id: "parents",
    n: "06",
    title: "Parents",
    intro: "Follow the records linked to your family.",
    steps: [
      "Sign in using the parent credentials provided by your school.",
      "Choose the correct child using Viewing child. All academic and fee information follows that selection.",
      "Review the weekly timetable, attendance, published marksheets, announcements and school documents.",
      "For an unpaid invoice, use the school's configured bank details and submit the payment screenshot. The balance updates after Finance approval.",
      "View receipts for verified payments. Contact the school administrator for account details, child linking or an ID card awaiting approval.",
    ],
  },
];
export default function GuidePage() {
  return (
    <div className="m-guide-page">
      <section className="m-section m-guide-hero">
        <div className="m-wrap ac-guide-hero-grid">
          <div><p className="m-eyebrow">Acadivo / The portal handbook</p>
          <h1>
            Get started.
            <br />
            <em>Keep your school moving.</em>
          </h1>
          <div className="m-guide-intro">
            <p className="m-lead">
              A practical starting point for each school role. Portal-use
              guidance and onboarding help are included with every Acadivo plan.
            </p>
            <Link href="/contact" className="m-button">
              Ask for a walkthrough <ArrowUpRight size={16} />
            </Link>
          </div>
          <nav aria-label="Portal guide sections">
            {guides.map((g) => (
              <a href={`#${g.id}`} key={g.id}>
                {g.title}
              </a>
            ))}
          </nav></div>
          <PortalGuideStage/>
        </div>
      </section>
      <section className="m-section">
        <div className="m-wrap m-guide-layout">
          <aside>
            <BookOpen size={28} />
            <h2>Start with your role.</h2>
            <p>
              Your school plan and account permissions determine which modules
              appear. This guide does not grant access to private records.
            </p>
            <div>
              <ShieldCheck size={18} />
              <p>
                Keep passwords and bank-transfer proofs private. Your public
                website guide cannot read school records or approve payments.
              </p>
            </div>
            <Link href="/pricing" className="m-text-link">
              Compare plans ↗
            </Link>
          </aside>
          <div>
            {guides.map((g) => (
              <article className="m-guide-chapter" id={g.id} key={g.id}>
                <header>
                  <span>{g.n}</span>
                  <div>
                    <h2>{g.title}</h2>
                    <p>{g.intro}</p>
                  </div>
                </header>
                <ol>
                  {g.steps.map((s, i) => (
                    <li key={s}>
                      <span>{i + 1}</span>
                      <p>{s}</p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="m-section m-charcoal">
        <div className="m-wrap m-split">
          <div>
            <p className="m-eyebrow">Your first school setup</p>
            <h2>
              A clear order.
              <br />A smoother start.
            </h2>
          </div>
          <ol className="m-guide-checklist">
            {[
              "School approval and administrator login",
              "Academic session, classes, sections and subjects",
              "Staff roles, student admissions and linked parents",
              "Attendance policy and plan-specific workflows",
              "Team walkthrough and review of real records",
            ].map((s) => (
              <li key={s}>
                <Check size={17} />
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CTASection />
    </div>
  );
}
