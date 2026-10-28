import { Request, Response, NextFunction } from "express";
import { SchoolAdminService } from "../services/schoolAdmin.service";
import { TeacherService } from "../services/teacher.service";
import { sendSuccess } from "../utils/response.util";

export class SchoolAdminController {
  static async getClassTeacherAssignments(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.getClassTeacherAssignments(schoolId), "Class teacher assignments retrieved."); } catch (error) { next(error); }
  }
  static async setClassTeacherAssignment(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.setClassTeacherAssignment(schoolId, req.body), "Class teacher assigned for the current session."); } catch (error) { next(error); }
  }
  // Dashboard
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const data = await SchoolAdminService.getDashboardMetrics(schoolId);
      return sendSuccess(res, data, "School dashboard metrics retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Students
  static async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const classId = req.query.classId as string | undefined;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const students = await SchoolAdminService.getStudents(schoolId, classId, search, status);
      return sendSuccess(res, students, "Students directory retrieved.");
    } catch (error) {
      next(error);
    }
  }
  static async getNextStudentRollNumber(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; if (typeof req.query.classId !== "string") throw { statusCode: 400, message: "Select a class to preview a roll number." }; const rollNumber = await SchoolAdminService.getNextStudentRollNumber(schoolId, req.query.classId, req.query.sectionId as string | undefined, req.query.academicSessionId as string | undefined); return sendSuccess(res, { rollNumber }, "Next roll number generated."); } catch (error) { next(error); }
  }

  static async createStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const student = await SchoolAdminService.createStudent(schoolId, req.body);
      return sendSuccess(res, {...student.toObject(),primaryParent:student.$locals.primaryParent}, "Student admitted successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const student = await SchoolAdminService.updateStudent(schoolId, req.params.studentId as string, req.body);
      return sendSuccess(res, student, "Student profile updated.");
    } catch (error) {
      next(error);
    }
  }

  // Classes & Sections
  static async getClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const classes = await SchoolAdminService.getClasses(schoolId);
      return sendSuccess(res, classes, "Classes list retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createClass(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const newClass = await SchoolAdminService.createClass(schoolId, req.body);
      return sendSuccess(res, newClass, "Class created.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async getSections(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const classId = req.query.classId as string | undefined;
      const sections = await SchoolAdminService.getSections(schoolId, classId);
      return sendSuccess(res, sections, "Sections list retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createSection(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const section = await SchoolAdminService.createSection(schoolId, req.body);
      return sendSuccess(res, section, "Section created.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Subjects
  static async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const classId = req.query.classId as string | undefined;
      const subjects = await SchoolAdminService.getSubjects(schoolId, classId);
      return sendSuccess(res, subjects, "Subjects list retrieved.");
    } catch (error) {
      next(error);
    }
  }
  static async getTeachers(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.getSchoolTeachers(schoolId), "School teachers retrieved."); } catch (error) { next(error); }
  }
  static async createTeacher(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.createSchoolTeacher(schoolId, req.body), "Teacher and teaching assignments created.", 201); } catch (error) { next(error); }
  }
  static async updateTeacher(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.updateSchoolTeacher(schoolId, req.params.teacherId as string, req.body), "Teacher profile and assignments updated."); } catch (error) { next(error); }
  }

  static async createSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const subject = await SchoolAdminService.createSubject(schoolId, req.body);
      return sendSuccess(res, subject, "Subject created.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async getAcademicSessions(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.getAcademicSessions(schoolId), "Academic sessions retrieved."); } catch (error) { next(error); }
  }
  static async createAcademicSession(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.createAcademicSession(schoolId, req.body), "Academic session created.", 201); } catch (error) { next(error); }
  }
  static async setCurrentAcademicSession(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.setCurrentAcademicSession(schoolId, req.params.sessionId as string), "Current academic session updated."); } catch (error) { next(error); }
  }
  static async getTimetable(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; const query: any = { schoolId }; if (req.query.academicSessionId) query.academicSessionId = req.query.academicSessionId; if (req.query.classId) query.classId = req.query.classId; if (req.query.sectionId) query.sectionId = req.query.sectionId; if (req.query.dayOfWeek) query.dayOfWeek = req.query.dayOfWeek; const { TimetableSlot } = await import("../models/subject.model"); return sendSuccess(res, await TimetableSlot.find(query).sort({ dayOfWeek: 1, periodNumber: 1 }), "Timetable retrieved."); } catch (error) { next(error); }
  }
  static async createTimetableSlot(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.createTimetableSlot(schoolId, req.body), "Timetable slot created.", 201); } catch (error) { next(error); }
  }
  static async getAttendanceReports(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; const data = await SchoolAdminService.getAdminAttendance(schoolId, req.query.from as string, req.query.to as string, req.query.classId as string, req.query.sectionId as string); return sendSuccess(res, data, "Attendance reports retrieved."); } catch (error) { next(error); }
  }
  static async getFinanceSummary(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.getFinanceSummary(schoolId), "Finance summary retrieved."); } catch (error) { next(error); }
  }
  static async getReportsSummary(req: Request, res: Response, next: NextFunction) {
    try { const schoolId = req.user?.schoolId; if (!schoolId) throw { statusCode: 400, message: "No school tenant context." }; return sendSuccess(res, await SchoolAdminService.getReportsSummary(schoolId), "School report summary retrieved."); } catch (error) { next(error); }
  }

  // Attendance
  static async saveStudentAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const data = { ...req.body, markedByUserId: req.user?.userId, markedByName: req.user?.email };
      const doc = await SchoolAdminService.saveStudentAttendance(schoolId, data);
      return sendSuccess(res, doc, "Student attendance saved.");
    } catch (error) {
      next(error);
    }
  }

  // Fees & Expenses
  static async getFeeStructures(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const fees = await SchoolAdminService.getFeeStructures(schoolId);
      return sendSuccess(res, fees, "Fee structures retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createFeeStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const fee = await SchoolAdminService.createFeeStructure(schoolId, req.body);
      return sendSuccess(res, fee, "Fee structure created.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async generateChallansBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await SchoolAdminService.generateFeeChallansBatch(
        schoolId,
        req.body.classId,
        req.body.className,
        req.body.month,
        req.body.dueDate
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getFeeChallans(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const statusFilter = req.query.status as string | undefined;
      const challans = await SchoolAdminService.getFeeChallans(schoolId, statusFilter);
      return sendSuccess(res, challans, "Fee challans retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async collectPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const cashierName = req.user?.email || "School Cashier";
      const result = await SchoolAdminService.collectFeePayment(
        schoolId,
        req.body.challanId,
        req.body.amountPKR,
        req.body.paymentMethod,
        cashierName,
        req.body.requestId,
        req.body.transactionReference
      );
      return sendSuccess(res, result, "Payment collected & receipt generated.");
    } catch (error) {
      next(error);
    }
  }

  static async getExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const expenses = await SchoolAdminService.getExpenses(schoolId);
      return sendSuccess(res, expenses, "Expense log retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const loggedByName = req.user?.email || "School Admin";
      const expense = await SchoolAdminService.createExpense(schoolId, req.body, loggedByName);
      return sendSuccess(res, expense, "Expense entry created.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Exams
  static async getExamSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const exams = await SchoolAdminService.getExamSchedules(schoolId);
      return sendSuccess(res, exams, "Exam schedules retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createExamSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const exam = await SchoolAdminService.createExamSchedule(schoolId, req.body);
      return sendSuccess(res, exam, "Exam schedule created.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async getMarks(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const { examId, classId, subjectId, sectionId } = req.query;
      const data = await SchoolAdminService.getMarks(
        schoolId,
        examId as string,
        classId as string,
        subjectId as string,
        sectionId as string
      );
      return sendSuccess(res, data, "Marks list retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async saveMarks(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const userName = req.user?.email || "School Admin";
      const doc = await SchoolAdminService.saveMarks(schoolId, req.body, userName);
      return sendSuccess(res, doc, "Marks entry saved successfully.");
    } catch (error) {
      next(error);
    }
  }

  static async getResults(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const { examId, classId } = req.query;
      const results = await SchoolAdminService.getResults(schoolId, examId as string, classId as string);
      return sendSuccess(res, results, "Exam results retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Announcements
  static async getAnnouncements(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const list = await SchoolAdminService.getAnnouncements(schoolId);
      return sendSuccess(res, list, "Announcements list retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const postedByName = req.user?.email || "School Admin";
      const item = await SchoolAdminService.createAnnouncement(schoolId, req.body, postedByName);
      return sendSuccess(res, item, "Announcement posted.", 201);
    } catch (error) {
      next(error);
    }
  }

  // History Drawers
  static async getTeacherHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const teacherUserId = req.params.teacherId as string;
      const data = await SchoolAdminService.getTeacherHistory(schoolId, teacherUserId);
      return sendSuccess(res, data, "Teacher history retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getStudentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const studentId = req.params.studentId as string;
      const data = await TeacherService.getStudentHistory(schoolId, studentId);
      return sendSuccess(res, data, "Student history retrieved.");
    } catch (error) {
      next(error);
    }
  }
}
