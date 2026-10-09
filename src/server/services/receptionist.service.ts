import mongoose, { ClientSession } from "mongoose";
import { randomUUID } from "crypto";
import { Admission, AdmissionStatus } from "../models/admission.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { Student } from "../models/student.model";
import { Visitor } from "../models/visitor.model";
import { Appointment } from "../models/appointment.model";
import { FrontDeskRequest } from "../models/frontDeskRequest.model";
import { Announcement } from "../models/announcement.model";
import { SchoolAdminService } from "./schoolAdmin.service";

export class ReceptionistService {
  // 1. DASHBOARD METRICS & RECENT ACTIVITY
  static async getDashboard(schoolId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      todayAdmissions,
      pendingAdmissions,
      totalAdmitted,
      todayVisitors,
      inPremisesVisitors,
      todayAppointments,
      pendingRequests,
      totalStudents,
      recentInquiries,
      recentVisitors,
      todayUpcomingAppointments,
      recentRequests,
      announcements,
    ] = await Promise.all([
      Admission.countDocuments({ schoolId, inquiryDate: { $gte: todayStart } }),
      Admission.countDocuments({ schoolId, status: { $in: ["NEW", "CONTACTED", "FOLLOW_UP", "APPLIED"] } }),
      Admission.countDocuments({ schoolId, status: "ADMITTED" }),
      Visitor.countDocuments({ schoolId, checkInTime: { $gte: todayStart } }),
      Visitor.countDocuments({ schoolId, status: "IN_PREMISES" }),
      Appointment.countDocuments({ schoolId, appointmentDate: { $gte: todayStart, $lte: todayEnd } }),
      FrontDeskRequest.countDocuments({ schoolId, status: "PENDING" }),
      Student.countDocuments({ schoolId, status: "ACTIVE" }),
      Admission.find({ schoolId })
        .populate("applyingClassId", "name")
        .sort({ inquiryDate: -1 })
        .limit(5)
        .lean(),
      Visitor.find({ schoolId })
        .sort({ checkInTime: -1 })
        .limit(5)
        .lean(),
      Appointment.find({ schoolId, appointmentDate: { $gte: todayStart, $lte: todayEnd } })
        .sort({ appointmentDate: 1 })
        .limit(5)
        .lean(),
      FrontDeskRequest.find({ schoolId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Announcement.find({
        schoolId,
        isPublished: true,
        $or: [
          { targetRoles: { $exists: false } },
          { targetRoles: { $size: 0 } },
          { targetRoles: { $in: ["RECEPTIONIST", "ADMISSION", "ALL_SCHOOL"] } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
    ]);

    return {
      metrics: {
        todayAdmissions,
        pendingAdmissions,
        totalAdmitted,
        todayVisitors,
        inPremisesVisitors,
        todayAppointments,
        pendingRequests,
        totalStudents,
      },
      recentInquiries,
      recentVisitors,
      todayUpcomingAppointments,
      recentRequests,
      announcements,
    };
  }

  // 2. ADMISSIONS & INQUIRIES
  static async getAdmissions(
    schoolId: string,
    options: {
      search?: string;
      status?: string;
      classId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const query: any = { schoolId };
    if (options.status && options.status !== "ALL") query.status = options.status;
    if (options.classId) query.applyingClassId = options.classId;
    if (options.from || options.to) {
      query.inquiryDate = {
        ...(options.from ? { $gte: new Date(`${options.from}T00:00:00`) } : {}),
        ...(options.to ? { $lte: new Date(`${options.to}T23:59:59.999`) } : {}),
      };
    }
    if (options.search?.trim()) {
      const term = options.search.trim();
      query.$or = [
        "studentName",
        "guardianName",
        "guardianPhone",
        "applicationNumber",
        "admissionNumber",
      ].map((key) => ({
        [key]: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
      }));
    }
    const [items, total] = await Promise.all([
      Admission.find(query)
        .populate("applyingClassId", "name")
        .populate("academicSessionId", "name")
        .populate("studentId", "name admissionNumber rollNumber")
        .sort({ inquiryDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Admission.countDocuments(query),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async createAdmission(schoolId: string, data: any) {
    const [linkedClass, session] = await Promise.all([
      ClassModel.findOne({ _id: data.applyingClassId, schoolId }).select("name"),
      AcademicSession.findOne({ _id: data.academicSessionId, schoolId }).select("name"),
    ]);
    if (!linkedClass || !session) {
      throw { statusCode: 400, message: "Select a class and academic session belonging to this school." };
    }
    const year = new Date().getFullYear();
    return Admission.create({
      ...data,
      schoolId,
      applicationNumber: `APP-${year}-${randomUUID().slice(0, 8).toUpperCase()}`,
      applyingClassName: linkedClass.name,
      academicSessionName: session.name,
      inquiryDate: new Date(),
      status: data.status || "NEW",
    });
  }

  static async updateAdmission(
    schoolId: string,
    admissionId: string,
    data: {
      status?: AdmissionStatus;
      followUpDate?: Date | null;
      notes?: string;
      documentsStatus?: "PENDING" | "PARTIAL" | "COMPLETE";
    }
  ) {
    const admission = await Admission.findOne({ _id: admissionId, schoolId });
    if (!admission) throw { statusCode: 404, message: "Admission record not found." };
    if (
      ["ADMITTED", "REJECTED", "CANCELLED"].includes(admission.status) &&
      data.status &&
      data.status !== admission.status
    ) {
      throw { statusCode: 409, message: "This admission record is closed and cannot change status." };
    }
    if (data.status) admission.status = data.status;
    if (data.followUpDate !== undefined) admission.followUpDate = data.followUpDate || undefined;
    if (data.notes !== undefined) admission.notes = data.notes;
    if (data.documentsStatus) admission.documentsStatus = data.documentsStatus;
    return admission.save();
  }

  static async admitStudent(schoolId: string, admissionId: string, data: any) {
    const admission = await Admission.findOne({ _id: admissionId, schoolId });
    if (!admission) throw { statusCode: 404, message: "Admission record not found." };
    if (admission.status !== "APPROVED") {
      throw { statusCode: 409, message: "Approve this application before enrolling the student." };
    }
    if (admission.studentId) {
      throw { statusCode: 409, message: "This admission is already linked to a student record." };
    }
    const section = await SectionModel.findOne({
      _id: data.sectionId,
      classId: admission.applyingClassId,
      schoolId,
    });
    if (!section) throw { statusCode: 400, message: "Select a section under the requested applying class." };
    const admissionNumber = `ADM-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      const dbSession = await mongoose.startSession();
      try {
        let student: any;
        await dbSession.withTransaction(async () => {
          student = await SchoolAdminService.createStudent(
            schoolId,
            {
              name: admission.studentName,
              dob: data.dob,
              gender: data.gender,
              classId: admission.applyingClassId,
              sectionId: section._id,
              academicSessionId: admission.academicSessionId,
              admissionNumber,
              admissionDate: new Date(),
              address: data.address,
              phone: data.phone,
              photoUrl: data.photoUrl,
              parentInfo: {
                fatherName: admission.guardianName,
                fatherPhone: admission.guardianPhone,
                fatherCnic: data.fatherCnic,
                fatherOccupation: data.fatherOccupation,
                motherName: data.motherName,
                motherPhone: data.motherPhone,
                guardianName: admission.guardianName,
                guardianPhone: admission.guardianPhone,
                guardianEmail: admission.guardianEmail || data.guardianEmail,
                guardianRelation: data.guardianRelation || "Guardian",
              },
              emergencyContact: {
                name: data.emergencyName || admission.guardianName,
                phone: data.emergencyPhone || admission.guardianPhone,
                relation: data.emergencyRelation || "Guardian",
              },
            },
            dbSession,
            false
          );
          admission.status = "ADMITTED";
          admission.studentId = student._id;
          admission.admissionNumber = student.admissionNumber;
          admission.admittedAt = new Date();
          await admission.save({ session: dbSession });
        });
        return student;
      } finally {
        await dbSession.endSession();
      }
    } catch (txnErr: any) {
      if (txnErr?.statusCode) throw txnErr;

      const student = await SchoolAdminService.createStudent(
        schoolId,
        {
          name: admission.studentName,
          dob: data.dob,
          gender: data.gender,
          classId: admission.applyingClassId,
          sectionId: section._id,
          academicSessionId: admission.academicSessionId,
          admissionNumber,
          admissionDate: new Date(),
          address: data.address,
          phone: data.phone,
          photoUrl: data.photoUrl,
          parentInfo: {
            fatherName: admission.guardianName,
            fatherPhone: admission.guardianPhone,
            fatherCnic: data.fatherCnic,
            fatherOccupation: data.fatherOccupation,
            motherName: data.motherName,
            motherPhone: data.motherPhone,
            guardianName: admission.guardianName,
            guardianPhone: admission.guardianPhone,
            guardianEmail: admission.guardianEmail || data.guardianEmail,
            guardianRelation: data.guardianRelation || "Guardian",
          },
          emergencyContact: {
            name: data.emergencyName || admission.guardianName,
            phone: data.emergencyPhone || admission.guardianPhone,
            relation: data.emergencyRelation || "Guardian",
          },
        },
        undefined,
        false
      );
      admission.status = "ADMITTED";
      admission.studentId = student._id;
      admission.admissionNumber = student.admissionNumber;
      admission.admittedAt = new Date();
      await admission.save();
      return student;
    }
  }

  // 3. STUDENTS & PARENTS (RECEPTIONIST VIEW)
  static async getStudents(
    schoolId: string,
    options: {
      search?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const query: any = { schoolId };

    if (options.status && options.status !== "ALL") {
      query.status = options.status;
    } else {
      query.status = { $ne: "ARCHIVED" };
    }
    if (options.classId) query.classId = options.classId;
    if (options.sectionId) query.sectionId = options.sectionId;

    if (options.search?.trim()) {
      const term = options.search.trim();
      const regex = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      query.$or = [
        { name: regex },
        { rollNumber: regex },
        { admissionNumber: regex },
        { studentId: regex },
        { phone: regex },
        { "parentInfo.fatherName": regex },
        { "parentInfo.fatherPhone": regex },
        { "parentInfo.guardianName": regex },
        { "parentInfo.guardianPhone": regex },
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate("classId", "name code")
        .populate("sectionId", "name")
        .populate("academicSessionId", "name")
        .select(
          "name studentId admissionNumber rollNumber classId className sectionId sectionName status dob gender phone parentInfo admissionDate address photoUrl"
        )
        .sort({ rollNumber: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(query),
    ]);

    return { students, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async getStudentById(schoolId: string, studentId: string) {
    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name code")
      .populate("sectionId", "name roomNumber")
      .populate("academicSessionId", "name isCurrent")
      .select("-__v")
      .lean();

    if (!student) throw { statusCode: 404, message: "Student record not found in your school." };
    return student;
  }

  static async getParents(
    schoolId: string,
    options: { search?: string; classId?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const query: any = { schoolId, status: "ACTIVE" };

    if (options.classId) query.classId = options.classId;
    if (options.search?.trim()) {
      const term = options.search.trim();
      const regex = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      query.$or = [
        { "parentInfo.fatherName": regex },
        { "parentInfo.fatherPhone": regex },
        { "parentInfo.motherName": regex },
        { "parentInfo.guardianName": regex },
        { "parentInfo.guardianPhone": regex },
        { name: regex },
        { rollNumber: regex },
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .select("name rollNumber className sectionName parentInfo emergencyContact address phone")
        .sort({ "parentInfo.fatherName": 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(query),
    ]);

    const parents = students.map((s) => ({
      _id: s._id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      className: s.className,
      sectionName: s.sectionName,
      fatherName: s.parentInfo?.fatherName || "—",
      fatherPhone: s.parentInfo?.fatherPhone || "—",
      fatherOccupation: s.parentInfo?.fatherOccupation || "—",
      motherName: s.parentInfo?.motherName || "—",
      motherPhone: s.parentInfo?.motherPhone || "—",
      guardianName: s.parentInfo?.guardianName || s.parentInfo?.fatherName || "—",
      guardianPhone: s.parentInfo?.guardianPhone || s.parentInfo?.fatherPhone || "—",
      guardianEmail: s.parentInfo?.guardianEmail || "—",
      guardianRelation: s.parentInfo?.guardianRelation || "Father",
      address: s.address || "—",
      emergencyContact: s.emergencyContact,
    }));

    return { parents, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // 4. VISITOR MANAGEMENT
  static async getVisitors(
    schoolId: string,
    options: {
      search?: string;
      status?: string;
      date?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const query: any = { schoolId };

    if (options.status && options.status !== "ALL") {
      query.status = options.status;
    }
    if (options.date) {
      const d = new Date(options.date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      query.checkInTime = { $gte: start, $lte: end };
    }
    if (options.search?.trim()) {
      const term = options.search.trim();
      const regex = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      query.$or = [
        { visitorName: regex },
        { phone: regex },
        { personToMeet: regex },
        { purpose: regex },
        { studentName: regex },
      ];
    }

    const [visitors, total] = await Promise.all([
      Visitor.find(query)
        .sort({ checkInTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Visitor.countDocuments(query),
    ]);

    return { visitors, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async createVisitor(schoolId: string, data: any, recordedBy?: string) {
    if (!data.visitorName || !data.phone || !data.purpose || !data.personToMeet) {
      throw { statusCode: 400, message: "Visitor name, phone, purpose, and person to meet are required." };
    }
    return Visitor.create({
      ...data,
      schoolId,
      checkInTime: new Date(),
      status: "IN_PREMISES",
      recordedBy,
    });
  }

  static async checkoutVisitor(schoolId: string, visitorId: string) {
    const visitor = await Visitor.findOne({ _id: visitorId, schoolId });
    if (!visitor) throw { statusCode: 404, message: "Visitor record not found." };
    visitor.status = "CHECKED_OUT";
    visitor.checkOutTime = new Date();
    return visitor.save();
  }

  // 5. APPOINTMENTS
  static async getAppointments(
    schoolId: string,
    options: {
      search?: string;
      status?: string;
      date?: string;
      department?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const query: any = { schoolId };

    if (options.status && options.status !== "ALL") {
      query.status = options.status;
    }
    if (options.department && options.department !== "ALL") {
      query.department = options.department;
    }
    if (options.date) {
      const d = new Date(options.date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      query.appointmentDate = { $gte: start, $lte: end };
    }
    if (options.search?.trim()) {
      const term = options.search.trim();
      const regex = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      query.$or = [
        { visitorName: regex },
        { phone: regex },
        { personToMeet: regex },
        { purpose: regex },
      ];
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .sort({ appointmentDate: 1, timeSlot: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(query),
    ]);

    return { appointments, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async createAppointment(schoolId: string, data: any, bookedBy?: string) {
    if (!data.visitorName || !data.phone || !data.purpose || !data.personToMeet || !data.appointmentDate || !data.timeSlot) {
      throw { statusCode: 400, message: "Visitor name, phone, purpose, person to meet, date, and time slot are required." };
    }
    return Appointment.create({
      ...data,
      schoolId,
      status: data.status || "SCHEDULED",
      bookedBy,
    });
  }

  static async updateAppointment(schoolId: string, appointmentId: string, data: any) {
    const appointment = await Appointment.findOne({ _id: appointmentId, schoolId });
    if (!appointment) throw { statusCode: 404, message: "Appointment record not found." };

    if (data.status) appointment.status = data.status;
    if (data.appointmentDate) appointment.appointmentDate = new Date(data.appointmentDate);
    if (data.timeSlot) appointment.timeSlot = data.timeSlot;
    if (data.notes !== undefined) appointment.notes = data.notes;
    if (data.personToMeet) appointment.personToMeet = data.personToMeet;
    if (data.department) appointment.department = data.department;

    return appointment.save();
  }

  // 6. FRONT DESK REQUESTS
  static async getRequests(
    schoolId: string,
    options: {
      search?: string;
      status?: string;
      requestType?: string;
      department?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const query: any = { schoolId };

    if (options.status && options.status !== "ALL") query.status = options.status;
    if (options.requestType && options.requestType !== "ALL") query.requestType = options.requestType;
    if (options.department && options.department !== "ALL") query.assignedDepartment = options.department;

    if (options.search?.trim()) {
      const term = options.search.trim();
      const regex = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      query.$or = [
        { requesterName: regex },
        { phone: regex },
        { requestNumber: regex },
        { studentName: regex },
        { details: regex },
      ];
    }

    const [requests, total] = await Promise.all([
      FrontDeskRequest.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FrontDeskRequest.countDocuments(query),
    ]);

    return { requests, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async createRequest(schoolId: string, data: any, recordedBy?: string) {
    if (!data.requesterName || !data.phone || !data.details) {
      throw { statusCode: 400, message: "Requester name, phone, and request details are required." };
    }
    const year = new Date().getFullYear();
    const requestNumber = `REQ-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;

    return FrontDeskRequest.create({
      ...data,
      schoolId,
      requestNumber,
      status: "PENDING",
      recordedBy,
    });
  }

  static async updateRequest(schoolId: string, requestId: string, data: any) {
    const request = await FrontDeskRequest.findOne({ _id: requestId, schoolId });
    if (!request) throw { statusCode: 404, message: "Request record not found." };

    if (data.status) request.status = data.status;
    if (data.assignedDepartment) request.assignedDepartment = data.assignedDepartment;
    if (data.resolutionNotes !== undefined) request.resolutionNotes = data.resolutionNotes;

    return request.save();
  }

  // 7. NOTIFICATIONS & ALERTS
  static async getNotifications(schoolId: string) {
    const today = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [pendingFollowUps, todayAppointments, pendingRequests, announcements] = await Promise.all([
      Admission.find({
        schoolId,
        followUpDate: { $lte: todayEnd },
        status: { $in: ["NEW", "CONTACTED", "FOLLOW_UP"] },
      })
        .select("studentName guardianName guardianPhone followUpDate status applyingClassName")
        .sort({ followUpDate: 1 })
        .limit(10)
        .lean(),
      Appointment.find({
        schoolId,
        appointmentDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: todayEnd,
        },
        status: "SCHEDULED",
      })
        .sort({ appointmentDate: 1 })
        .limit(10)
        .lean(),
      FrontDeskRequest.find({
        schoolId,
        status: "PENDING",
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Announcement.find({
        schoolId,
        isPublished: true,
        $or: [
          { targetRoles: { $exists: false } },
          { targetRoles: { $size: 0 } },
          { targetRoles: { $in: ["RECEPTIONIST", "ADMISSION", "ALL_SCHOOL"] } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const totalUnread =
      pendingFollowUps.length + todayAppointments.length + pendingRequests.length;

    return {
      totalUnread,
      pendingFollowUps,
      todayAppointments,
      pendingRequests,
      announcements,
    };
  }

  // 8. ACADEMIC LOOKUP HELPERS
  static getClasses(schoolId: string) {
    return SchoolAdminService.getClasses(schoolId);
  }

  static getSections(schoolId: string, classId: string) {
    return SchoolAdminService.getSections(schoolId, classId);
  }

  static getAcademicSessions(schoolId: string) {
    return SchoolAdminService.getAcademicSessions(schoolId);
  }
}
