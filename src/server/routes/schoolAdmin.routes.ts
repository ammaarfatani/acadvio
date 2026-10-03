import { Router } from "express";
import { SchoolAdminController } from "../controllers/schoolAdmin.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { requireExactUserType } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import { StudentCreateSchema, StudentUpdateSchema, ClassCreateSchema, SectionCreateSchema, SubjectCreateSchema, FeeStructureSchema, FeeBatchSchema, CollectPaymentSchema, ExpenseSchema, ExamScheduleSchema, AnnouncementSchema, AcademicSessionSchema, TimetableSlotSchema, TeacherAdminCreateSchema, TeacherAdminUpdateSchema } from "../validators/domain.validator";

const router = Router();

// Protect all school admin routes with authentication and strict tenant enforcement
router.use(authenticate, requireExactUserType(UserType.SCHOOL_ADMIN), enforceSchoolTenant);

// Dashboard
router.get("/dashboard", SchoolAdminController.getDashboard);
router.get("/teachers", requirePermission("teachers.view"), SchoolAdminController.getTeachers);
router.get("/teachers/:teacherId/history", requirePermission("teachers.view"), SchoolAdminController.getTeacherHistory);
router.post("/teachers", requirePermission("teachers.create"), validate(TeacherAdminCreateSchema), SchoolAdminController.createTeacher);
router.put("/teachers/:teacherId", requirePermission("teachers.update"), validate(TeacherAdminUpdateSchema), SchoolAdminController.updateTeacher);
router.get("/academic-sessions", requirePermission("settings.view"), SchoolAdminController.getAcademicSessions);
router.post("/academic-sessions", requirePermission("settings.update"), validate(AcademicSessionSchema), SchoolAdminController.createAcademicSession);
router.patch("/academic-sessions/:sessionId/current", requirePermission("settings.update"), SchoolAdminController.setCurrentAcademicSession);
router.get("/timetable", requirePermission("settings.view"), SchoolAdminController.getTimetable);
router.post("/timetable", requirePermission("settings.update"), validate(TimetableSlotSchema), SchoolAdminController.createTimetableSlot);

// Students
router.get("/students", requirePermission("students.view"), SchoolAdminController.getStudents);
router.get("/students/next-roll-number", requirePermission("students.create"), SchoolAdminController.getNextStudentRollNumber);
router.get("/students/:studentId/history", requirePermission("students.view"), SchoolAdminController.getStudentHistory);
router.post("/students", requirePermission("students.create"), validate(StudentCreateSchema), SchoolAdminController.createStudent);
router.put("/students/:studentId", requirePermission("students.update"), validate(StudentUpdateSchema), SchoolAdminController.updateStudent);

// Classes & Sections
router.get("/classes", requirePermission("settings.view"), SchoolAdminController.getClasses);
router.post("/classes", requirePermission("settings.update"), validate(ClassCreateSchema), SchoolAdminController.createClass);
router.get("/sections", requirePermission("settings.view"), SchoolAdminController.getSections);
router.post("/sections", requirePermission("settings.update"), validate(SectionCreateSchema), SchoolAdminController.createSection);
router.get("/class-teacher-assignments", requirePermission("settings.view"), SchoolAdminController.getClassTeacherAssignments);
router.put("/class-teacher-assignments", requirePermission("settings.update"), SchoolAdminController.setClassTeacherAssignment);

// Subjects
router.get("/subjects", requirePermission("settings.view"), SchoolAdminController.getSubjects);
router.post("/subjects", requirePermission("settings.update"), validate(SubjectCreateSchema), SchoolAdminController.createSubject);

// Attendance is reporting only for School Admins.
router.get("/attendance/reports", requirePermission("attendance.view"), SchoolAdminController.getAttendanceReports);

// Fees & Expenses
router.get("/finance/summary", requirePermission("fees.view"), SchoolAdminController.getFinanceSummary);
router.get("/reports/summary", requirePermission("reports.view"), SchoolAdminController.getReportsSummary);
router.get("/fees/structures", requirePermission("fees.view"), SchoolAdminController.getFeeStructures);
router.post("/fees/structures", requirePermission("fees.update"), validate(FeeStructureSchema), SchoolAdminController.createFeeStructure);
router.post("/fees/generate-batch", requirePermission("fees.update"), validate(FeeBatchSchema), SchoolAdminController.generateChallansBatch);
router.get("/fees/challans", requirePermission("fees.view"), SchoolAdminController.getFeeChallans);
router.post("/fees/collect-payment", requirePermission("fees.collect"), validate(CollectPaymentSchema), SchoolAdminController.collectPayment);
router.get("/expenses", requirePermission("fees.view"), SchoolAdminController.getExpenses);
router.post("/expenses", requirePermission("fees.update"), validate(ExpenseSchema), SchoolAdminController.createExpense);

// Exams
router.get("/exams", requirePermission("exams.view"), SchoolAdminController.getExamSchedules);
router.post("/exams", requirePermission("exams.manage"), validate(ExamScheduleSchema), SchoolAdminController.createExamSchedule);
router.get("/exams/marks", requirePermission("exams.view"), SchoolAdminController.getMarks);
router.post("/exams/marks", requirePermission("exams.manage"), SchoolAdminController.saveMarks);
router.get("/exams/results", requirePermission("exams.view"), SchoolAdminController.getResults);

// Announcements
router.get("/announcements", SchoolAdminController.getAnnouncements);
router.post("/announcements", requirePermission("settings.update"), validate(AnnouncementSchema), SchoolAdminController.createAnnouncement);

export default router;
