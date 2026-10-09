// Pure shared attendance/payroll rules. No device-specific or portal-specific calculations.
export const DEFAULT_POLICY = { timezone: "Asia/Karachi", startTime: "09:00", endTime: "17:00", workingMinutes: 480, graceMinutes: 15, lateEnabled: true, lateMethod: "FROM_START", teacherStart: "SHIFT", weeklyOff: [0], absenceDeduction: true, paidLeave: true, unpaidLeaveDeduction: true, rounding: "NEAREST" };
export function dateKey(at: Date, timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at); }
export function localTime(at: Date, timezone: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at); }
export function addDay(date: string, n: number) { return new Date(Date.parse(date + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10); }
export function zonedInstant(date: string, time: string, timezone: string) { const desired = Date.parse(date + "T" + time + ":00Z"); let at = desired; for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
    const p: any = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const actual = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    at += desired - actual;
} return new Date(at); }
export function scheduledDate(at: Date, p: any) { const date = dateKey(at, p.timezone); return p.endTime <= p.startTime && localTime(at, p.timezone) < p.endTime ? addDay(date, -1) : date; }
export function attendanceValues(date: string, checkIn: Date | undefined, checkOut: Date | undefined, p: any) { const start = zonedInstant(date, p.startTime, p.timezone), end = zonedInstant(p.endTime <= p.startTime ? addDay(date, 1) : date, p.endTime, p.timezone); const minutes = checkIn ? Math.max(0, Math.ceil((checkIn.getTime() - start.getTime()) / 60000)) : 0; const lateMinutes = minutes > p.graceMinutes ? (p.lateMethod === "AFTER_GRACE" ? minutes - p.graceMinutes : minutes) : 0; return { scheduledStart: start, scheduledEnd: end, lateMinutes, workingMinutes: checkIn && checkOut ? Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000)) : 0, status: checkIn ? (lateMinutes ? "LATE" : "PRESENT") : "ABSENT", policySnapshot: p }; }
export function monthDates(month: string) { const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate(); return Array.from({ length: end }, (_, i) => month + "-" + String(i + 1).padStart(2, "0")); }
export function workingDay(date: string, p: any, events: any[]) { const event = events.find(x => x.date === date); if (event)
    return { payable: ["SPECIAL_WORKING", "UNPAID_HOLIDAY"].includes(event.kind), unpaid: event.kind === "UNPAID_HOLIDAY", title: event.title }; return { payable: !p.weeklyOff.includes(new Date(date + "T12:00:00Z").getUTCDay()), unpaid: false, title: "" }; }
export function money(n: number, rounding = "NEAREST") { return (rounding === "UP" ? Math.ceil(n * 100) : rounding === "DOWN" ? Math.floor(n * 100) : Math.round((n + Number.EPSILON) * 100)) / 100; }
export function calculatePayroll(month: string, employee: any, employment: any, policy: any, events: any[], attendance: any[], leaves: any[], asOf?: string) {
    const p = { ...DEFAULT_POLICY, ...policy, ...employment.schedule };
    const dates = monthDates(month), payable = dates.filter(d => workingDay(d, p, events).payable);
    if (!payable.length)
        throw { statusCode: 400, message: "Calendar has no payable working days." };
    const history = [...(employment.salaryHistory || [])].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    let gross = 0, late = 0, absence = 0, unpaid = 0;
    let workedDays = 0, paidLeave = 0, unpaidLeave = 0, lateMinutes = 0;
    const days: any[] = [];
    for (const date of payable) {
        if (employment.joiningDate && date < employment.joiningDate || employment.leavingDate && date > employment.leavingDate)
            continue;
        const salary = history.filter(x => x.effectiveDate <= date).at(-1);
        if (!salary)
            throw { statusCode: 400, message: `Salary history does not cover ${date}.` };
        const daily = salary.basis === "DAILY" ? salary.amount : salary.basis === "HOURLY" ? salary.amount * p.workingMinutes / 60 : salary.amount / payable.length;
        gross += daily;
        const record = attendance.find(x => x.date === date);
        const leave = leaves.find(x => x.startDate.toISOString().slice(0, 10) <= date && x.endDate.toISOString().slice(0, 10) >= date);
        const event = workingDay(date, p, events);
        let lateDeduction = 0, absenceDeduction = 0, unpaidDeduction = 0;
        let status = "ABSENT";
        if (asOf && date > asOf) {
            status = "UPCOMING";
        }
        else if (record?.checkedInAt && record.status !== "ABSENT" && record.status !== "LEAVE") {
            workedDays++;
            status = record.status;
            lateMinutes += record.lateMinutes || 0;
            lateDeduction = p.lateEnabled ? Math.min(daily, (record.lateMinutes || 0) * daily / (record.policySnapshot?.workingMinutes || p.workingMinutes)) : 0;
        }
        else if (leave) {
            if (leave.leaveType === "Unpaid" || !p.paidLeave) {
                unpaidLeave++;
                status = "UNPAID_LEAVE";
                if (p.unpaidLeaveDeduction)
                    unpaidDeduction = daily;
            }
            else {
                paidLeave++;
                status = "PAID_LEAVE";
            }
        }
        else if (event.unpaid) {
            status = "UNPAID_HOLIDAY";
            unpaidDeduction = daily;
        }
        else if (p.absenceDeduction)
            absenceDeduction = daily;
        late += lateDeduction;
        absence += absenceDeduction;
        unpaid += unpaidDeduction;
        days.push({ date, status, source: record?.source || null, checkedInAt: record?.checkedInAt, checkedOutAt: record?.checkedOutAt, missingCheckout: !!record?.checkedInAt && !record?.checkedOutAt, dailySalary: money(daily), workingMinutes: record?.policySnapshot?.workingMinutes || p.workingMinutes, lateMinutes: record?.lateMinutes || 0, lateDeduction: money(lateDeduction, p.rounding), absenceDeduction: money(absenceDeduction, p.rounding), unpaidDeduction: money(unpaidDeduction, p.rounding) });
    }
    return { employee: { id: String(employee._id), name: employee.name, role: employee.userType, employeeId: employment.employeeId, department: employment.department, designation: employment.designation }, month, currency: "PKR", baseSalary: history.filter(x => x.effectiveDate <= month + "-31").at(-1)?.amount || 0, salaryBasis: history.filter(x => x.effectiveDate <= month + "-31").at(-1)?.basis || "MONTHLY", payableDays: payable.length, workedDays, paidLeave, unpaidLeave, lateMinutes, grossSalary: money(gross, p.rounding), lateDeduction: money(late, p.rounding), absenceDeduction: money(absence, p.rounding), unpaidLeaveDeduction: money(unpaid, p.rounding), netSalary: money(Math.max(0, gross - late - absence - unpaid), p.rounding), policy: p, calendar: events, days };
}
