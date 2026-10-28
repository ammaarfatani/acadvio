import { z } from "zod";
export const id = z.string().regex(/^[a-f0-9]{24}$/i);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const timezone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone");
export const policy = z
  .object({
    timezone,
    startTime: time,
    endTime: time,
    workingMinutes: z.number().int().min(1).max(1440),
    graceMinutes: z.number().int().min(0).max(240),
    lateEnabled: z.boolean(),
    lateMethod: z.enum(["FROM_START", "AFTER_GRACE"]),
    teacherStart: z.enum(["SHIFT", "FIRST_CLASS"]),
    weeklyOff: z.array(z.number().int().min(0).max(6)).max(6),
    absenceDeduction: z.boolean(),
    paidLeave: z.boolean(),
    unpaidLeaveDeduction: z.boolean(),
    rounding: z.enum(["NEAREST", "UP", "DOWN"]),
  })
  .strict()
  .refine((p) => p.startTime !== p.endTime, "Shift start/end must differ");
export const schedule = z
  .object({
    startTime: time.optional(),
    endTime: time.optional(),
    workingMinutes: z.number().int().min(1).max(1440).optional(),
    teacherStart: z.enum(["SHIFT", "FIRST_CLASS"]).optional(),
  })
  .strict();
export const employment = z
  .object({
    employeeId: z.string().trim().min(1).max(60).optional(),
    department: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(30).optional(),
    designation: z.string().trim().max(100),
    joiningDate: date,
    leavingDate: date.optional(),
    status: z.enum(["ACTIVE", "ENDED"]),
    schedule: schedule.optional(),
    salary: z
      .object({
        effectiveDate: date,
        amount: z.number().min(0).max(1e9),
        basis: z.enum(["MONTHLY", "DAILY", "HOURLY"]),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (x) => !x.leavingDate || x.leavingDate >= x.joiningDate,
    "Leaving date precedes joining date",
  )
  .refine(
    (x) => x.status !== "ENDED" || !!x.leavingDate,
    "Ended employment requires a leaving date",
  );
export const device = z
  .object({
    name: z.string().trim().min(2).max(100),
    brand: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    deviceId: z.string().trim().min(1).max(100),
    connectionType: z.enum(["PUSH_JSON", "CONNECTOR_HTTP_JSON"]),
    timezone,
    host: z.string().max(200).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    transactionPath: z
      .string()
      .regex(/^\/[a-zA-Z0-9_?=&./%-]*$/)
      .max(500)
      .optional(),
    username: z.string().max(100).optional(),
    credentials: z.string().max(4000).optional(),
    enabled: z.boolean(),
  })
  .strict()
  .refine(
    (d) =>
      d.connectionType !== "CONNECTOR_HTTP_JSON" ||
      (!!d.host && !!d.port && !!d.transactionPath),
    "Local HTTP adapter needs host, port and transaction path",
  );
export const punch = z
  .object({
    eventId: z.string().min(1).max(150),
    biometricUserId: z.string().min(1).max(100),
    timestamp: z
      .string()
      .datetime({ offset: true })
      .refine(
        (v) =>
          Date.parse(v) <= Date.now() + 300000 &&
          Date.parse(v) >= Date.parse("2000-01-01"),
        "Punch time outside supported range",
      ),
    verificationMethod: z.string().max(100).optional(),
  })
  .strict();
