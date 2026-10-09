import { Router } from "express";
import { ReceptionistController } from "../controllers/receptionist.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireUserType, requirePermission } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import {
  AdmissionCreateSchema,
  AdmissionUpdateSchema,
  AdmissionAdmitSchema,
} from "../validators/domain.validator";

const router = Router();

router.use(
  authenticate,
  requireUserType(UserType.RECEPTIONIST, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN),
  enforceSchoolTenant
);

// 1. Dashboard
router.get("/dashboard", ReceptionistController.getDashboard);

// 2. Admissions & Inquiries
router.get("/admissions", requirePermission("admissions.view"), ReceptionistController.getAdmissions);
router.post(
  "/admissions",
  requirePermission("admissions.manage"),
  validate(AdmissionCreateSchema),
  ReceptionistController.createAdmission
);
router.patch(
  "/admissions/:admissionId",
  requirePermission("admissions.manage"),
  validate(AdmissionUpdateSchema),
  ReceptionistController.updateAdmission
);
router.post(
  "/admissions/:admissionId/admit",
  requirePermission("admissions.manage"),
  validate(AdmissionAdmitSchema),
  ReceptionistController.admitStudent
);

// 3. Students & Parents (Receptionist Directory)
router.get("/students", requirePermission("students.view"), ReceptionistController.getStudents);
router.get("/students/:studentId", requirePermission("students.view"), ReceptionistController.getStudentById);
router.get("/parents", requirePermission("students.view"), ReceptionistController.getParents);

// 4. Visitors Desk
router.get("/visitors", requirePermission("visitors.manage"), ReceptionistController.getVisitors);
router.post("/visitors", requirePermission("visitors.manage"), ReceptionistController.createVisitor);
router.patch(
  "/visitors/:visitorId/checkout",
  requirePermission("visitors.manage"),
  ReceptionistController.checkoutVisitor
);

// 5. Appointments Desk
router.get("/appointments", requirePermission("visitors.manage"), ReceptionistController.getAppointments);
router.post("/appointments", requirePermission("visitors.manage"), ReceptionistController.createAppointment);
router.patch(
  "/appointments/:appointmentId",
  requirePermission("visitors.manage"),
  ReceptionistController.updateAppointment
);

// 6. Front Desk Requests
router.get("/requests", ReceptionistController.getRequests);
router.post("/requests", ReceptionistController.createRequest);
router.patch("/requests/:requestId", ReceptionistController.updateRequest);

// 7. Notifications
router.get("/notifications", ReceptionistController.getNotifications);

// 8. Academic Lookups
router.get("/classes", ReceptionistController.getClasses);
router.get("/classes/:classId/sections", ReceptionistController.getSections);
router.get("/academic-sessions", ReceptionistController.getAcademicSessions);

export default router;
