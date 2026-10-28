"use client";
import { PageHeading, LoadingOverview } from "@/components/ProductUI";
import ParentWeeklyTimetable from "@/components/ParentWeeklyTimetable";
import ParentUpdates from "@/components/ParentUpdates";
import Link from "next/link";
import { useParent } from "@/lib/parent-context";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
const money = (n: number) => "PKR " + Number(n || 0).toLocaleString("en-PK");
export default function Dashboard() {
  const { children, data, loading, error, refresh } = useParent();
  const { user } = useAuth();
  const pathname = usePathname();
  const root = pathname.replace(/\/$/, "");
  if (loading)
    return <LoadingOverview label="Loading your child’s school records" />;
  if (!children.length)
    return (
      <p className="rounded-xl border bg-white p-6">
        No children are linked to your account. Please contact your school
        administrator.
      </p>
    );
  if (error)
    return (
      <div className="space-y-4">
        <PageHeading title="Your child’s school day" />
        <p role="alert">
          {error}{" "}
          <button onClick={() => void refresh()} className="ml-3 underline">
            Try again
          </button>
        </p>
      </div>
    );
  if (!data) return null;
  const fees = data.fees.reduce(
    (a: any, f: any) => ({
      paid: a.paid + Number(f.paidAmountPKR || 0),
      due: a.due + Number(f.remainingAmountPKR || 0),
    }),
    { paid: 0, due: 0 },
  );
  const attendance = data.attendanceSummary;
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
  });
  const upcoming = data.examSchedules
    .filter(
      (e: any) =>
        dayFormat.format(new Date(e.endDate)) >= dayFormat.format(new Date()),
    )
    .sort((a: any, b: any) => +new Date(a.startDate) - +new Date(b.startDate));
  const cards = [
    [
      "Attendance",
      attendance.total
        ? Math.round((attendance.present / attendance.total) * 100) + "%"
        : "Not recorded",
      "academics",
    ],
    ...(user?.features?.includes("FINANCE")
      ? [
          ["Fees outstanding", money(fees.due), "fees"],
          ["Verified payments", money(fees.paid), "fees"],
        ]
      : []),
    ...(user?.features?.includes("EXAMINATIONS")
      ? [["Upcoming exams", String(upcoming.length), "academics"]]
      : []),
  ];
  return (
    <div className="ui-dashboard ui-dashboard--parent space-y-6">
      <PageHeading
        eyebrow="Family workspace"
        title="Your child’s school day"
        description={
          <>
            {data.student.name} · {data.student.className}
            {data.student.sectionName
              ? " / " + data.student.sectionName
              : ""} ·{" "}
            {data.student.academicSessionName || "Academic year not assigned"}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, route]) => (
          <Link
            key={label}
            href={root + "/" + route}
            className="rounded-xl border bg-white p-5 hover:border-red-300"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-3 text-2xl font-bold">{value}</p>
            <p className="mt-3 text-xs font-medium text-red-600">
              View records →
            </p>
          </Link>
        ))}
      </div>
      <ParentWeeklyTimetable rows={data.timetable} />
      <div className="grid gap-6 lg:grid-cols-2">
        {user?.features?.includes("EXAMINATIONS") && (
          <article className="rounded-xl border bg-white p-5">
            <h2 className="font-bold">Exams & published results</h2>
            {upcoming.length ? (
              upcoming.slice(0, 3).map((e: any) => (
                <p className="mt-4 text-sm" key={e._id}>
                  {e.title} ·{" "}
                  {new Date(e.startDate).toLocaleDateString("en-GB")}
                </p>
              ))
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                No upcoming exams have been scheduled for this class.
              </p>
            )}
            {data.results[0] && (
              <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm">
                Latest result: {data.results[0].examTitle} ·{" "}
                {data.results[0].percentage}% · Grade{" "}
                {data.results[0].overallGrade}
              </p>
            )}
            <Link
              href={root + "/academics"}
              className="mt-5 inline-block text-sm text-red-600"
            >
              Open academic records
            </Link>
          </article>
        )}
      </div>
      <ParentUpdates href={root + "/notifications"} />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "School announcements",
            "notices",
            "Updates published for your child's class and family.",
          ],
          [
            "Notifications",
            "notifications",
            "Fee reminders and payment review updates.",
          ],
          [
            "Documents",
            "documents",
            "School files, published reports and receipts.",
          ],
        ].map(([title, route, desc]) => (
          <Link
            key={route}
            href={root + "/" + route}
            className="rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-zinc-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
