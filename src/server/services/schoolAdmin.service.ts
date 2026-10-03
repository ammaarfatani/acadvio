import mongoose from "mongoose";
import { School } from "../models/school.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { Subject, TimetableSlot } from "../models/subject.model";
import { StudentAttendance, TeacherAttendance } from "../models/attendance.model";
import { FeeStructure, FeeChallan, FeePayment, Expense } from "../models/fee.model";
import { randomUUID } from "crypto";
import { ExamSchedule, MarksEntry, ProcessedResult } from "../models/exam.model";
import { Announcement } from "../models/announcement.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassTeacherAssignment } from "../models/classTeacherAssignment.model";
import { TeacherProfile, TeachingAssignment } from "../models/teacherProfile.model";
import { TeacherNotification } from "../models/teacherNotification.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { UserService } from "./user.service";
import { ClientSession, Types } from "mongoose";
import { UserType } from "../constants/roles.constant";
import { SubscriptionEntitlementService } from "./subscriptionEntitlement.service";

export class SchoolAdminService {
  // 1. DASHBOARD METRICS
  static async getDashboardMetrics(schoolId: string) {
    const school = await School.findById(schoolId);
    if (!school) throw { statusCode: 404, message: "School not found." };

    const totalStudents = await Student.countDocuments({ schoolId, status: "ACTIVE" });
    const inactiveStudents = await Student.countDocuments({ schoolId, status: { $in: ["INACTIVE", "LEFT", "TRANSFERRED"] } });
    const graduatedStudents = await Student.countDocuments({ schoolId, status: "GRADUATED" });
    const totalTeachers = await User.countDocuments({ schoolId, userType: UserType.TEACHER, status: "ACTIVE" });
    const totalStaff = await User.countDocuments({ schoolId, userType: { $in: [UserType.FINANCE, UserType.EXAM_STAFF, UserType.RECEPTIONIST] }, status: "ACTIVE" });
    const totalClasses = await ClassModel.countDocuments({ schoolId });
    const totalSubjects = await Subject.countDocuments({ schoolId });

    // Today's attendance is aggregated from actual registers across all classes.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendanceDocs = await StudentAttendance.find({ schoolId, date: today }).select("records");
    const attendanceRows = todayAttendanceDocs.flatMap((doc: any) => doc.records);
    const presentCount = attendanceRows.filter((row: any) => row.status === "PRESENT" || row.status === "LATE").length;
    const absentCount = attendanceRows.filter((row: any) => row.status === "ABSENT").length;
    const lateCount = attendanceRows.filter((row: any) => row.status === "LATE").length;
    const todayAttendancePercent = attendanceRows.length ? Math.round((presentCount / attendanceRows.length) * 1000) / 10 : 0;
    const [teacherAttendanceToday, studentDistributionRows] = await Promise.all([
      TeacherAttendance.findOne({ schoolId, date: today }).select("records"),
      Student.aggregate([{ $match: { schoolId: new Types.ObjectId(schoolId), status: "ACTIVE" } }, { $group: { _id: "$className", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    const teacherAttendanceRows = teacherAttendanceToday?.records || [];

    // Monthly Fee Collection & Pending Fees calculation
    const challans = await FeeChallan.find({ schoolId, isVoided: { $ne: true } });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyPayments = await FeePayment.find({ schoolId, paidAt: { $gte: monthStart } }).select("amountPKR");
    const monthlyCollectionPKR = monthlyPayments.reduce((sum: number, payment: any) => sum + Number(payment.amountPKR || 0), 0);
    const pendingFeesPKR = challans.reduce((sum: number, c: any) => sum + (c.remainingAmountPKR || 0), 0);

    const upcomingExams = await ExamSchedule.countDocuments({ schoolId, status: { $ne: "COMPLETED" } });
    const [totalSections, currentSession, timetableSlots] = await Promise.all([
      SectionModel.countDocuments({ schoolId }), AcademicSession.findOne({ schoolId, isCurrent: true }).select("name"), TimetableSlot.countDocuments({ schoolId }),
    ]);

    // Calculate trial days remaining
    let trialDaysRemaining = 0;
    if (school.status === "TRIAL" && school.trialEndsAt) {
      const diffMs = new Date(school.trialEndsAt).getTime() - new Date().getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      school,
      metrics: {
        totalStudents,
        inactiveStudents,
        graduatedStudents,
        totalTeachers,
        totalStaff,
        totalClasses,
        totalSections,
        totalSubjects,
        timetableSlots,
        currentSessionName: currentSession?.name || "",
        todayAttendancePercent,
        studentsPresentToday: presentCount,
        studentsAbsentToday: absentCount,
        studentsLateToday: lateCount,
        studentDistribution: studentDistributionRows.map((row: any) => ({ className: row._id, count: row.count })),
        teachersPresentToday: teacherAttendanceRows.filter((row: any) => row.status === "PRESENT" || row.status === "LATE").length,
        teachersAbsentToday: teacherAttendanceRows.filter((row: any) => row.status === "ABSENT").length,
        teachersWithAttendanceToday: teacherAttendanceRows.length,
        monthlyCollectionPKR,
        pendingFeesPKR,
        upcomingExams,
        trialDaysRemaining,
      },
    };
  }

  // 2. STUDENT MANAGEMENT
  static async getNextStudentRollNumber(schoolId: string, classId: string, sectionId?: string, sessionId?: string) {
    if (!sectionId) throw { statusCode: 400, message: "Select a section to generate a roll number." };
    const [linkedClass, section, session] = await Promise.all([
      ClassModel.findOne({ _id: classId, schoolId }).select("name numericLevel"),
      sectionId ? SectionModel.findOne({ _id: sectionId, schoolId, classId }).select("name") : Promise.resolve(null),
      sessionId ? AcademicSession.findOne({ _id: sessionId, schoolId }).select("_id") : AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id"),
    ]);
    if (!linkedClass) throw { statusCode: 400, message: "Select a class belonging to this school." };
    if (!session) throw { statusCode: 400, message: "Create or select an academic session for this school." };
    if (sectionId && !section) throw { statusCode: 400, message: "Select a section belonging to this class and school." };
    if (sessionId && !session) throw { statusCode: 400, message: "Select an academic session belonging to this school." };
    const classLabel = String(linkedClass.name.match(/\d+/)?.[0] || linkedClass.numericLevel || linkedClass.name).trim().replace(/\s+/g, "-");
    const sectionLabel = String(section?.name || "A").replace(/^section\s*/i, "").trim().replace(/\s+/g, "-");
    const rollPrefix = `${classLabel}-${sectionLabel}-`;
    const history = await Student.find({ schoolId, classId, sectionId: sectionId || null, academicSessionId: session?._id || null }).select("rollNumber").lean();
    const next = history.reduce((max, row: any) => {
      const suffix = String(row.rollNumber || "").startsWith(rollPrefix) ? String(row.rollNumber).slice(rollPrefix.length) : "";
      return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
    }, 0) + 1;
    return `${rollPrefix}${next}`;
  }

  static async getStudents(schoolId: string, filterClassId?: string, search?: string, statusFilter?: string) {
    const query: any = { schoolId, status: { $ne: "ARCHIVED" } };
    if (filterClassId) query.classId = filterClassId;
    if (statusFilter && statusFilter !== "ALL") query.status = statusFilter;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { admissionNumber: { $regex: search, $options: "i" } },
      ];
    }
    return Student.find(query).sort({ className: 1, rollNumber: 1 });
  }

  static async createStudent(schoolId: string, data: any, dbSession?: ClientSession, sendAssignmentNotifications = true) {
    const linkedClass = await ClassModel.findOne({ _id: data.classId, schoolId }).select("_id name numericLevel").session(dbSession || null);
    if (!linkedClass) throw { statusCode: 400, message: "Select a class that belongs to your school." };
    data.className = linkedClass.name;
    const section = data.sectionId ? await SectionModel.findOne({ _id: data.sectionId, schoolId, classId: linkedClass._id }).select("_id name").session(dbSession || null) : null;
    if (!section) throw { statusCode: 400, message: "Select a section belonging to this class and school." };
    if (section) { data.sectionName = section.name; }
    const academicSession = data.academicSessionId ? await AcademicSession.findOne({ _id: data.academicSessionId, schoolId }).select("_id name").session(dbSession || null) : await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id name").session(dbSession || null);
    if (data.academicSessionId && !academicSession) throw { statusCode: 400, message: "Select an academic session belonging to this school." };
    if (!academicSession) throw { statusCode: 400, message: "Create or select an academic session for this school." };
    data.academicSessionId = academicSession._id; data.academicSessionName = academicSession.name;
    await SubscriptionEntitlementService.checkCapacityLimit(schoolId, "students");
    const studentCount = await Student.countDocuments({ schoolId }).session(dbSession || null);
    const admissionNumber = data.admissionNumber || `ADM-${new Date().getFullYear()}-${String(studentCount + 1).padStart(4, "0")}`;
    const studentId = data.studentId || `STU-${Math.floor(100000 + Math.random() * 900000)}`;

    // Includes archived students to prevent a deleted/archived number from being reused.
    const rollNumber = await this.getNextStudentRollNumber(schoolId, String(linkedClass._id), section?._id?.toString(), academicSession._id.toString());

    const studentData = {
      ...data,
      schoolId,
      studentId,
      admissionNumber,
      rollNumber,
      status: "ACTIVE",
    };
    const student = dbSession ? (await Student.create([studentData], { session: dbSession }))[0] : await Student.create(studentData);
    const assignedTeachers = sendAssignmentNotifications ? await TeachingAssignment.find({ schoolId, classId: linkedClass._id, sectionId: section?._id, academicSessionId: academicSession._id, status: "ACTIVE" }).distinct("teacherUserId") : [];
    if (assignedTeachers.length) void TeacherNotification.insertMany(assignedTeachers.map((teacherUserId: any) => ({ schoolId, teacherUserId, title: "Student added to your class", message: `${student.name} was added to ${linkedClass.name} · ${section.name}.`, href: "/teacher/students" }))).catch(() => console.warn("[TEACHER-NOTIFICATION] Unable to create student assignment notifications."));
    return student;
  }

  static async updateStudent(schoolId: string, studentId: string, data: any) {
    const existing = await Student.findOne({ _id: studentId, schoolId });
    if (!existing) throw { statusCode: 404, message: "Student record not found." };
    const effectiveClassId = data.classId || existing.classId.toString();
    if (data.classId) {
      const linkedClass = await ClassModel.findOne({ _id: effectiveClassId, schoolId }).select("name");
      if (!linkedClass) throw { statusCode: 400, message: "Select a class that belongs to your school." };
      data.className = linkedClass.name;
    }
    if (data.sectionId !== undefined) {
      const section = data.sectionId ? await SectionModel.findOne({ _id: data.sectionId, schoolId, classId: effectiveClassId }).select("name") : null;
      if (data.sectionId && !section) throw { statusCode: 400, message: "Select a section belonging to this class and school." };
      data.sectionName = section?.name;
    }
    if (data.academicSessionId) {
      const session = await AcademicSession.findOne({ _id: data.academicSessionId, schoolId }).select("name");
      if (!session) throw { statusCode: 400, message: "Select an academic session belonging to this school." };
      data.academicSessionName = session.name;
    }
    const { schoolId: ignoredSchoolId, ...safeData } = data;
    void ignoredSchoolId;
    const student = await Student.findOneAndUpdate({ _id: studentId, schoolId }, { $set: safeData }, { new: true });
    if (!student) throw { statusCode: 404, message: "Student record not found." };
    return student;
  }

  // 3. CLASSES & SECTIONS
  static async getClasses(schoolId: string) {
    return ClassModel.find({ schoolId }).sort({ numericLevel: 1 });
  }

  static async createClass(schoolId: string, data: { name: string; code: string; numericLevel?: number; classTeacherId?: string; classTeacherName?: string }) {
    if (data.classTeacherId) {
      const classTeacher = await User.findOne({ _id: data.classTeacherId, schoolId, userType: UserType.TEACHER }).select("name");
      if (!classTeacher) throw { statusCode: 400, message: "Select a teacher account from your school." };
      data.classTeacherName = classTeacher.name;
    }
    return ClassModel.create({ ...data, schoolId });
  }

  static async getSections(schoolId: string, classId?: string) {
    const query: any = { schoolId };
    if (classId) query.classId = classId;
    return SectionModel.find(query).sort({ name: 1 });
  }

  static async createSection(schoolId: string, data: { classId: string; className: string; name: string; roomNumber?: string; capacity?: number }) {
    const linkedClass = await ClassModel.findOne({ _id: data.classId, schoolId }).select("name");
    if (!linkedClass) throw { statusCode: 400, message: "Select a class that belongs to your school." };
    data.className = linkedClass.name;
    return SectionModel.create({ ...data, schoolId });
  }

  static async getClassTeacherAssignments(schoolId: string) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id name");
    if (!session) return { session: null, assignments: [] };
    const assignments = await ClassTeacherAssignment.find({ schoolId, academicSessionId: session._id }).populate("classId", "name").populate("sectionId", "name").populate("teacherUserId", "name email").lean();
    return { session, assignments };
  }

  static async setClassTeacherAssignment(schoolId: string, data: { classId: string; sectionId: string; teacherUserId: string }) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    if (!session) throw { statusCode: 400, message: "Set a current academic session first." };
    const [linkedClass, section, teacher] = await Promise.all([
      ClassModel.findOne({ _id: data.classId, schoolId }).select("_id"),
      SectionModel.findOne({ _id: data.sectionId, classId: data.classId, schoolId }).select("_id"),
      User.findOne({ _id: data.teacherUserId, schoolId, userType: UserType.TEACHER }).select("name"),
    ]);
    if (!linkedClass || !section || !teacher) throw { statusCode: 400, message: "Class, section, and teacher must belong to this school." };
    return ClassTeacherAssignment.findOneAndUpdate(
      { schoolId, academicSessionId: session._id, sectionId: data.sectionId },
      { $set: { schoolId, academicSessionId: session._id, classId: data.classId, sectionId: data.sectionId, teacherUserId: data.teacherUserId, teacherName: teacher.name } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  // 4. SUBJECTS & TIMETABLE
  static async getSubjects(schoolId: string, classId?: string) {
    const query: any = { schoolId };
    if (classId) query.classId = classId;
    return Subject.find(query).sort({ name: 1 });
  }

  static async getSchoolTeachers(schoolId: string) {
    const users = await User.find({ schoolId, userType: UserType.TEACHER }).select("-passwordHash -refreshTokenHash").sort({ name: 1 }).lean();
    const ids = users.map((teacher: any) => teacher._id);
    const [profiles, assignments] = await Promise.all([
      TeacherProfile.find({ schoolId, userId: { $in: ids } }).lean(),
      TeachingAssignment.find({ schoolId, teacherUserId: { $in: ids } }).populate("academicSessionId", "name").populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name code").sort({ assignedAt: -1 }).lean(),
    ]);
    const profilesByUser = new Map(profiles.map((item: any) => [String(item.userId), item]));
    const assignmentsByUser = new Map<string, any[]>();
    assignments.forEach((item: any) => { const key = String(item.teacherUserId); assignmentsByUser.set(key, [...(assignmentsByUser.get(key) || []), item]); });
    return users.map((teacher: any) => ({ ...teacher, profile: profilesByUser.get(String(teacher._id)) || null, assignments: assignmentsByUser.get(String(teacher._id)) || [] }));
  }

  private static async validateTeachingAssignments(schoolId: string, assignments: any[]) {
    const keys = new Set<string>();
    for (const assignment of assignments) {
      const key = [assignment.academicSessionId, assignment.classId, assignment.sectionId, assignment.subjectId].join(":");
      if (keys.has(key)) throw { statusCode: 400, message: "The same teaching assignment was added more than once." };
      keys.add(key);
      const [session, section, subject] = await Promise.all([
        AcademicSession.findOne({ _id: assignment.academicSessionId, schoolId }).select("_id"),
        SectionModel.findOne({ _id: assignment.sectionId, classId: assignment.classId, schoolId }).select("_id"),
        Subject.findOne({ _id: assignment.subjectId, classId: assignment.classId, schoolId }).select("_id"),
      ]);
      if (!session || !section || !subject) throw { statusCode: 400, message: "Each assignment must use this school’s session, a section under its selected class, and a subject assigned to that class." };
    }
  }

  static async createSchoolTeacher(schoolId: string, data: any) {
    await this.validateTeachingAssignments(schoolId, data.assignments || []);
    const teacher = await UserService.createStaffUser(schoolId, { ...data, userType: UserType.TEACHER });
    try {
      await TeacherProfile.create({ schoolId, userId: teacher.id, qualification: data.qualification, employeeId: data.employeeId, phone: data.phone });
      if (data.assignments?.length) await TeachingAssignment.insertMany(data.assignments.map((item: any) => ({ ...item, schoolId, teacherUserId: teacher.id, status: "ACTIVE" })));
      if (data.assignments?.length) await TeacherNotification.insertMany(await Promise.all(data.assignments.map(async (item: any) => {
        const [classRecord, section, subject] = await Promise.all([ClassModel.findOne({ _id: item.classId, schoolId }).select("name"), SectionModel.findOne({ _id: item.sectionId, schoolId }).select("name"), Subject.findOne({ _id: item.subjectId, schoolId }).select("name")]);
        return { schoolId, teacherUserId: teacher.id, title: "New teaching assignment", message: `You have been assigned ${subject?.name || "a subject"} to ${classRecord?.name || "a class"}${section?.name ? ` · ${section.name}` : ""}.`, href: "/teacher/subjects" };
      })));
      return (await this.getSchoolTeachers(schoolId)).find((item: any) => String(item._id) === String(teacher.id));
    } catch (error) {
      await Promise.all([TeachingAssignment.deleteMany({ schoolId, teacherUserId: teacher.id }), TeacherProfile.deleteOne({ schoolId, userId: teacher.id }), User.deleteOne({ _id: teacher.id, schoolId })]);
      throw error;
    }
  }

  static async updateSchoolTeacher(schoolId: string, teacherId: string, data: any) {
    const teacher = await User.findOne({ _id: teacherId, schoolId, userType: UserType.TEACHER });
    if (!teacher) throw { statusCode: 404, message: "Teacher not found in this school." };
    if (data.assignments) await this.validateTeachingAssignments(schoolId, data.assignments);
    const oldAssignments = data.assignments ? await TeachingAssignment.find({ schoolId, teacherUserId: teacherId, status: "ACTIVE" }).lean() : [];
    if (data.name) teacher.name = data.name;
    if (data.status) teacher.status = data.status;
    await teacher.save();
    if (data.status && data.status !== "ACTIVE") await TeachingAssignment.updateMany({ schoolId, teacherUserId: teacherId, status: "ACTIVE" }, { $set: { status: "ENDED", endedAt: new Date() } });
    const { assignments, name, status, ...profileData } = data;
    if (Object.keys(profileData).length) await TeacherProfile.findOneAndUpdate({ schoolId, userId: teacherId }, { $set: profileData, $setOnInsert: { schoolId, userId: teacherId } }, { upsert: true, new: true });
    if (assignments) {
      await TeachingAssignment.updateMany({ schoolId, teacherUserId: teacherId, status: "ACTIVE" }, { $set: { status: "ENDED", endedAt: new Date() } });
      if (assignments.length) await TeachingAssignment.insertMany(assignments.map((item: any) => ({ ...item, schoolId, teacherUserId: teacherId, status: "ACTIVE" })));
      const oldKeys = new Set(oldAssignments.map((item: any) => [item.academicSessionId, item.classId, item.sectionId, item.subjectId].map(String).join(":")));
      const newKeys = new Set(assignments.map((item: any) => [item.academicSessionId, item.classId, item.sectionId, item.subjectId].map(String).join(":")));
      const addedAssignments = assignments.filter((item: any) => !oldKeys.has([item.academicSessionId, item.classId, item.sectionId, item.subjectId].map(String).join(":")));
      if (addedAssignments.length) await TeacherNotification.insertMany(await Promise.all(addedAssignments.map(async (item: any) => {
        const [classRecord, section, subject] = await Promise.all([ClassModel.findOne({ _id: item.classId, schoolId }).select("name"), SectionModel.findOne({ _id: item.sectionId, schoolId }).select("name"), Subject.findOne({ _id: item.subjectId, schoolId }).select("name")]);
        return { schoolId, teacherUserId: teacherId, title: "New teaching assignment", message: `You have been assigned ${subject?.name || "a subject"} to ${classRecord?.name || "a class"}${section?.name ? ` · ${section.name}` : ""}.`, href: "/teacher/subjects" };
      })));
      if (oldAssignments.some((item: any) => !newKeys.has([item.academicSessionId, item.classId, item.sectionId, item.subjectId].map(String).join(":")))) await TeacherNotification.create({ schoolId, teacherUserId: teacherId, title: "Teaching assignments updated", message: "One or more of your previous teaching assignments have ended.", href: "/teacher/subjects" });
    }
    return (await this.getSchoolTeachers(schoolId)).find((item: any) => String(item._id) === String(teacherId));
  }

  static async createSubject(schoolId: string, data: any) {
    const linkedClass = await ClassModel.findOne({ _id: data.classId, schoolId }).select("name code");
    if (!linkedClass) throw { statusCode: 400, message: "Select a class that belongs to your school." };
    data.className = linkedClass.name;
    if (data.teacherId) {
      const teacher = await User.findOne({ _id: data.teacherId, schoolId, userType: UserType.TEACHER, status: "ACTIVE" }).select("name");
      if (!teacher) throw { statusCode: 400, message: "Select a teacher account from your school." };
      data.teacherName = teacher.name;
    }
    data.code = data.code?.trim() || `${linkedClass.code}-${data.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    return Subject.create({ ...data, schoolId });
  }

  static async getAcademicSessions(schoolId: string) {
    return AcademicSession.find({ schoolId }).sort({ isCurrent: -1, startDate: -1 });
  }

  static async createAcademicSession(schoolId: string, data: any) {
    const session = await AcademicSession.create({ ...data, isCurrent: false, schoolId });
    if (data.isCurrent) {
      await AcademicSession.updateMany({ schoolId, _id: { $ne: session._id } }, { $set: { isCurrent: false } });
      session.isCurrent = true;
      await session.save();
    }
    return session;
  }

  static async setCurrentAcademicSession(schoolId: string, sessionId: string) {
    const session = await AcademicSession.findOne({ _id: sessionId, schoolId });
    if (!session) throw { statusCode: 404, message: "Academic session not found in this school." };
    await AcademicSession.updateMany({ schoolId }, { $set: { isCurrent: false } });
    session.isCurrent = true;
    await session.save();
    return session;
  }

  static async createTimetableSlot(schoolId: string, data: any) {
    const [linkedClass, subject, session] = await Promise.all([
      ClassModel.findOne({ _id: data.classId, schoolId }).select("name"),
      Subject.findOne({ _id: data.subjectId, schoolId, classId: data.classId }).select("name"),
      data.academicSessionId ? AcademicSession.findOne({ _id: data.academicSessionId, schoolId }).select("name") : AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id name"),
    ]);
    if (!linkedClass || !subject) throw { statusCode: 400, message: "Select a class and subject belonging to this school." };
    if (!session) throw { statusCode: 400, message: "Select or create an academic session for this school." };
    if (data.sectionId && !await SectionModel.exists({ _id: data.sectionId, schoolId, classId: data.classId })) throw { statusCode: 400, message: "Select a section belonging to this class and school." };
    if (data.teacherId && !await User.exists({ _id: data.teacherId, schoolId, userType: UserType.TEACHER })) throw { statusCode: 400, message: "Select a teacher belonging to this school." };
    if (data.teacherId) {
      const assigned = await TeachingAssignment.exists({ schoolId, teacherUserId: data.teacherId, academicSessionId: session._id, classId: data.classId, ...(data.sectionId ? { sectionId: data.sectionId } : {}), subjectId: data.subjectId, status: "ACTIVE" });
      if (!assigned && String((await Subject.findOne({ _id: data.subjectId, schoolId }).select("teacherId"))?.teacherId || "") !== String(data.teacherId)) throw { statusCode: 400, message: "Select a teacher assigned to this subject, class, section, and session." };
    }
    const sameDaySlots = await TimetableSlot.find({ schoolId, academicSessionId: session._id, dayOfWeek: data.dayOfWeek }).select("classId sectionId teacherId roomNumber startTime endTime").lean();
    const toMinutes = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };
    const overlapping = sameDaySlots.filter((slot: any) => toMinutes(data.startTime) < toMinutes(slot.endTime) && toMinutes(data.endTime) > toMinutes(slot.startTime));
    const classConflict = overlapping.some((slot: any) => String(slot.classId) === String(data.classId) && (!data.sectionId || !slot.sectionId || String(slot.sectionId) === String(data.sectionId)));
    const teacherConflict = data.teacherId && overlapping.some((slot: any) => String(slot.teacherId || "") === String(data.teacherId));
    const roomConflict = data.roomNumber && overlapping.some((slot: any) => String(slot.roomNumber || "").trim().toLowerCase() === String(data.roomNumber).trim().toLowerCase());
    if (classConflict) throw { statusCode: 409, message: "This class or section already has a timetable entry during that time." };
    if (teacherConflict) throw { statusCode: 409, message: "This teacher is already assigned during that time." };
    if (roomConflict) throw { statusCode: 409, message: "This room is already booked during that time." };
    const teacher = data.teacherId ? await User.findOne({ _id: data.teacherId, schoolId }).select("name") : null;
    const slot = await TimetableSlot.create({ ...data, schoolId, academicSessionId: session._id, subjectName: subject.name, teacherName: teacher?.name });
    if (data.teacherId) {
      const section = data.sectionId ? await SectionModel.findOne({ _id: data.sectionId, schoolId }).select("name") : null;
      void TeacherNotification.create({ schoolId, teacherUserId: data.teacherId, title: "Timetable updated", message: `${subject.name} for ${linkedClass.name}${section?.name ? ` · ${section.name}` : ""} was scheduled on ${data.dayOfWeek} at ${data.startTime}.`, href: "/teacher/timetable" }).catch(() => console.warn("[TEACHER-NOTIFICATION] Unable to create timetable notification."));
    }
    return slot;
  }

  static async getAdminAttendance(schoolId: string, from?: string, to?: string, classId?: string, sectionId?: string) {
    const query: any = { schoolId };
    if (from || to) query.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;
    const [studentAttendance, teacherAttendance] = await Promise.all([
      StudentAttendance.find(query).sort({ date: -1 }), TeacherAttendance.find({ schoolId, ...(query.date ? { date: query.date } : {}) }).sort({ date: -1 }),
    ]);
    const counts = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    for (const record of studentAttendance.flatMap((doc: any) => doc.records)) {
      counts.total += 1;
      const status = String(record.status).toLowerCase() as "present" | "absent" | "late" | "leave";
      if (status === "present" || status === "absent" || status === "late" || status === "leave") counts[status] += 1;
    }
    return { studentAttendance, teacherAttendance, summary: { ...counts, attendancePercent: counts.total ? Math.round(((counts.present + counts.late) / counts.total) * 1000) / 10 : 0 } };
  }

  static async getTimetable(schoolId: string, classId: string) {
    return TimetableSlot.find({ schoolId, classId }).sort({ periodNumber: 1 });
  }

  // 5. ATTENDANCE
  static async saveStudentAttendance(schoolId: string, data: any) {
    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);

    const doc = await StudentAttendance.findOneAndUpdate(
      { schoolId, classId: data.classId, sectionId: data.sectionId || null, date },
      { $set: { ...data, schoolId, date } },
      { upsert: true, new: true }
    );
    return doc;
  }

  static async getStudentAttendance(schoolId: string, dateStr: string, classId: string) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return StudentAttendance.findOne({ schoolId, classId, date });
  }

  // 6. FINANCE & FEE CHALLANS
  static async getFeeStructures(schoolId: string) {
    return FeeStructure.find({ schoolId }).sort({ className: 1 });
  }

  static async createFeeStructure(schoolId: string, data: any) {
    const linkedClass = await ClassModel.findOne({ _id: data.classId, schoolId }).select("name");
    if (!linkedClass) throw { statusCode: 400, message: "Select a class belonging to this school." };
    data.className = linkedClass.name;
    if (data.sectionId && !await SectionModel.exists({ _id: data.sectionId, schoolId, classId: data.classId })) throw { statusCode: 400, message: "Select a section belonging to this class and school." };
    const totalMonthlyFee = (data.tuitionFee || 0) + (data.examFee || 0) + (data.transportFee || 0) + (data.libraryFee || 0) + (data.computerFee || 0) + (data.otherCharges || 0);
    return FeeStructure.create({ ...data, schoolId, totalMonthlyFee });
  }

  static async generateFeeChallansBatch(schoolId: string, classId: string, className: string, month: string, dueDateStr: string) {
    const students = await Student.find({ schoolId, classId, status: "ACTIVE" });
    const feeStructure = await FeeStructure.findOne({ schoolId, classId });
    if (!feeStructure) throw { statusCode: 400, message: "Create a fee structure for this class before generating challans." };
    const tuitionFee = feeStructure.tuitionFee || 0;
    const dueDate = new Date(dueDateStr);

    const generated: any[] = [];
    for (const s of students) {
      const existing = await FeeChallan.findOne({ schoolId, studentId: s._id, month });
      if (existing) continue;
      const challanNumber = `CH-${new Date().getFullYear()}-${month.replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase()}-${String(s._id).slice(-8).toUpperCase()}`;
      const examFee = feeStructure.examFee || 0;
      const transportFee = feeStructure.transportFee || 0;
      const libraryFee = feeStructure.libraryFee || 0;
      const computerFee = feeStructure.computerFee || 0;
      const otherCharges = feeStructure.otherCharges || 0;
      const totalAmountPKR = Math.max(0, tuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges - (feeStructure.defaultDiscount || 0));

      const challan = await FeeChallan.create({ schoolId, challanNumber, studentId: s._id, studentName: s.name, rollNumber: s.rollNumber, classId: s.classId, className: s.className, sectionName: s.sectionName, academicSession: s.academicSessionName, month, dueDate, feeBreakdown: { tuitionFee, examFee, transportFee, libraryFee, computerFee, otherCharges, discount: feeStructure.defaultDiscount || 0 }, totalAmountPKR, paidAmountPKR: 0, remainingAmountPKR: totalAmountPKR, status: "PENDING" });
      generated.push(challan);
    }
    return { count: generated.length, message: `Generated ${generated.length} fee challans for ${className} (${month}).` };
  }

  static async getFeeChallans(schoolId: string, statusFilter?: string) {
    const query: any = { schoolId };
    if (statusFilter && statusFilter !== "ALL") query.status = statusFilter;
    return FeeChallan.find(query).sort({ createdAt: -1 });
  }

  static async collectFeePayment(schoolId: string, challanId: string, paidAmount: number, paymentMethod: any, cashierName: string) {
    const challan = await FeeChallan.findOne({ _id: challanId, schoolId, isVoided: { $ne: true } });
    if (!challan) throw { statusCode: 404, message: "Fee Challan not found." };
    const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const paidAt = new Date();
    const updated: any = await FeeChallan.findOneAndUpdate(
      { _id: challanId, schoolId, isVoided: { $ne: true }, remainingAmountPKR: { $gte: paidAmount } },
      [
        { $set: { paidAmountPKR: { $add: [{ $ifNull: ["$paidAmountPKR", 0] }, paidAmount] }, remainingAmountPKR: { $subtract: ["$remainingAmountPKR", paidAmount] }, paidDate: paidAt, paymentMethod, receiptNumber, collectedByUserName: cashierName } },
        { $set: { status: { $cond: [{ $lte: ["$remainingAmountPKR", 0] }, "PAID", "PARTIAL"] } } },
      ] as any,
      { new: true, updatePipeline: true } as any
    );
    if (!updated) throw { statusCode: 409, message: "Payment exceeds the remaining balance or the challan changed. Refresh and try again." };
    try {
      return await FeePayment.create({ schoolId, challanId: updated._id, studentId: updated.studentId, studentName: updated.studentName, rollNumber: updated.rollNumber, className: updated.className, amountPKR: paidAmount, paymentMethod, paidAt: updated.paidDate, receiptNumber, collectedByUserName: cashierName });
    } catch (error) {
      await FeeChallan.updateOne({ _id: updated._id, schoolId }, [
        { $set: { paidAmountPKR: { $subtract: ["$paidAmountPKR", paidAmount] }, remainingAmountPKR: { $add: ["$remainingAmountPKR", paidAmount] } } },
        { $set: { status: { $cond: [{ $lte: ["$remainingAmountPKR", 0] }, "PAID", { $cond: [{ $gt: ["$paidAmountPKR", 0] }, "PARTIAL", "PENDING"] }] } } },
      ] as any);
      throw error;
    }
  }

  static async getExpenses(schoolId: string) {
    return Expense.find({ schoolId }).sort({ expenseDate: -1 });
  }

  static async createExpense(schoolId: string, data: any, loggedByName: string) {
    return Expense.create({ ...data, schoolId, loggedByName });
  }

  static async getFinanceSummary(schoolId: string) {
    const [challans, expenses, payments] = await Promise.all([FeeChallan.find({ schoolId, isVoided: { $ne: true } }).lean(), Expense.find({ schoolId, isVoided: { $ne: true } }).lean(), FeePayment.find({ schoolId }).populate("challanId", "challanNumber").sort({ paidAt: -1 }).lean()]);
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const between = (value: any, start: Date, end = now) => new Date(value) >= start && new Date(value) <= end;
    return {
      totalFeesPKR: challans.reduce((sum: number, row: any) => sum + Number(row.totalAmountPKR || 0), 0),
      collectedFeesPKR: challans.reduce((sum: number, row: any) => sum + Number(row.paidAmountPKR || 0), 0),
      pendingFeesPKR: challans.reduce((sum: number, row: any) => sum + Number(row.remainingAmountPKR || 0), 0),
      overdueFeesPKR: challans.filter((row: any) => row.status === "OVERDUE" || (row.status !== "PAID" && new Date(row.dueDate) < startOfDay)).reduce((sum: number, row: any) => sum + Number(row.remainingAmountPKR || 0), 0),
      todayCollectionPKR: payments.filter((row: any) => between(row.paidAt, startOfDay)).reduce((sum: number, row: any) => sum + Number(row.amountPKR || 0), 0),
      monthCollectionPKR: payments.filter((row: any) => between(row.paidAt, startOfMonth)).reduce((sum: number, row: any) => sum + Number(row.amountPKR || 0), 0),
      totalExpensesPKR: expenses.reduce((sum: number, row: any) => sum + Number(row.amountPKR || 0), 0),
      challans: { total: challans.length, paid: challans.filter((row: any) => row.status === "PAID").length, pending: challans.filter((row: any) => row.status === "PENDING" || row.status === "OVERDUE").length },
      receipts: payments,
    };
  }

  static async getReportsSummary(schoolId: string) {
    const [students, teachers, classes, sessions, attendance, finance, exams] = await Promise.all([
      Student.countDocuments({ schoolId, status: "ACTIVE" }),
      User.countDocuments({ schoolId, userType: UserType.TEACHER, status: "ACTIVE" }),
      ClassModel.countDocuments({ schoolId }),
      AcademicSession.find({ schoolId }).select("name isCurrent startDate endDate").sort({ isCurrent: -1, startDate: -1 }),
      this.getAdminAttendance(schoolId),
      this.getFinanceSummary(schoolId),
      ExamSchedule.countDocuments({ schoolId }),
    ]);
    return { students, teachers, classes, sessions, attendance: attendance.summary, finance: { totalFeesPKR: finance.totalFeesPKR, collectedFeesPKR: finance.collectedFeesPKR, pendingFeesPKR: finance.pendingFeesPKR, overdueFeesPKR: finance.overdueFeesPKR, totalExpensesPKR: finance.totalExpensesPKR }, exams };
  }

  // 7. EXAMINATIONS & MARKS
  static async getExamSchedules(schoolId: string) {
    return ExamSchedule.find({ schoolId }).sort({ startDate: -1 });
  }

  static async createExamSchedule(schoolId: string, data: any) {
    const [classes, subjects, session] = await Promise.all([
      ClassModel.find({ schoolId, _id: { $in: data.classes } }).select("_id"),
      Subject.find({ schoolId, _id: { $in: data.subjects } }).select("_id classId"),
      data.academicSessionId ? AcademicSession.findOne({ _id: data.academicSessionId, schoolId }).select("name") : AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id name"),
    ]);
    if (classes.length !== data.classes.length) throw { statusCode: 400, message: "Every selected class must belong to this school." };
    if (subjects.length !== data.subjects.length) throw { statusCode: 400, message: "Every selected subject must belong to this school." };
    if (!session) throw { statusCode: 400, message: "Select or create an academic session for this school." };
    return ExamSchedule.create({ ...data, schoolId, academicSessionId: session._id, academicSessionName: session.name });
  }

  static async getMarks(schoolId: string, examId?: string, classId?: string, subjectId?: string, sectionId?: string) {
    if (!examId || !classId || !subjectId) {
      return { examTitle: "", className: "", subjectName: "", maxMarks: 100, passingMarks: 33, marks: [], entry: null };
    }

    if (!mongoose.Types.ObjectId.isValid(examId) || !mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return { examTitle: "", className: "", subjectName: "", maxMarks: 100, passingMarks: 33, marks: [], entry: null };
    }

    const [subject, exam, classRecord]: [any, any, any] = await Promise.all([
      Subject.findOne({ _id: subjectId, schoolId, classId }).select("name code totalMarks passingMarks").lean(),
      ExamSchedule.findOne({ _id: examId, schoolId }).select("title").lean(),
      ClassModel.findOne({ _id: classId, schoolId }).select("name").lean(),
    ]);

    if (!subject || !exam || !classRecord) {
      return { examTitle: "", className: "", subjectName: "", maxMarks: 100, passingMarks: 33, marks: [], entry: null };
    }

    const entry: any = await MarksEntry.findOne({ schoolId, examId, classId, subjectId }).lean();

    const studentQuery: any = { schoolId, classId, status: "ACTIVE" };
    if (sectionId && mongoose.Types.ObjectId.isValid(sectionId)) {
      studentQuery.sectionId = sectionId;
    }
    const students = await Student.find(studentQuery).select("_id name rollNumber sectionId").sort({ rollNumber: 1 }).lean();

    const existingMap = new Map((entry?.records || []).map((r: any) => [String(r.studentId), r]));

    const studentMarks = students.map((student: any) => {
      const rec: any = existingMap.get(String(student._id));
      return {
        studentId: String(student._id),
        rollNo: student.rollNumber || "",
        name: student.name,
        maxMarks: subject.totalMarks || 100,
        passingMarks: subject.passingMarks || 33,
        obtainedMarks: rec?.obtainedMarks !== undefined && rec?.obtainedMarks !== null ? rec.obtainedMarks : "",
        remarks: rec?.remarks || "",
        isAbsent: rec?.isAbsent || false,
      };
    });

    return {
      examTitle: exam.title,
      className: classRecord.name,
      subjectName: subject.name,
      maxMarks: subject.totalMarks || 100,
      passingMarks: subject.passingMarks || 33,
      marks: studentMarks,
      entry,
    };
  }

  static async saveMarks(schoolId: string, data: {
    examId: string;
    classId: string;
    sectionId?: string;
    subjectId: string;
    marks: Array<{ studentId: string; obtainedMarks: number | ""; remarks?: string; isAbsent?: boolean }>;
  }, userName: string) {
    if (!mongoose.Types.ObjectId.isValid(data.examId) || !mongoose.Types.ObjectId.isValid(data.classId) || !mongoose.Types.ObjectId.isValid(data.subjectId)) {
      throw { statusCode: 400, message: "Invalid exam, class, or subject ID parameter." };
    }

    const [exam, classRecord, subject]: [any, any, any] = await Promise.all([
      ExamSchedule.findOne({ _id: data.examId, schoolId }).select("title"),
      ClassModel.findOne({ _id: data.classId, schoolId }).select("name"),
      Subject.findOne({ _id: data.subjectId, schoolId, classId: data.classId }).select("name totalMarks passingMarks"),
    ]);

    if (!exam || !classRecord || !subject) {
      throw { statusCode: 404, message: "Selected exam, class, or subject not found in this school." };
    }

    const studentQuery: any = { schoolId, classId: data.classId, status: "ACTIVE" };
    if (data.sectionId && mongoose.Types.ObjectId.isValid(data.sectionId)) {
      studentQuery.sectionId = data.sectionId;
    }
    const roster = await Student.find(studentQuery).select("_id name rollNumber").lean();
    const rosterMap = new Map(roster.map((s: any) => [String(s._id), s]));

    const records = (data.marks || [])
      .filter((m: any) => rosterMap.has(String(m.studentId)) && m.obtainedMarks !== "")
      .map((m: any) => {
        const student: any = rosterMap.get(String(m.studentId));
        const obtained = Number(m.obtainedMarks) || 0;
        const pct = subject.totalMarks > 0 ? (obtained / subject.totalMarks) * 100 : 0;
        let grade = "F";
        if (pct >= 90) grade = "A+";
        else if (pct >= 80) grade = "A";
        else if (pct >= 70) grade = "B";
        else if (pct >= 60) grade = "C";
        else if (pct >= 50) grade = "D";

        return {
          studentId: student._id,
          studentName: student.name,
          rollNumber: student.rollNumber,
          obtainedMarks: obtained,
          grade,
          remarks: m.remarks || "",
          isAbsent: Boolean(m.isAbsent),
        };
      });

    const doc = await MarksEntry.findOneAndUpdate(
      { schoolId, examId: data.examId, classId: data.classId, subjectId: data.subjectId },
      {
        $set: {
          schoolId,
          examId: data.examId,
          classId: data.classId,
          subjectId: data.subjectId,
          examTitle: exam.title,
          className: classRecord.name,
          subjectName: subject.name,
          maxMarks: subject.totalMarks || 100,
          passingMarks: subject.passingMarks || 33,
          records,
          enteredByTeacherName: userName,
          status: "SUBMITTED",
        },
      },
      { upsert: true, new: true }
    );

    return doc;
  }

  static async getResults(schoolId: string, examId?: string, classId?: string) {
    const query: any = { schoolId };
    if (examId && mongoose.Types.ObjectId.isValid(examId)) query.examId = examId;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) query.classId = classId;

    return ProcessedResult.find(query).sort({ rank: 1, percentage: -1 });
  }

  // 8. ANNOUNCEMENTS
  static async getAnnouncements(schoolId: string) {
    return Announcement.find({ schoolId }).sort({ createdAt: -1 });
  }

  static async createAnnouncement(schoolId: string, data: any, postedByName: string) {
    return Announcement.create({ ...data, schoolId, postedByName });
  }

  // 9. TEACHER HISTORY
  static async getTeacherHistory(schoolId: string, teacherUserId: string) {
    const teacher = await User.findOne({ _id: teacherUserId, schoolId, userType: UserType.TEACHER })
      .select("-passwordHash -refreshTokenHash")
      .lean();
    if (!teacher) throw { statusCode: 404, message: "Teacher account not found." };

    const profile = await TeacherProfile.findOne({ schoolId, userId: teacherUserId }).lean();
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id name");

    const teachingAssignments = await TeachingAssignment.find({ schoolId, teacherUserId, status: "ACTIVE" })
      .populate("classId", "name code")
      .populate("sectionId", "name")
      .populate("subjectId", "name code")
      .populate("academicSessionId", "name")
      .lean();

    const classTeacherAssignments = await ClassTeacherAssignment.find({ schoolId, teacherUserId })
      .populate("classId", "name code")
      .populate("sectionId", "name")
      .populate("academicSessionId", "name")
      .lean();

    const timetableSlots = await TimetableSlot.find({ schoolId, teacherId: teacherUserId })
      .populate("classId", "name")
      .populate("sectionId", "name")
      .populate("subjectId", "name")
      .sort({ dayOfWeek: 1, periodNumber: 1 })
      .lean();

    const attendanceDocs = await TeacherAttendance.find({ schoolId, "records.teacherUserId": teacherUserId })
      .sort({ date: -1 })
      .limit(60)
      .lean();

    const attendanceLogs = attendanceDocs.map((doc: any) => {
      const rec = doc.records.find((r: any) => String(r.teacherUserId) === String(teacherUserId));
      return {
        date: doc.date,
        status: rec?.status || "PRESENT",
        arrivalTime: rec?.arrivalTime,
        checkedInAt: rec?.checkedInAt,
        checkedOutAt: rec?.checkedOutAt,
      };
    });

    const leaveRequests = await LeaveRequest.find({ schoolId, teacherId: teacherUserId }).sort({ createdAt: -1 }).lean();

    return {
      teacher,
      profile,
      currentSessionName: session?.name || "",
      teachingAssignments,
      classTeacherAssignments,
      timetableSlots,
      attendanceLogs,
      leaveRequests,
    };
  }
}
