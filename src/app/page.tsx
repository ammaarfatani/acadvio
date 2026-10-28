import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers3,
  LockKeyhole,
  School,
  Users,
  Wallet,
} from "lucide-react";
import { ProductFrame, Workflow } from "@/components/Marketing";
import { MarketingExperience } from "@/components/MarketingExperience";
import { OnboardingSection } from "@/components/OnboardingSection";
import { PricingTable } from "@/components/PricingTable";
import { CTASection } from "@/components/CTASection";
const modules = [
  {
    icon: Users,
    title: "Every student. A complete picture.",
    text: "Admissions, guardian contacts, classes and student records stay connected.",
    label: "Student management",
    href: "/features#students",
    style: "p-feature-students",
  },
  {
    icon: CalendarDays,
    title: "Bring order to the school day.",
    text: "Keep attendance registers and class timetables close to the people who use them.",
    label: "Attendance & timetables",
    href: "/features#attendance",
    style: "p-feature-attendance",
  },
  {
    icon: ClipboardList,
    title: "Give your team room to teach.",
    text: "Assigned classes, attendance and academics in a dedicated teacher workspace.",
    label: "Teachers & staff",
    href: "/features#staff",
    style: "p-feature-teachers",
  },
];
const faqs = [
  [
    "How do we get started?",
    "Submit your school’s free-trial request. Your school stays pending while the application is reviewed. After approval, sign in and follow the portal guide to set up sessions, classes and your team.",
  ],
  [
    "Will you help our team learn the software?",
    "Yes. Portal-use guides and onboarding guidance are included with every plan. Read the role-by-role handbook or contact AKTech to discuss a walkthrough for your school.",
  ],
  [
    "Does everyone use the same dashboard?",
    "No. School administrators, teachers, finance, examinations, reception and parents have workspaces for their responsibilities. Available modules depend on your selected plan and account permissions.",
  ],
  [
    "How does paid subscription activation work?",
    "Choose a plan, transfer the quoted amount to the UBL account shown on the payment page and upload your payment screenshot. Payment is reviewed within 24 hours. Access activates after verification, not immediately after submission.",
  ],
];
export default function HomePage() {
  return (
    <MarketingExperience>
      <section className="p-hero">
        <div className="p-hero-light" aria-hidden="true" />
        <div className="m-wrap p-hero-layout">
          <div className="p-hero-copy" data-reveal>
            <p className="p-kicker">
              <span /> BUILT FOR THE SCHOOL DAY
            </p>
            <h1>
              A whole school.
              <br />
              {" "}
              Working as <em>one.</em>
            </h1>
            <p className="p-hero-description">
              Bring your people, classrooms and daily operations together. From
              first admission to final marksheet, keep the work connected with
              Acadivo.
            </p>
            <div className="m-actions">
              <Link className="m-button" href="/free-trial">
                Start Free Trial <ArrowRight size={17} />
              </Link>
              <Link className="m-button m-button-outline" href="/demo">
                Explore the Platform <ArrowUpRight size={17} />
              </Link>
            </div>
            <p className="p-trial-note">
              <Check size={14} />
              14-day trial <span>·</span> No credit card <span>·</span> Approval
              required
            </p>
            <div className="p-hero-footnote">
              <Layers3 size={20} />
              <span>
                One connected system.
                <br />
                <strong>A focused workspace for every role.</strong>
              </span>
            </div>
          </div>
          <div className="p-product-stage" data-reveal>
            <div className="p-stage-orbit" aria-hidden="true" />
            <div className="p-stage-label">
              <span className="p-live-dot" /> INSIDE ACADIVO{" "}
              <span>ACTUAL PRODUCT CAPTURES</span>
            </div>
            <div className="p-main-window">
              <ProductFrame
                image="school-admin.jpg"
                label="School administration"
                priority
              />
            </div>
            <div className="p-finance-window">
              <ProductFrame image="finance.jpg" label="Fees & finance" />
            </div>
            <div className="p-exam-window">
              <ProductFrame image="examination.jpg" label="Examinations" />
            </div>
            <div className="p-insight-window">
              <ProductFrame
                image="school-admin-insights.jpg"
                label="School insights"
              />
            </div>
            <div className="p-context-note">
              <CheckCheck size={19} />
              <div>
                <strong>Connected by your school.</strong>
                <span>Students · Attendance · Fees · Results</span>
              </div>
            </div>
          </div>
        </div>
        <div className="m-wrap p-trust-strip">
          <span>
            Designed around
            <br />
            <strong>real school responsibilities</strong>
          </span>
          <div>
            <School size={19} /> School administration
          </div>
          <div>
            <GraduationCap size={21} /> Teaching & academics
          </div>
          <div>
            <Wallet size={19} /> Fees & finance
          </div>
          <div>
            <LockKeyhole size={18} /> Role-based access
          </div>
        </div>
      </section>
      <section className="m-section p-problem">
        <div className="m-wrap" data-reveal>
          <div className="p-section-heading">
            <div>
              <p className="m-eyebrow">THE EVERYDAY, BETTER CONNECTED</p>
              <h2>
                School is complex.
                <br />
                <em>The workflow shouldn’t be.</em>
              </h2>
            </div>
            <p>
              Separate registers. Repeated entries. Another office to ask. Give
              each team the right tools, with the school’s records connecting
              their work.
            </p>
          </div>
          <div className="p-workflow-bridge">
            <div className="p-before">
              <span>THE DISCONNECTED DAY</span>
              <div>
                <FileText size={19} /> Admissions register
              </div>
              <div>
                <CalendarDays size={19} /> Attendance sheets
              </div>
              <div>
                <Wallet size={19} /> Fee records
              </div>
              <p>Different tasks. Different places.</p>
            </div>
            <div className="p-bridge-symbol" aria-hidden="true">
              <ArrowRight />
            </div>
            <div className="p-after">
              <div className="p-after-heading">
                <Layers3 size={25} />
                <h3>One school workspace.</h3>
              </div>
              <p>
                Start with a student record. Connect the classroom, fee ledger
                and academic journey around it.
              </p>
              <div className="p-connected-tags">
                <span>People</span>
                <i />
                <span>Operations</span>
                <i />
                <span>Visibility</span>
              </div>
              <Link href="/features">
                See how it fits together <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="m-section p-platform" id="platform">
        <div className="m-wrap">
          <div className="p-section-heading" data-reveal>
            <div>
              <p className="m-eyebrow">A PLATFORM. NOT A PILE OF TOOLS.</p>
              <h2>
                Built around people.
                <br />
                Connected through records.
              </h2>
            </div>
            <Link className="m-text-link" href="/features">
              Explore all features <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="p-feature-grid">
            {modules.map(({ icon: Icon, ...m }) => (
              <article
                key={m.title}
                className={`p-feature ${m.style}`}
                data-reveal
              >
                <div className="p-feature-top">
                  <Icon size={24} />
                  <Link href={m.href} aria-label={`Explore ${m.label}`}>
                    <ArrowUpRight size={20} />
                  </Link>
                </div>
                <p className="m-eyebrow">{m.label}</p>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
                {m.style === "p-feature-teachers" && (
                  <div className="p-teacher-preview">
                    <ProductFrame
                      image="teacher.jpg"
                      label="Teacher workspace"
                    />
                  </div>
                )}
              </article>
            ))}
            <article className="p-feature p-feature-exams" data-reveal>
              <div>
                <p className="m-eyebrow">EXAMINATIONS & RESULTS</p>
                <h3>
                  From the first paper
                  <br />
                  to the final marksheet.
                </h3>
                <p>
                  Schedule examinations, enter marks, review results and print
                  school documents from the records your team maintains.
                </p>
                <Link className="m-text-link" href="/features#exams">
                  Explore examinations <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="p-exam-preview">
                <ProductFrame image="examination.jpg" label="Examinations" />
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="m-section p-finance">
        <div className="m-wrap p-finance-layout" data-reveal>
          <div className="p-finance-copy">
            <p className="m-eyebrow">CLARITY FOR THE FINANCE OFFICE</p>
            <h2>
              The numbers.
              <br />
              And the story
              <br />
              <em>behind them.</em>
            </h2>
            <p>
              Fee structures, challans, payments and receipts belong in the same
              conversation. Follow what has been collected and what still needs
              attention.
            </p>
            <ul>
              <li>
                <Check size={16} /> Student fee ledgers & challans
              </li>
              <li>
                <Check size={16} /> Payment records & receipts
              </li>
              <li>
                <Check size={16} /> Reports grounded in recorded transactions
              </li>
            </ul>
            <Link className="m-text-link" href="/features#finance">
              Inside the finance workspace <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="p-finance-product">
            <div className="p-screen-caption">
              <span className="p-live-dot" /> THE FINANCE WORKSPACE{" "}
              <span>REAL PRODUCT VIEW</span>
            </div>
            <ProductFrame image="finance.jpg" label="Finance" />
            <p>Available with Professional and Enterprise plans.</p>
          </div>
        </div>
      </section>
      <section className="m-section p-roles">
        <div className="m-wrap p-roles-layout" data-reveal>
          <div>
            <p className="m-eyebrow">ONE SCHOOL. DIFFERENT RESPONSIBILITIES.</p>
            <h2>
              Everyone belongs.
              <br />
              Every view has a purpose.
            </h2>
            <p className="m-body">
              Let each person focus on their part of the school day. Accounts
              and permissions determine what they can see and do.
            </p>
            <Link className="m-text-link" href="/demo">
              Explore the real portals <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="p-role-map">
            {[
              [
                "01",
                "School administration",
                "Oversee records, people and daily operations.",
              ],
              [
                "02",
                "Teachers & academic teams",
                "Assigned classes, attendance, schedules and results.",
              ],
              [
                "03",
                "Finance & reception",
                "Fees, receipts, admissions and front-desk work.",
              ],
              [
                "04",
                "Parents",
                "Follow linked children, school updates and fee records.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <ArrowUpRight size={18} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="m-section p-start">
        <div className="m-wrap" data-reveal>
          <div className="p-section-heading">
            <div>
              <p className="m-eyebrow">A CLEAR WAY IN</p>
              <h2>
                From a fresh start
                <br />
                to your school’s routine.
              </h2>
            </div>
            <p>
              Request your trial, wait for approval, then build your school
              setup with guidance. Every plan includes a role-by-role portal
              handbook.
            </p>
          </div>
          <Workflow />
          <Link className="m-text-link" href="/guide">
            <BookOpen size={17} /> Open the portal handbook{" "}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="m-section p-pricing">
        <div className="m-wrap" data-reveal>
          <div className="p-section-heading">
            <div>
              <p className="m-eyebrow">ROOM FOR YOUR NEXT CHAPTER</p>
              <h2>
                The right plan.
                <br />
                <em>A confident start.</em>
              </h2>
            </div>
            <p>
              Clear regional pricing. Monthly or annual billing. Portal guides and
              onboarding guidance included with every plan.
            </p>
          </div>
          <PricingTable compact />
          <Link className="m-text-link" href="/pricing">
            Compare every included feature <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <OnboardingSection compact />
      <section className="m-section p-faq">
        <div className="m-wrap p-faq-layout" data-reveal>
          <div>
            <p className="m-eyebrow">BEFORE THE FIRST SCHOOL DAY</p>
            <h2>
              A few good
              <br />
              questions.
            </h2>
            <p className="m-body">Need to discuss your school’s setup?</p>
            <Link className="m-text-link" href="/contact">
              Talk to AKTech <ArrowUpRight size={16} />
            </Link>
          </div>
          <div>
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <CTASection />
    </MarketingExperience>
  );
}
