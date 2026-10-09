import { Request, Response, NextFunction } from "express";
import { TeacherService } from "../services/teacher.service";
import { sendSuccess } from "../utils/response.util";

export class TeacherController {
  static async getMyAttendance(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.getMyAttendance(schoolId, teacherId, req.query.from as string, req.query.to as string), "Your attendance history retrieved."); } catch (error) { next(error); }
  }
  static async checkIn(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.checkInTeacher(schoolId, teacherId), "Your attendance has been marked Present."); } catch (error) { next(error); }
  }
  static async checkOut(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.checkOutTeacher(schoolId, teacherId), "Your check-out time has been recorded."); } catch (error) { next(error); }
  }
  static async getClassTeacherSections(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.getClassTeacherSections(schoolId, teacherId), "Your class teacher sections retrieved."); } catch (error) { next(error); }
  }
  static async getTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };
      const timetable = await TeacherService.getTeacherTimetable(schoolId, teacherUserId);
      return sendSuccess(res, timetable, "Teacher timetable retrieved.");
    } catch (error) { next(error); }
  }

  static async getAttendanceRoster(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId; const teacherId = req.user?.userId;
      if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." };
      const { classId, sectionId, date } = req.query;
      if (typeof classId !== "string" || typeof sectionId !== "string" || typeof date !== "string") throw { statusCode: 400, message: "Select a class, section, and date." };
      return sendSuccess(res, await TeacherService.getAttendanceRoster(schoolId, teacherId, classId, sectionId, date), "Assigned student attendance roster retrieved.");
    } catch (error) { next(error); }
  }

  static async getAttendanceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId; const teacherId = req.user?.userId;
      if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." };
      const data = await TeacherService.getTeacherAttendanceReport(schoolId, teacherId, req.query.from as string, req.query.to as string, req.query.classId as string, req.query.sectionId as string);
      return sendSuccess(res, data, "Assigned student attendance history retrieved.");
    } catch (error) { next(error); }
  }

  static async getMarksContexts(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId; const teacherId = req.user?.userId;
      if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." };
      return sendSuccess(res, await TeacherService.getTeacherMarksContexts(schoolId, teacherId), "Assigned examination entries retrieved.");
    } catch (error) { next(error); }
  }

  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.getTeacherNotifications(schoolId, teacherId), "Teacher notifications retrieved."); } catch (error) { next(error); }
  }

  static async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.markTeacherNotificationRead(schoolId, teacherId, req.params.notificationId as string), "Notification marked as read."); } catch (error) { next(error); }
  }

  static async markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.markAllTeacherNotificationsRead(schoolId, teacherId), "All notifications marked as read."); } catch (error) { next(error); }
  }

  static async getMarksOptions(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; const teacherId = req.user?.userId; if (!schoolId || !teacherId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.getTeacherMarksContexts(schoolId, teacherId), "Assigned exams retrieved."); } catch (error) { next(error); }
  }

  // Dashboard
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const data = await TeacherService.getTeacherDashboard(schoolId, teacherUserId);
      return sendSuccess(res, data, "Teacher dashboard metrics retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Assigned Students
  static async getAssignedStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const classId = req.query.classId as string | undefined;
      const sectionId = req.query.sectionId as string | undefined;
      const search = req.query.search as string | undefined;
      const subjectId = req.query.subjectId as string | undefined;

      const students = await TeacherService.getTeacherStudents(schoolId, teacherUserId, classId, search, sectionId, subjectId);
      return sendSuccess(res, students, "Assigned students directory retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Attendance
  static async saveAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const doc = await TeacherService.saveAttendance(schoolId, teacherUserId, req.body, req.user?.userType === "SCHOOL_ADMIN");
      return sendSuccess(res, doc, "Class attendance saved successfully.");
    } catch (error) {
      next(error);
    }
  }

  // Marks Entry
  static async saveMarks(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const doc = await TeacherService.saveMarks(schoolId, teacherUserId, req.body);
      return sendSuccess(res, doc, "Marks entry saved successfully.");
    } catch (error) {
      next(error);
    }
  }

  // Leave System
  static async applyLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const leave = await TeacherService.applyLeave(schoolId, teacherUserId, req.body);
      return sendSuccess(res, leave, "Leave request submitted successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async getLeaves(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const leaves = await TeacherService.getTeacherLeaves(schoolId, teacherUserId);
      return sendSuccess(res, leaves, "Teacher leave requests retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getSchoolLeaveRequests(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No tenant context." }; return sendSuccess(res, await TeacherService.getSchoolLeavesForAdmin(schoolId, req.query.status as string), "School teacher leave requests retrieved."); } catch (error) { next(error); }
  }

  // Timetable Conflict Validator (Admin)
  static async createTimetableSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const slot = await TeacherService.validateAndCreateTimetableSlot(schoolId, req.body);
      return sendSuccess(res, slot, "Timetable slot created without conflict.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Admin Leave Review
  static async reviewLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const reviewerName = req.user?.email || "School Admin";
      const leaveId = req.params.leaveId as string;
      const { status, comment } = req.body;

      const leave = await TeacherService.reviewLeaveRequest(schoolId, leaveId, status, reviewerName, comment);
      return sendSuccess(res, leave, `Leave request ${status.toLowerCase()}.`);
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      const teacherUserId = req.user?.userId;
      if (!schoolId || !teacherUserId) throw { statusCode: 400, message: "No tenant context." };

      const classes = await TeacherService.getTeacherClasses(schoolId, teacherUserId);
      return sendSuccess(res, classes, "Teacher assigned classes retrieved.");
    } catch (error) { next(error); }
  }

  static async getStudentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const studentId = req.params.studentId as string;
      const data = await TeacherService.getStudentHistory(schoolId, studentId, req.user?.userType === "TEACHER" ? req.user.userId : undefined);
      return sendSuccess(res, data, "Student academic history retrieved.");
    } catch (error) { next(error); }
  }
}
