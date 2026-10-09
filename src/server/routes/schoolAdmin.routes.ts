import {z} from "zod";
import {AcademicSession} from "../models/academicSession.model";
import {sendSuccess} from "../utils/response.util";
import { Router } from "express";
import { SchoolAdminController } from "../controllers/schoolAdmin.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { requireExactUserType } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import { StudentCreateSchema, StudentUpdateSchema, ClassCreateSchema, SectionCreateSchema, SubjectCreateSchema, FeeStructureSchema, FeeBatchSchema, CollectPaymentSchema, ExpenseSchema, ExamScheduleSchema, AnnouncementSchema, AcademicSessionSchema, TimetableSlotSchema, TeacherAdminCreateSchema, TeacherAdminUpdateSchema } from "../validators/domain.validator";

import rateLimit from "express-rate-limit";
import { bulkImportHandlers, previewImportSchema, commitImportSchema } from "../controllers/bulkImport.controller";

const router = Router();

// Protect all school admin routes with authentication and strict tenant enforcement
router.use(authenticate, requireExactUserType(UserType.SCHOOL_ADMIN), enforceSchoolTenant);

const importLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many import uploads. Please wait before trying again." } });
for (const entity of ["students", "teachers"] as const) {
  const handlers = bulkImportHandlers(entity);
  const permission = requirePermission(`${entity}.create`);
  router.get(`/${entity}/bulk-import/template`, permission, handlers.template);
  router.post(`/${entity}/bulk-import/preview`, permission, importLimiter, validate(previewImportSchema), handlers.preview);
  router.get(`/${entity}/bulk-import/:importId`, permission, handlers.status);
  router.post(`/${entity}/bulk-import/:importId/commit`, permission, validate(commitImportSchema), handlers.commit);
  router.get(`/${entity}/bulk-import/:importId/errors`, permission, handlers.errors);
}


// Dashboard
router.get("/dashboard", SchoolAdminController.getDashboard);
router.get("/teachers", requirePermission("teachers.view"), SchoolAdminController.getTeachers);
router.get("/teachers/:teacherId/history", requirePermission("teachers.view"), SchoolAdminController.getTeacherHistory);
router.post("/teachers", requirePermission("teachers.create"), validate(TeacherAdminCreateSchema), SchoolAdminController.createTeacher);
router.put("/teachers/:teacherId", requirePermission("teachers.update"), validate(TeacherAdminUpdateSchema), SchoolAdminController.updateTeacher);
router.get("/academic-sessions", requirePermission("settings.view"), SchoolAdminController.getAcademicSessions);
router.post("/academic-sessions", requirePermission("settings.update"), validate(AcademicSessionSchema), SchoolAdminController.createAcademicSession);
router.patch("/academic-sessions/:sessionId/current", requirePermission("settings.update"), SchoolAdminController.setCurrentAcademicSession);
router.put("/academic-sessions/:sessionId",requirePermission("settings.update"),validate(AcademicSessionSchema),async(req,res,next)=>{try{const sessionId=z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.sessionId);const {isCurrent,...fields}=req.body;const session=await AcademicSession.findOneAndUpdate({_id:sessionId,schoolId:req.user!.schoolId},{$set:fields},{new:true,runValidators:true});if(!session)throw {statusCode:404,message:"Session not found."};return sendSuccess(res,session,"Session updated.");}catch(e){next(e);}});
router.patch("/academic-sessions/:sessionId/archive",requirePermission("settings.update"),async(req,res,next)=>{try{const sessionId=z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.sessionId),{archived}=z.object({archived:z.boolean()}).strict().parse(req.body);const session=await AcademicSession.findOne({_id:sessionId,schoolId:req.user!.schoolId});if(!session)throw {statusCode:404,message:"Session not found."};if(archived&&session.isCurrent)throw {statusCode:409,message:"Set another current session before archiving this one."};session.isArchived=archived;await session.save();return sendSuccess(res,session,archived?"Session archived. Records are preserved.":"Session restored.");}catch(e){next(e);}});
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
router.post("/announcements", requirePermission("notices.manage"), validate(AnnouncementSchema), SchoolAdminController.createAnnouncement);

export default router;
