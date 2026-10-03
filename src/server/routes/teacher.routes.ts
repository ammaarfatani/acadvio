import { Router } from "express";
import { TeacherController } from "../controllers/teacher.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireUserType } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import { TeacherClassAttendanceSchema, TeacherMarksSchema, LeaveRequestSchema, LeaveReviewSchema } from "../validators/domain.validator";

const router = Router();

// Protect all teacher routes with authentication and strict tenant enforcement
router.use(authenticate, enforceSchoolTenant);

// Dashboard & Scope
router.get("/dashboard", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), TeacherController.getDashboard);
router.get("/my-classes", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), TeacherController.getTeacherClasses);
router.get("/students", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), TeacherController.getAssignedStudents);
router.get("/students/:studentId/history", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), TeacherController.getStudentHistory);
router.get("/timetable", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), TeacherController.getTimetable);
router.get("/attendance", requireUserType(UserType.TEACHER), TeacherController.getAttendanceRoster);
router.get("/attendance/self", requireUserType(UserType.TEACHER), TeacherController.getMyAttendance);
router.get("/class-teacher-sections", requireUserType(UserType.TEACHER), TeacherController.getClassTeacherSections);
router.get("/attendance/reports", requireUserType(UserType.TEACHER), TeacherController.getAttendanceReport);
router.get("/marks/options", requireUserType(UserType.TEACHER), TeacherController.getMarksOptions);
router.get("/notifications", requireUserType(UserType.TEACHER), TeacherController.getNotifications);
router.patch("/notifications/read-all", requireUserType(UserType.TEACHER), TeacherController.markAllNotificationsRead);
router.patch("/notifications/:notificationId/read", requireUserType(UserType.TEACHER), TeacherController.markNotificationRead);

// Attendance & Marks
router.post("/attendance", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), validate(TeacherClassAttendanceSchema), TeacherController.saveAttendance);
router.post("/attendance/self/check-in", requireUserType(UserType.TEACHER), TeacherController.checkIn);
router.post("/attendance/self/check-out", requireUserType(UserType.TEACHER), TeacherController.checkOut);
router.post("/marks", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), validate(TeacherMarksSchema), TeacherController.saveMarks);

// Leave System
router.post("/leave", requireUserType(UserType.TEACHER), validate(LeaveRequestSchema), TeacherController.applyLeave);
router.get("/leave", requireUserType(UserType.TEACHER, UserType.SCHOOL_ADMIN), TeacherController.getLeaves);
router.get("/leave-requests", requireUserType(UserType.SCHOOL_ADMIN), TeacherController.getSchoolLeaveRequests);
router.patch("/leave-requests/:leaveId", requireUserType(UserType.SCHOOL_ADMIN), validate(LeaveReviewSchema), TeacherController.reviewLeave);

export default router;
