import { Request, Response, NextFunction } from "express";
import { ReceptionistService } from "../services/receptionist.service";
import { sendSuccess } from "../utils/response.util";

export class ReceptionistController {
  // 1. DASHBOARD
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const data = await ReceptionistService.getDashboard(schoolId);
      return sendSuccess(res, data, "Receptionist dashboard data retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // 2. ADMISSIONS
  static async getAdmissions(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await ReceptionistService.getAdmissions(schoolId, {
        search: req.query.search as string,
        status: req.query.status as string,
        classId: req.query.classId as string,
        from: req.query.from as string,
        to: req.query.to as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      return sendSuccess(res, result, "Admission register retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createAdmission(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const admission = await ReceptionistService.createAdmission(schoolId, req.body);
      return sendSuccess(res, admission, "Admission inquiry created.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateAdmission(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const updated = await ReceptionistService.updateAdmission(
        schoolId,
        req.params.admissionId as string,
        req.body
      );
      return sendSuccess(res, updated, "Admission record updated.");
    } catch (error) {
      next(error);
    }
  }

  static async admitStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const student = await ReceptionistService.admitStudent(
        schoolId,
        req.params.admissionId as string,
        req.body
      );
      return sendSuccess(res, student, "Student enrolled and linked to the admission record.", 201);
    } catch (error) {
      next(error);
    }
  }

  // 3. STUDENTS & PARENTS
  static async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await ReceptionistService.getStudents(schoolId, {
        search: req.query.search as string,
        classId: req.query.classId as string,
        sectionId: req.query.sectionId as string,
        status: req.query.status as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      return sendSuccess(res, result, "Students directory retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getStudentById(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const student = await ReceptionistService.getStudentById(
        schoolId,
        req.params.studentId as string
      );
      return sendSuccess(res, student, "Student details retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getParents(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await ReceptionistService.getParents(schoolId, {
        search: req.query.search as string,
        classId: req.query.classId as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      return sendSuccess(res, result, "Parents/Guardians directory retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // 4. VISITORS
  static async getVisitors(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await ReceptionistService.getVisitors(schoolId, {
        search: req.query.search as string,
        status: req.query.status as string,
        date: req.query.date as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      return sendSuccess(res, result, "Visitor logs retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createVisitor(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const recordedBy = (req.user as any)?.name || req.user?.email || "Reception Desk";
      const visitor = await ReceptionistService.createVisitor(schoolId, req.body, recordedBy);
      return sendSuccess(res, visitor, "Visitor logged successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async checkoutVisitor(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const visitor = await ReceptionistService.checkoutVisitor(
        schoolId,
        req.params.visitorId as string
      );
      return sendSuccess(res, visitor, "Visitor checked out successfully.");
    } catch (error) {
      next(error);
    }
  }

  // 5. APPOINTMENTS
  static async getAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await ReceptionistService.getAppointments(schoolId, {
        search: req.query.search as string,
        status: req.query.status as string,
        department: req.query.department as string,
        date: req.query.date as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      return sendSuccess(res, result, "Appointments retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const bookedBy = (req.user as any)?.name || req.user?.email || "Reception Desk";
      const appointment = await ReceptionistService.createAppointment(
        schoolId,
        req.body,
        bookedBy
      );
      return sendSuccess(res, appointment, "Appointment booked successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const appointment = await ReceptionistService.updateAppointment(
        schoolId,
        req.params.appointmentId as string,
        req.body
      );
      return sendSuccess(res, appointment, "Appointment updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  // 6. FRONT DESK REQUESTS
  static async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const result = await ReceptionistService.getRequests(schoolId, {
        search: req.query.search as string,
        status: req.query.status as string,
        requestType: req.query.requestType as string,
        department: req.query.department as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      return sendSuccess(res, result, "Front desk requests retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const recordedBy = (req.user as any)?.name || req.user?.email || "Reception Desk";
      const requestRecord = await ReceptionistService.createRequest(
        schoolId,
        req.body,
        recordedBy
      );
      return sendSuccess(res, requestRecord, "Request logged successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const updated = await ReceptionistService.updateRequest(
        schoolId,
        req.params.requestId as string,
        req.body
      );
      return sendSuccess(res, updated, "Request updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  // 7. NOTIFICATIONS
  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const data = await ReceptionistService.getNotifications(schoolId);
      return sendSuccess(res, data, "Receptionist notifications retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // 8. ACADEMIC HELPERS
  static async getClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      return sendSuccess(res, await ReceptionistService.getClasses(schoolId), "School classes retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getSections(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      return sendSuccess(
        res,
        await ReceptionistService.getSections(schoolId, req.params.classId as string),
        "School sections retrieved."
      );
    } catch (error) {
      next(error);
    }
  }

  static async getAcademicSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      return sendSuccess(
        res,
        await ReceptionistService.getAcademicSessions(schoolId),
        "Academic sessions retrieved."
      );
    } catch (error) {
      next(error);
    }
  }
}
