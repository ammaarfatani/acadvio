import {date} from "../validators/workforce.validator";
import {User} from "../models/user.model";
import {annualMarksheet} from "../services/marksheet.service";
import {z} from "zod";
import {examTimetable,saveExamTimetable} from "../services/examTimetable.service";
import {sendSuccess} from "../utils/response.util";
import { Router } from "express";
import { ExamController } from "../controllers/exam.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireUserType,requirePermission } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import { ExamScheduleSchema, GradingScaleSchema, MarksEntrySchema, ProcessResultsSchema, PublishResultsSchema, CertificateSchema } from "../validators/domain.validator";

const router = Router();

// Protect all exam routes with authentication and strict tenant enforcement
router.use(authenticate, enforceSchoolTenant);

// Restricted to EXAM_STAFF, TEACHER, SCHOOL_ADMIN, and SUPER_ADMIN
const allowedRoles = [UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN];

// Dashboard Metrics
router.get("/dashboard", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getDashboard);

// Exam Schedules
router.get("/schedules", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getExams);
router.post("/schedules", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), requirePermission("exams.manage"), validate(ExamScheduleSchema), ExamController.createExam);

// Lookups for Dropdowns & Candidate Management
router.get("/classes", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getClasses);
router.get("/sections", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getSections);
router.get("/subjects", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getSubjects);
router.get("/sessions", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getSessions);
router.get("/students", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getStudents);

router.get("/teachers",requireUserType(...allowedRoles),requirePermission("exams.view"),async(req,res,next)=>{try{return sendSuccess(res,await User.find({schoolId:req.user!.schoolId,userType:"TEACHER",status:"ACTIVE"}).select("name").sort({name:1}).lean());}catch(e){next(e);}});
// Configurable Grading Scale
router.get("/grading-scale", requireUserType(...allowedRoles), requirePermission("exams.view"), ExamController.getGradingScale);
router.put("/grading-scale", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), requirePermission("exams.manage"), validate(GradingScaleSchema), ExamController.updateGradingScale);

// Marks Entry & Lookup
router.get("/marks", requireUserType(...allowedRoles), requirePermission("results.view"), ExamController.getMarks);
router.post("/marks", requireUserType(...allowedRoles), requirePermission("results.enter"), validate(MarksEntrySchema), ExamController.saveMarksEntry);

// Result Processing & Publishing
router.get("/results", requireUserType(...allowedRoles), requirePermission("results.view"), ExamController.getResults);
router.post("/process", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), requirePermission("exams.manage"), validate(ProcessResultsSchema), ExamController.processResults);
router.post("/publish", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), requirePermission("results.publish"), validate(PublishResultsSchema), ExamController.publishResults);

// Reports & Analytics
router.get("/reports/tabulation", requireUserType(...allowedRoles), requirePermission("results.view"), ExamController.getTabulationSheet);
router.get("/reports/analytics", requireUserType(...allowedRoles), requirePermission("results.view"), ExamController.getAnalytics);

// Certificates
router.get("/certificates", requireUserType(...allowedRoles), requirePermission("results.view"), ExamController.getCertificates);
router.post("/certificates", requireUserType(UserType.EXAM_STAFF, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN), requirePermission("results.publish"), validate(CertificateSchema), ExamController.issueCertificate);

const objectId=z.string().regex(/^[a-f0-9]{24}$/i),clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
router.get("/timetable",requireUserType(...allowedRoles),requirePermission("exams.view"),async(req,res,next)=>{try{return sendSuccess(res,await examTimetable(req.user!.schoolId!,req.query.examId?objectId.parse(req.query.examId):undefined));}catch(e){next(e);}});
router.post("/timetable",requireUserType(...allowedRoles),requirePermission("exams.manage"),async(req,res,next)=>{try{const input=z.object({examId:objectId,classId:objectId,sectionId:objectId,subjectId:objectId,supervisorId:objectId.optional(),date,startTime:clock,endTime:clock,room:z.string().trim().max(80).optional()}).strict().refine(s=>s.endTime>s.startTime,"End time must be after start time.").parse(req.body);return sendSuccess(res,await saveExamTimetable(req.user!.schoolId!,input),"Exam timetable saved.");}catch(e){next(e);}});
router.get("/marksheet/:studentId",requireUserType(...allowedRoles),requirePermission("results.view"),async(req,res,next)=>{try{return sendSuccess(res,await annualMarksheet(req.user!.schoolId!,objectId.parse(req.params.studentId)));}catch(e){next(e);}});
export default router;
