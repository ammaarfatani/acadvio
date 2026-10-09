import { Request, Response, NextFunction } from "express";
import { ExamService } from "../services/exam.service";
import { SchoolAdminService } from "../services/schoolAdmin.service";
import { sendSuccess } from "../utils/response.util";

export class ExamController {
  // Dashboard Metrics
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const metrics = await ExamService.getDashboardMetrics(schoolId);
      return sendSuccess(res, metrics, "Examination dashboard metrics retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Exam Schedules
  static async getExams(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const exams = await ExamService.getExams(schoolId);
      return sendSuccess(res, exams, "Exam schedules retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createExam(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const exam = await ExamService.createExam(schoolId, req.body);
      return sendSuccess(res, exam, "Exam schedule created successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Configurable Grading Scale
  static async getGradingScale(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const scale = await ExamService.getGradingScale(schoolId);
      return sendSuccess(res, scale, "School grading scale rules retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async updateGradingScale(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const { rules } = req.body;
      const scale = await ExamService.updateGradingScale(schoolId, rules);
      return sendSuccess(res, scale, "Grading scale rules updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  // Marks Entry & Lookup
  static async getMarks(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const { examId, classId, subjectId, sectionId } = req.query;
      const marks = await ExamService.getMarks(
        schoolId,
        examId as string,
        classId as string,
        subjectId as string,
        sectionId as string
      );
      return sendSuccess(res, marks, "Exam marks retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async saveMarksEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Exam Officer";
      const doc = await ExamService.saveMarksEntry(schoolId, req.body, userName);
      return sendSuccess(res, doc, "Marks entry saved and grades calculated.");
    } catch (error) {
      next(error);
    }
  }

  // Result Processing & Merit Position Ranking
  static async getResults(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const { examId, classId } = req.query;
      const results = await ExamService.getResults(schoolId, examId as string, classId as string);
      return sendSuccess(res, results, "Exam results retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async processResults(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Exam Officer";
      const { examId, classId } = req.body;

      const result = await ExamService.processResults(schoolId, examId, classId, userName);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // Result Publishing & Unpublishing
  static async publishResults(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Exam Officer";
      const { examId, classId, publish } = req.body;

      const result = await ExamService.publishResults(schoolId, examId, classId, Boolean(publish), userName);
      return sendSuccess(res, result, `Exam results ${publish ? "published" : "unpublished"} successfully.`);
    } catch (error) {
      next(error);
    }
  }

  // Reports: Tabulation Sheet & Analytics
  static async getTabulationSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const { examId, classId } = req.query;
      if (!examId || !classId) throw { statusCode: 400, message: "Exam ID and Class ID are required for tabulation sheet." };

      const sheet = await ExamService.getTabulationSheet(schoolId, examId as string, classId as string);
      return sendSuccess(res, sheet, "Tabulation sheet retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const { examId, classId } = req.query;
      const analytics = await ExamService.getAnalytics(schoolId, examId as string, classId as string);
      return sendSuccess(res, analytics, "Examination performance analytics retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Certificates
  static async getCertificates(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const certs = await ExamService.getCertificates(schoolId);
      return sendSuccess(res, certs, "Issued certificates retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async issueCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Exam Officer";
      const cert = await ExamService.issueCertificate(schoolId, req.body, userName);
      return sendSuccess(res, cert, "Certificate issued successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  // Lookup Helpers for Dropdowns
  static async getClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };
      const classes = await SchoolAdminService.getClasses(schoolId);
      return sendSuccess(res, classes, "Classes retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getSections(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };
      const classId = req.query.classId as string;
      const sections = await SchoolAdminService.getSections(schoolId, classId);
      return sendSuccess(res, sections, "Sections retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };
      const classId = req.query.classId as string;
      const subjects = await SchoolAdminService.getSubjects(schoolId, classId);
      return sendSuccess(res, subjects, "Subjects retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };
      const sessions = await SchoolAdminService.getAcademicSessions(schoolId);
      return sendSuccess(res, sessions, "Academic sessions retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };
      const { classId, sectionId } = req.query;
      let students = await SchoolAdminService.getStudents(schoolId, classId as string);
      if (sectionId) {
        students = students.filter((s: any) => String(s.sectionId) === String(sectionId));
      }
      return sendSuccess(res, students, "Students list retrieved.");
    } catch (error) {
      next(error);
    }
  }
}
