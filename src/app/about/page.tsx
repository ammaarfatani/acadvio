import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Layers3,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { company } from "@/lib/company";
import { ProductFrame } from "@/components/Marketing";
import { OnboardingSection } from "@/components/OnboardingSection";
import { CTASection } from "@/components/CTASection";
export const metadata = {
  title: "About Acadivo — AKTech Digital Solutions",
  description:
    "Meet Acadivo, the connected school management platform by AKTech Digital Solutions in Karachi, Pakistan.",
};
export default function AboutPage() {
  return (
    <div className="ac-about">
      <section className="ac-about-hero m-section">
        <div className="m-wrap">
          <div className="ac-about-topline">
            <p className="m-eyebrow">
              ACADIVO / THE THINKING BEHIND THE PLATFORM
            </p>
            <span>
              <MapPin size={13} />
              {company.location}
            </span>
          </div>
          <div className="ac-about-intro">
            <h1>
              For the people
              <br />
              behind every
              <br />
              <em>school day.</em>
            </h1>
            <div>
              <p>
                Schools run on people. Good software should bring their work
                together, without getting in their way.
              </p>
              <p>
                Acadivo connects administration, classrooms, examinations and
                finance around the same school records. Built by {company.name},
                with a practical focus on the work that comes next.
              </p>
              <Link href="/demo" className="m-button">
                See the platform <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <div className="ac-about-stage">
            <div className="ac-about-screen">
              <ProductFrame
                image="school-admin-insights.jpg"
                label="School insights"
                priority
              />
            </div>
            <div className="ac-about-reception">
              <ProductFrame
                image="receptionist.jpg"
                label="Admissions & reception"
              />
            </div>
            <div className="ac-about-caption">
              <Layers3 size={18} />
              <span>
                Different responsibilities.
                <br />
                <strong>A shared school structure.</strong>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="m-section ac-about-story">
        <div className="m-wrap">
          <div className="p-section-heading">
            <div>
              <p className="m-eyebrow">WHY THESE CONNECTIONS MATTER</p>
              <h2>
                A student’s journey
                <br />
                doesn’t stop at
                <br />
                <em>the office door.</em>
              </h2>
            </div>
            <p>
              An admission needs a class. A teacher needs a student list. An
              examination needs academic records. A fee receipt needs a ledger.
              The next step should feel connected.
            </p>
          </div>
          <div className="ac-record-journey">
            {[
              [
                "01",
                "Admissions",
                "A clear beginning",
                "Enrollment, guardian contacts and class allocation.",
              ],
              [
                "02",
                "The classroom",
                "A place to learn",
                "Classes, timetables and attendance linked to school records.",
              ],
              [
                "03",
                "School operations",
                "The work behind the day",
                "Examinations, fees and the teams responsible for them.",
              ],
              [
                "04",
                "Parents",
                "Keep the family connected",
                "Updates and records for the children linked to their account.",
              ],
            ].map(([n, label, title, text]) => (
              <div key={n}>
                <span>
                  {n} / {label}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <ArrowRight size={17} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="m-section ac-about-beliefs">
        <div className="m-wrap">
          <div>
            <p className="m-eyebrow">OUR PRODUCT PHILOSOPHY</p>
            <h2>
              Thoughtful software.
              <br />
              Practical by design.
            </h2>
            <p>
              Not another dashboard to look after. A focused workspace for the
              responsibilities your team already has.
            </p>
          </div>
          <div className="ac-belief-list">
            {[
              [
                Layers3,
                "Clarity over clutter.",
                "A focused workspace should make the school day easier to understand.",
              ],
              [
                ShieldCheck,
                "Access follows responsibility.",
                "Roles and permissions determine which school records each account can use.",
              ],
              [
                BookOpen,
                "A confident start.",
                "Portal-use guides and onboarding guidance are included with every plan.",
              ],
            ].map(([Icon, title, text]) => {
              const Mark = Icon as typeof Layers3;
              return (
                <article key={String(title)}>
                  <Mark size={23} />
                  <div>
                    <h3>{String(title)}</h3>
                    <p>{String(text)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="m-section ac-about-company">
        <div className="m-wrap">
          <div>
            <p className="m-eyebrow">THE PEOPLE TO TALK TO</p>
            <h2>
              Built in Karachi.
              <br />
              <em>Open to your school.</em>
            </h2>
            <p className="m-body">
              Acadivo is a product of {company.name}. Tell us how your school
              works, what your team needs and where you want to start.
            </p>
            <div className="m-actions">
              <Link href="/contact" className="m-button">
                Talk to AKTech <ArrowUpRight size={16} />
              </Link>
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="m-text-link"
              >
                Visit AKTech <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <div className="ac-company-card">
            <p>PRODUCT / ACADIVO</p>
            <h3>{company.name}</h3>
            <span>
              <MapPin size={14} />
              {company.location}
            </span>
            <a href={`mailto:${company.email}`}>
              {company.email}
              <ArrowUpRight size={16} />
            </a>
            <a href={company.phoneHref}>
              {company.phone}
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>
      <OnboardingSection compact />
      <CTASection />
    </div>
  );
}
