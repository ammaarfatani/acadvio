"use client";
import { useParent } from "@/lib/parent-context";
import { useAuth } from "@/lib/auth-context";
import { PageHeading } from "@/components/ProductUI";
import { UserRound, Building2, Mail } from "lucide-react";
export default function Page() {
  const { user } = useAuth();
  const { children } = useParent();
  return (
    <div className="parent-profile space-y-5">
      <PageHeading
        eyebrow="Family workspace"
        title="My profile"
        description="Your parent account and the school linked to your family."
      />
      <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <article className="family-panel family-profile-account p-6">
          <div className="flex items-center gap-4 border-b pb-5">
            <span className="grid h-14 w-14 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-700">
              <UserRound size={26} />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{user?.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">Parent account</p>
            </div>
          </div>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="flex items-center gap-2 text-xs text-zinc-500">
                <Mail size={14} />
                Account email
              </dt>
              <dd className="mt-2 break-all text-sm font-medium">
                {user?.email}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-zinc-500">
                <Building2 size={14} />
                School
              </dt>
              <dd className="mt-2 text-sm font-medium">{user?.school?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Linked children</dt>
              <dd className="mt-2">
                {children.length
                  ? children.map((c) => (
                      <div className="family-linked-child" key={c._id}>
                        <strong>{c.name}</strong>
                        <span>
                          {c.className}
                          {c.sectionName ? " / " + c.sectionName : ""}
                        </span>
                      </div>
                    ))
                  : "No children linked"}
              </dd>
            </div>
          </dl>
        </article>
        <aside className="family-profile-help p-6">
          <p className="family-kicker">School support</p>
          <h2 className="mt-2 text-xl font-semibold">
            Need to update your details?
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            Contact your school administrator to update your linked children or
            account information.
          </p>
          {user?.school?.phone && (
            <p className="mt-4 text-sm font-medium">
              School contact:{" "}
              <a
                href={"tel:" + user.school.phone}
                className="family-contact-link"
              >
                {user.school.phone}
              </a>
            </p>
          )}
          <p className="mt-4 text-sm leading-7 text-zinc-600">
            To change your password, open the account menu at the top of the
            page.
          </p>
        </aside>
      </section>
    </div>
  );
}
