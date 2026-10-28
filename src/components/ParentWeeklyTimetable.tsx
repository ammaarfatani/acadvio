"use client";
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export default function ParentWeeklyTimetable({ rows = [] }: { rows: any[] }) {
  const visibleDays = rows.some((r) => r.dayOfWeek === "Sunday")
    ? days
    : days.slice(0, 6);
  const periods = Array.from(
    new Set(rows.map((r) => Number(r.periodNumber))),
  ).sort((a, b) => a - b);
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Karachi",
  }).format(new Date());
  return (
    <section className="family-panel family-timetable">
      <header>
        <div>
          <p className="family-kicker">Class schedule</p>
          <h2>Weekly timetable</h2>
          <p>
            Subjects, teaching staff and lesson times for your selected child.
          </p>
        </div>
        <span className="family-status">Today: {today}</span>
      </header>
      {!rows.length ? (
        <p className="family-empty">
          Your school has not published a timetable for this class yet.
        </p>
      ) : (
        <div
          className="family-table-scroll"
          role="region"
          aria-label="Weekly timetable"
          tabIndex={0}
        >
          <table className="family-week-grid">
            <caption className="sr-only">
              Days across columns; each row is a lesson period.
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                {visibleDays.map((d) => (
                  <th scope="col" key={d} data-today={d === today}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p}>
                  <th scope="row">{p > 0 ? `Period ${p}` : "Lesson"}</th>
                  {visibleDays.map((d) => {
                    const lessons = rows
                      .filter(
                        (r) =>
                          Number(r.periodNumber) === p && r.dayOfWeek === d,
                      )
                      .sort((a, b) =>
                        String(a.startTime).localeCompare(String(b.startTime)),
                      );
                    return (
                      <td key={d} data-today={d === today}>
                        {lessons.length ? (
                          lessons.map((r, i) => (
                            <div className="family-lesson" key={r._id || i}>
                              <span>
                                {r.startTime} &ndash; {r.endTime}
                              </span>
                              <strong>
                                {r.subjectName || "Subject not assigned"}
                              </strong>
                              <p>{r.teacherName || "Teacher not assigned"}</p>
                              {r.roomNumber && (
                                <small>Room {r.roomNumber}</small>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="family-unscheduled">No lesson</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
