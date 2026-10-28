import Link from "next/link";
import { BookOpen, Route, UsersRound, ArrowUpRight, Check } from "lucide-react";
export function OnboardingSection({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`m-onboarding m-section ${compact ? "m-onboarding-compact" : ""}`}
    >
      <div className="m-wrap">
        <div className="m-onboarding-heading">
          <div>
            <p className="m-eyebrow">Included with every plan</p>
            <h2>
              A confident start.
              <br />
              <em>For every school team.</em>
            </h2>
          </div>
          <div>
            <p className="m-lead">
              Portal guides, setup guidance and practical walkthroughs help your
              team understand how to use Acadivo in the school day.
            </p>
            <Link href="/guide" className="m-text-link">
              Read the portal guide <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="m-onboarding-grid">
          {[
            [
              BookOpen,
              "01",
              "Portal-by-portal guidance",
              "Clear instructions for school admins, teachers, finance, examinations, reception and parents.",
            ],
            [
              Route,
              "02",
              "A structured school setup",
              "Follow the setup order for sessions, classes, people and the workflows included in your plan.",
            ],
            [
              UsersRound,
              "03",
              "Help applying it to your school",
              "Contact AKTech for onboarding guidance and a walkthrough of the responsibilities your team will manage.",
            ],
          ].map(([Icon, n, title, text]: any) => (
            <article key={n}>
              <div>
                <Icon size={23} />
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        {!compact && (
          <div className="m-onboarding-bottom">
            <p>
              <Check size={16} />
              Guidance covers the modules included in your selected plan.
            </p>
            <Link className="m-button m-button-outline" href="/contact">
              Discuss your school setup <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
