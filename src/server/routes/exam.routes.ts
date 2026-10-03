import { Router } from "express";
import { ExamController } from "../controllers/exam.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireUserType } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import { ExamScheduleSchema, GradingScaleSchema, MarksEntrySchema, ProcessResultsSchema, PublishResultsSchema, CertificateSchema } from "../validators/domain.validator";

const router = Router();

// Protect all exam routes with authentication and strict tenant enforcement
router.use(authenticate, enforceSchoolTenant);

// Restricted to EXAM_STAFF, TEACHER, SCHOOL_ADMIN, and SUPER_ADMIN
const allowedRoles = [UserType.EXAM_STAFF, UserType.TEACHER, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN];

// Dashboard Metrics
router.get("/dashboard", requireUserType(...allowedRoles), ExamController.getDashboard);

// Exam Schedules
router.get("/schedules", requireUserType(...allowedRoles), ExamController.getExams);
router.post("/schedules", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), validate(ExamScheduleSchema), ExamController.createExam);

// Lookups for Dropdowns & Candidate Management
router.get("/classes", requireUserType(...allowedRoles), ExamController.getClasses);
router.get("/sections", requireUserType(...allowedRoles), ExamController.getSections);
router.get("/subjects", requireUserType(...allowedRoles), ExamController.getSubjects);
router.get("/sessions", requireUserType(...allowedRoles), ExamController.getSessions);
router.get("/students", requireUserType(...allowedRoles), ExamController.getStudents);

// Configurable Grading Scale
router.get("/grading-scale", requireUserType(...allowedRoles), ExamController.getGradingScale);
router.put("/grading-scale", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), validate(GradingScaleSchema), ExamController.updateGradingScale);

// Marks Entry & Lookup
router.get("/marks", requireUserType(...allowedRoles), ExamController.getMarks);
router.post("/marks", requireUserType(...allowedRoles), validate(MarksEntrySchema), ExamController.saveMarksEntry);

// Result Processing & Publishing
router.get("/results", requireUserType(...allowedRoles), ExamController.getResults);
router.post("/process", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), validate(ProcessResultsSchema), ExamController.processResults);
router.post("/publish", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), validate(PublishResultsSchema), ExamController.publishResults);

// Reports & Analytics
router.get("/reports/tabulation", requireUserType(...allowedRoles), ExamController.getTabulationSheet);
router.get("/reports/analytics", requireUserType(...allowedRoles), ExamController.getAnalytics);

// Certificates
router.get("/certificates", requireUserType(...allowedRoles), ExamController.getCertificates);
router.post("/certificates", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), validate(CertificateSchema), ExamController.issueCertificate);

export default router;
