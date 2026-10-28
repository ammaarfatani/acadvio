import {persistMarks} from "./marksPersistence.service";
import {teacherBatches,mergeTeacherBatches} from "./workforce.service";
import { branchContext } from "../utils/branchScope";
import { hasFeature } from "../../lib/plan-features";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { Subject, TimetableSlot } from "../models/subject.model";
import { StudentAttendance, TeacherAttendance } from "../models/attendance.model";
import { ExamSchedule, MarksEntry, ProcessedResult } from "../models/exam.model";
import { Announcement } from "../models/announcement.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { TeachingAssignment } from "../models/teacherProfile.model";
import { TeacherProfile } from "../models/teacherProfile.model";
import { TeacherNotification } from "../models/teacherNotification.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassTeacherAssignment } from "../models/classTeacherAssignment.model";
import { StudentLifecycleEvent } from "../models/studentLifecycleEvent.model";

export class TeacherService {
  static async getTeacherTimetable(schoolId: string, teacherUserId: string) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    return TimetableSlot.find({ schoolId, teacherId: teacherUserId, ...(session ? { academicSessionId: session._id } : {}) }).populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name").sort({ dayOfWeek: 1, periodNumber: 1 });
  }

  static async getTeacherMarksContexts(schoolId: string, teacherUserId: string) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    const assignments = await TeachingAssignment.find({ schoolId, teacherUserId, status: "ACTIVE", ...(session ? { academicSessionId: session._id } : {}) }).populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name totalMarks passingMarks").lean();
    const legacySubjects = await Subject.find({ schoolId, teacherId: teacherUserId }).populate("classId", "name").select("name classId totalMarks passingMarks").lean();
    const groups = new Map<string, any>();
    for (const assignment of assignments as any[]) {
      const classId = String(assignment.classId?._id || assignment.classId); const subjectId = String(assignment.subjectId?._id || assignment.subjectId); const key = `${classId}:${subjectId}`;
      const group = groups.get(key) || { classId, subjectId, class: assignment.classId, subject: assignment.subjectId, sections: [] };
      if (!group.sections.some((section: any) => String(section._id) === String(assignment.sectionId?._id || assignment.sectionId))) group.sections.push(assignment.sectionId);
      groups.set(key, group);
    }
    for (const subject of legacySubjects as any[]) {
      const classId = String(subject.classId?._id || subject.classId); const subjectId = String(subject._id); const key = `${classId}:${subjectId}`;
      if (!groups.has(key)) groups.set(key, { classId, subjectId, class: subject.classId, subject, sections: [] });
    }
    const contexts: any[] = [];
    for (const group of groups.values()) {
      const { classId, subjectId } = group;
      const exams = await ExamSchedule.find({ schoolId, classes: classId, subjects: subjectId, ...(session ? { academicSessionId: session._id } : {}), status: { $nin: ["COMPLETED", "DRAFT"] } }).sort({ startDate: -1 }).lean();
      const students = await Student.find({ schoolId, classId, ...(group.sections.length ? { sectionId: { $in: group.sections.map((section: any) => section?._id || section) } } : {}), status: "ACTIVE", ...(session ? { academicSessionId: session._id } : {}) }).select("name rollNumber").sort({ rollNumber: 1 }).lean();
      for (const exam of exams as any[]) {
        const entry: any = await MarksEntry.findOne({ schoolId, examId: exam._id, classId, subjectId }).lean();
        contexts.push({ exam: { _id: exam._id, title: exam.title, startDate: exam.startDate, endDate: exam.endDate, status: exam.status }, class: group.class, section: { _id: group.sections.map((section: any) => String(section?._id || section)).join(","), name: group.sections.map((section: any) => section?.name).filter(Boolean).join(", ") || "All assigned sections" }, subject: group.subject, students: students.map((student: any) => {
          const existing: any = entry?.records?.find((record: any) => String(record.studentId) === String(student._id));
          return { studentId: student._id, photoUrl:student.photoUrl,updatedAt:student.updatedAt, name: student.name, rollNumber: student.rollNumber, obtainedMarks: existing?.obtainedMarks ?? "", isAbsent:Boolean(existing?.isAbsent), remarks: existing?.remarks || "" };
        }), maxMarks: group.subject?.totalMarks || 100, passingMarks: group.subject?.passingMarks || 33, entryStatus: entry?.status || "PENDING" });
      }
    }
    return contexts;
  }

  static async getTeacherNotifications(schoolId: string, teacherUserId: string) {
    const [notifications, unreadCount] = await Promise.all([
      TeacherNotification.find({ schoolId, teacherUserId }).sort({ createdAt: -1 }).limit(30).lean(),
      TeacherNotification.countDocuments({ schoolId, teacherUserId, isRead: false }),
    ]);
    return { notifications, unreadCount };
  }

  static async markTeacherNotificationRead(schoolId: string, teacherUserId: string, notificationId: string) {
    const notification = await TeacherNotification.findOneAndUpdate({ _id: notificationId, schoolId, teacherUserId }, { $set: { isRead: true, readAt: new Date() } }, { new: true });
    if (!notification) throw { statusCode: 404, message: "Notification not found." };
    return notification;
  }

  static async markAllTeacherNotificationsRead(schoolId: string, teacherUserId: string) {
    await TeacherNotification.updateMany({ schoolId, teacherUserId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    return this.getTeacherNotifications(schoolId, teacherUserId);
  }

  // 1. TEACHER DASHBOARD
  static async getTeacherDashboard(schoolId: string, teacherUserId: string) {
    const teacher = await User.findOne({ _id: teacherUserId, schoolId, userType: "TEACHER" });
    if (!teacher) throw { statusCode: 404, message: "Teacher profile not found." };
    const profile = await TeacherProfile.findOne({ schoolId, userId: teacherUserId });
    const currentSession = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("name");

    // Find assigned subjects for this teacher
    const assignments = await TeachingAssignment.find({ schoolId, teacherUserId, status: "ACTIVE", ...(currentSession ? { academicSessionId: currentSession._id } : {}) }).populate("subjectId").populate("classId", "name").populate("sectionId", "name").populate("academicSessionId", "name");
    const legacySubjects = await Subject.find({ schoolId, teacherId: teacherUserId });
    const assignedSubjects = [...new Map([...legacySubjects, ...assignments.map((item: any) => item.subjectId)].map((subject: any) => [String(subject._id), subject])).values()];
    const assignedClassIds = assignments.map((item: any) => String(item.classId?._id || item.classId));
    legacySubjects.forEach((subject) => { if (!assignedClassIds.includes(subject.classId.toString())) assignedClassIds.push(subject.classId.toString()); });

    // Also check timetable slots for assigned classes
    const timetableSlots = await TimetableSlot.find({ schoolId, teacherId: teacherUserId, ...(currentSession ? { academicSessionId: currentSession._id } : {}) });
    timetableSlots.forEach((slot) => {
      if (!assignedClassIds.includes(slot.classId.toString())) {
        assignedClassIds.push(slot.classId.toString());
      }
    });

    // Count assigned students
    const assignmentSectionIds = [...new Set(assignments.map((item: any) => String(item.sectionId?._id || item.sectionId)).filter(Boolean))];
    const legacyClassIds = [...new Set([...legacySubjects.map((subject: any) => String(subject.classId)), ...timetableSlots.filter((slot: any) => !slot.sectionId).map((slot: any) => String(slot.classId))])];
    const slotSectionIds = timetableSlots.map((slot: any) => slot.sectionId ? String(slot.sectionId) : "").filter(Boolean);
    const totalAssignedStudents = await Student.countDocuments({ schoolId, status: "ACTIVE", $or: [
      ...(legacyClassIds.length ? [{ classId: { $in: legacyClassIds } }] : []),
      ...([...assignmentSectionIds, ...slotSectionIds].length ? [{ sectionId: { $in: [...new Set([...assignmentSectionIds, ...slotSectionIds])] } }] : []),
    ] });

    // Get today's day of week
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];

    // Today's timetable
    const todayTimetable = await TimetableSlot.find({
      schoolId,
      teacherId: teacherUserId,
      dayOfWeek: todayName,
      ...(currentSession ? { academicSessionId: currentSession._id } : {}),
    }).populate("classId", "name").populate("sectionId", "name").populate("subjectId", "name").sort({ startTime: 1 });

    // Pending attendance check for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceDocs = await StudentAttendance.find({ schoolId, markedByUserId: teacherUserId, date: today }).select("classId sectionId").lean();
    const markedKeys = new Set(attendanceDocs.map((doc: any) => `${String(doc.classId)}:${String(doc.sectionId || "")}`));
    const pendingAttendanceCount = todayTimetable.filter((slot: any) => !markedKeys.has(`${String(slot.classId?._id || slot.classId)}:${String(slot.sectionId?._id || slot.sectionId || "")}`)).length;
    const attendancePending = pendingAttendanceCount > 0;

    // Upcoming exams
    const allowedPairs = assignments.map((item: any) => ({ classId: String(item.classId?._id || item.classId), subjectId: String(item.subjectId?._id || item.subjectId) }));
    const legacyPairs = legacySubjects.map((subject: any) => ({ classId: String(subject.classId), subjectId: String(subject._id) }));
    const relevantPairs = allowedPairs.concat(legacyPairs);
    const relevantExamCandidates = relevantPairs.length && (!branchContext.getStore() || hasFeature(branchContext.getStore()?.plan, "EXAMINATIONS")) ? await ExamSchedule.find({ schoolId, ...(currentSession ? { academicSessionId: currentSession._id } : {}), status: { $nin: ["COMPLETED", "PROCESSED", "PUBLISHED"] }, $or: relevantPairs.map((pair) => ({ classes: pair.classId, subjects: pair.subjectId })) }).sort({ startDate: 1 }).lean() : [];
    const pendingMarksEntries = (await Promise.all(relevantExamCandidates.flatMap((exam: any) => relevantPairs.filter((pair) => exam.classes?.includes(pair.classId) && exam.subjects?.includes(pair.subjectId)).map((pair) => MarksEntry.exists({ schoolId, examId: exam._id, classId: pair.classId, subjectId: pair.subjectId }).then((exists) => !exists))))).filter(Boolean).length;
    const upcomingExams = relevantExamCandidates.slice(0, 3);

    // Recent announcements
    const announcements = await Announcement.find({ schoolId, isPublished: true, $or: [
      { targetRoles: { $exists: false } }, { targetRoles: { $size: 0 } }, { targetRoles: { $in: ["TEACHER", "TEACHERS_ONLY", "ALL_SCHOOL"] } },
    ] }).sort({ createdAt: -1 }).limit(5);

    // Class teacher assignments
    const classTeacherAssignments = await ClassTeacherAssignment.find({
      schoolId,
      teacherUserId,
      ...(currentSession ? { academicSessionId: currentSession._id } : {}),
    }).populate("classId", "name").populate("sectionId", "name").lean();

    return {
      teacher: {
        name: teacher.name,
        email: teacher.email,
        employeeId: profile?.employeeId || null,
        phone: profile?.phone || null,
        qualification: profile?.qualification || null,
        joiningDate: teacher.createdAt ? new Date(teacher.createdAt).toISOString().split("T")[0] : null,
        assignedSubjects: assignedSubjects.map((s: any) => ({ id: s._id, name: s.name, className: s.className || s.classId?.name })),
        teachingAssignments: assignments,
      },
      classTeacherAssignments: classTeacherAssignments.map((cta: any) => ({
        _id: String(cta._id),
        className: cta.classId?.name || "Class",
        sectionName: cta.sectionId?.name || "Section",
        classId: String(cta.classId?._id || cta.classId),
        sectionId: String(cta.sectionId?._id || cta.sectionId),
      })),
      metrics: {
        assignedClassesCount: assignedClassIds.length,
        assignedSubjectsCount: assignedSubjects.length,
        assignedStudentsCount: totalAssignedStudents,
        todayClassesCount: todayTimetable.length,
        attendancePending,
        pendingAttendanceCount,
        pendingMarksEntries,
        pendingLeaveRequests: await LeaveRequest.countDocuments({ schoolId, teacherId: teacherUserId, status: "PENDING" }),
      },
      currentSessionName: currentSession?.name || "",
      todayTimetable,
      upcomingExams,
      announcements,
    };
  }

  // 2. TIMETABLE BUILDER & CONFLICT DETECTION
  static async validateAndCreateTimetableSlot(schoolId: string, data: {
    classId: string;
    sectionId?: string;
    dayOfWeek: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    subjectId: string;
    subjectName: string;
    teacherId?: string;
    teacherName?: string;
    roomNumber?: string;
  }) {
    // 1. Convert times for comparison (e.g. "08:30" => 830)
    const timeToNum = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const newStart = timeToNum(data.startTime);
    const newEnd = timeToNum(data.endTime);

    if (newStart >= newEnd) {
      throw { statusCode: 400, message: "Start time must be earlier than end time." };
    }

    // Fetch all existing slots for the same day in this school
    const existingSlots = await TimetableSlot.find({ schoolId, dayOfWeek: data.dayOfWeek });

    for (const slot of existingSlots) {
      const slotStart = timeToNum(slot.startTime);
      const slotEnd = timeToNum(slot.endTime);

      // Check if time overlaps
      const isOverlap = newStart < slotEnd && newEnd > slotStart;

      if (isOverlap) {
        // Conflict 1: Teacher Conflict
        if (data.teacherId && slot.teacherId && data.teacherId.toString() === slot.teacherId.toString()) {
          throw {
            statusCode: 409,
            message: `CONFLICT: Teacher ${data.teacherName || "assigned"} is already scheduled for Class ${slot.classId} (${slot.subjectName}) on ${data.dayOfWeek} from ${slot.startTime} to ${slot.endTime}.`,
          };
        }

        // Conflict 2: Room Conflict
        if (data.roomNumber && slot.roomNumber && data.roomNumber.toLowerCase() === slot.roomNumber.toLowerCase()) {
          throw {
            statusCode: 409,
            message: `CONFLICT: Room ${data.roomNumber} is already occupied by ${slot.subjectName} on ${data.dayOfWeek} from ${slot.startTime} to ${slot.endTime}.`,
          };
        }

        // Conflict 3: Class & Section Conflict
        if (data.classId === slot.classId.toString() && (!data.sectionId || !slot.sectionId || data.sectionId.toString() === slot.sectionId.toString())) {
          throw {
            statusCode: 409,
            message: `CONFLICT: Class is already scheduled for ${slot.subjectName} on ${data.dayOfWeek} from ${slot.startTime} to ${slot.endTime}.`,
          };
        }
      }
    }

    // If no conflicts, save the timetable slot
    return TimetableSlot.create({ ...data, schoolId });
  }

  // 3. TEACHER'S ASSIGNED STUDENTS & SECURITY CHECK
  static async getTeacherStudents(schoolId: string, teacherUserId: string, classId?: string, search?: string, sectionId?: string, subjectId?: string) {
    // Find all classes assigned to this teacher
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    const teachingAssignments = await TeachingAssignment.find({ schoolId, teacherUserId, status: "ACTIVE", ...(session ? { academicSessionId: session._id } : {}) });
    const classTeacherAssignments = session && !subjectId ? await ClassTeacherAssignment.find({ schoolId, teacherUserId, academicSessionId: session._id }).select("classId sectionId") : [];
    const assignedSubjects = await Subject.find({ schoolId, teacherId: teacherUserId });
    const assignedClassIds = teachingAssignments.map((a) => a.classId.toString());
    assignedSubjects.forEach((s) => { if (!assignedClassIds.includes(s.classId.toString())) assignedClassIds.push(s.classId.toString()); });
    classTeacherAssignments.forEach((a: any) => { if (!assignedClassIds.includes(a.classId.toString())) assignedClassIds.push(a.classId.toString()); });

    const slots = await TimetableSlot.find({ schoolId, teacherId: teacherUserId, ...(session ? { academicSessionId: session._id } : {}) });
    slots.forEach((s) => {
      if (!assignedClassIds.includes(s.classId.toString())) assignedClassIds.push(s.classId.toString());
    });

    if (!assignedClassIds.length) return [];
    const filteredAssignments = teachingAssignments.filter((assignment) => !subjectId || String(assignment.subjectId) === subjectId);
    const filteredSubjects = assignedSubjects.filter((subject) => !subjectId || String(subject._id) === subjectId);
    const filteredSlots = slots.filter((slot) => !subjectId || String(slot.subjectId) === subjectId);
    const allowedClassIds = [...new Set([...filteredAssignments.map((item) => String(item.classId)), ...filteredSubjects.map((item) => String(item.classId)), ...filteredSlots.map((item) => String(item.classId))])];
    if (subjectId && !allowedClassIds.length) throw { statusCode: 403, message: "You are not assigned to this subject." };

    if (assignedClassIds.length === 0) {
      // Return empty if no assigned classes
      return [];
    }

    // If teacher requested a specific classId, verify ownership!
    if (classId) {
      if (!(subjectId ? allowedClassIds : assignedClassIds).includes(classId)) {
        throw { statusCode: 403, message: "FORBIDDEN: You are not assigned to manage this class." };
      }
    }

    const targetClassIds = classId ? [classId] : subjectId ? allowedClassIds : assignedClassIds;
    const scopedSectionIds = [...new Set([
      ...filteredAssignments.filter((a) => targetClassIds.includes(a.classId.toString())).map((a) => a.sectionId.toString()),
      ...filteredSlots.filter((slot) => slot.sectionId && targetClassIds.includes(slot.classId.toString())).map((slot) => slot.sectionId!.toString()),
      ...classTeacherAssignments.filter((assignment: any) => targetClassIds.includes(String(assignment.classId))).map((assignment: any) => String(assignment.sectionId)),
    ])];
    const legacyClassIds = [...new Set([
      ...filteredSubjects.map((subject) => subject.classId.toString()),
      ...filteredSlots.filter((slot) => !slot.sectionId).map((slot) => slot.classId.toString()),
    ].filter((id) => targetClassIds.includes(id)))];

    const scope: any[] = [{
      $or: [
        ...(legacyClassIds.length ? [{ classId: { $in: legacyClassIds } }] : []),
        ...(scopedSectionIds.length ? [{ sectionId: { $in: scopedSectionIds } }] : []),
      ],
    }];

    if (search) {
      scope.push({ $or: [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { admissionNumber: { $regex: search, $options: "i" } },
      ] });
    }
    const query: any = { schoolId, status: "ACTIVE", classId: { $in: targetClassIds }, ...(session ? { $or: [{ academicSessionId: session._id }, { academicSessionId: { $exists: false } }] } : {}), $and: scope };
    if (sectionId) {
      const allowedSection = filteredAssignments.some((assignment) => String(assignment.sectionId) === sectionId && (!classId || String(assignment.classId) === classId)) || filteredSlots.some((slot) => String(slot.sectionId) === sectionId && (!classId || String(slot.classId) === classId)) || classTeacherAssignments.some((assignment: any) => String(assignment.sectionId) === sectionId && (!classId || String(assignment.classId) === classId)) || filteredSubjects.some((subject) => (!classId || String(subject.classId) === classId));
      if (!allowedSection) throw { statusCode: 403, message: "You are not assigned to this class section." };
      query.sectionId = sectionId;
    } else if (!legacyClassIds.length) {
      query.sectionId = { $in: scopedSectionIds };
    }

    return Student.find(query).populate("sectionId", "name").sort({ className: 1, rollNumber: 1 });
  }

  static async getClassTeacherSections(schoolId: string, teacherUserId: string) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id name");
    if (!session) return [];
    return ClassTeacherAssignment.find({ schoolId, academicSessionId: session._id, teacherUserId })
      .populate("classId", "name").populate("sectionId", "name").populate("academicSessionId", "name").lean();
  }

  private static async assertClassTeacher(schoolId: string, teacherUserId: string, classId: string, sectionId: string) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    if (!session) throw { statusCode: 403, message: "No current academic session is configured." };
    const [classRecord, section, assignment] = await Promise.all([
      ClassModel.findOne({ _id: classId, schoolId }).select("_id name"),
      SectionModel.findOne({ _id: sectionId, classId, schoolId }).select("_id name"),
      ClassTeacherAssignment.exists({ schoolId, academicSessionId: session._id, classId, sectionId, teacherUserId }),
    ]);
    if (!classRecord || !section) throw { statusCode: 400, message: "Select a valid class section." };
    if (!assignment) throw { statusCode: 403, message: "Only the assigned Class Teacher can mark attendance for this section." };
    return { classRecord, section, session };
  }

  static async getAttendanceRoster(schoolId: string, teacherUserId: string, classId: string, sectionId: string, dateValue: string) {
    const { classRecord, section, session } = await this.assertClassTeacher(schoolId, teacherUserId, classId, sectionId);
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) throw { statusCode: 400, message: "Select a valid attendance date." };
    date.setHours(0, 0, 0, 0);
    const [students, attendance] = await Promise.all([
      Student.find({ schoolId, classId, sectionId, status: "ACTIVE", ...(session ? { academicSessionId: session._id } : {}) }).select("name rollNumber status photoUrl updatedAt").sort({ rollNumber: 1 }).lean(),
      StudentAttendance.findOne({ schoolId, classId, sectionId, date, $or: [{ academicSessionId: session._id }, { academicSessionId: { $exists: false } }] }).lean(),
    ]);
    const savedRecords: any[] = (attendance as any)?.records || [];
    const existing = new Map(savedRecords.map((record: any) => [String(record.studentId), record]));
    return { date, className: classRecord.name, sectionName: section?.name || "", students: students.map((student: any) => {
      const saved: any = existing.get(String(student._id));
      return { studentId: student._id, photoUrl:student.photoUrl,updatedAt:student.updatedAt, name: student.name, rollNumber: student.rollNumber, status: saved?.status || "PRESENT", remarks: saved?.remarks || "" };
    }) };
  }

  static async getTeacherAttendanceReport(schoolId: string, teacherUserId: string, from?: string, to?: string, classId?: string, sectionId?: string) {
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    const assignments = await TeachingAssignment.find({ schoolId, teacherUserId, status: "ACTIVE", ...(session ? { academicSessionId: session._id } : {}) }).select("classId sectionId").lean();
    const legacySubjects = await Subject.find({ schoolId, teacherId: teacherUserId }).select("classId").lean();
    const legacySlots = await TimetableSlot.find({ schoolId, teacherId: teacherUserId, ...(session ? { academicSessionId: session._id } : {}) }).select("classId sectionId").lean();
    const legacyClassIds = [...new Set([...legacySubjects.map((item: any) => String(item.classId)), ...legacySlots.filter((slot: any) => !slot.sectionId).map((item: any) => String(item.classId))])];
    const classIds = [...new Set([...assignments.map((item: any) => String(item.classId)), ...legacyClassIds])];
    if (classId && !classIds.includes(classId)) throw { statusCode: 403, message: "You are not assigned to this class." };
    const sections = assignments.filter((item: any) => !classId || String(item.classId) === classId).map((item: any) => String(item.sectionId));
    if (sectionId && !sections.includes(sectionId) && !legacySlots.some((slot: any) => String(slot.sectionId) === sectionId && String(slot.classId) === classId)) throw { statusCode: 403, message: "You are not assigned to this class section." };
    const query: any = { schoolId, classId: { $in: classId ? [classId] : classIds } };
    if (from || to) query.date = { ...(from ? { $gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59.999`) } : {}) };
    if (sectionId) query.sectionId = sectionId;
    const docs = await StudentAttendance.find(query).sort({ date: -1 }).lean();
    const assignedSectionSet = new Set([...assignments.map((item: any) => String(item.sectionId)), ...legacySlots.filter((slot: any) => slot.sectionId).map((item: any) => String(item.sectionId))]);
    const hasLegacyClass = (id: string) => legacyClassIds.includes(id);
    return docs.flatMap((doc: any) => {
      const classKey = String(doc.classId);
      if (!hasLegacyClass(classKey) && !assignedSectionSet.has(String(doc.sectionId))) return [];
      return doc.records.map((record: any) => ({ studentId: record.studentId, studentName: record.studentName, rollNumber: record.rollNumber, status: record.status, date: doc.date, classId: doc.classId, className: doc.className, sectionId: doc.sectionId, sectionName: doc.sectionName }));
    });
  }

  // 4. TEACHER ATTENDANCE MARKING (STRICT SCOPE)
  static async saveAttendance(schoolId: string, teacherUserId: string, data: {
    classId: string;
    sectionId?: string;
    date: string;
    records: Array<{ studentId: string; studentName: string; rollNumber: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE"; remarks?: string }>;
  }, isSchoolAdmin = false) {
    if (!data.sectionId) throw { statusCode: 400, message: "Select a section." };
    let classRecord: any; let section: any; let session: any;
    if (isSchoolAdmin) {
      [classRecord, section, session] = await Promise.all([
        ClassModel.findOne({ _id: data.classId, schoolId }).select("_id name"),
        SectionModel.findOne({ _id: data.sectionId, classId: data.classId, schoolId }).select("_id name"),
        AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id"),
      ]);
      if (!classRecord || !section || !session) throw { statusCode: 400, message: "Select a valid section in the current academic session." };
    } else ({ classRecord, section, session } = await this.assertClassTeacher(schoolId, teacherUserId, data.classId, data.sectionId));

    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);

    const activeStudents = await Student.find({ schoolId, classId: data.classId, sectionId: data.sectionId || null, status: "ACTIVE", ...(session ? { academicSessionId: session._id } : {}) }).select("_id name rollNumber").lean();
    const activeById = new Map(activeStudents.map((student: any) => [String(student._id), student]));
    if (!data.records.length || data.records.some((record) => !activeById.has(String(record.studentId)))) throw { statusCode: 400, message: "Attendance must include only active students from your assigned class section." };
    const recordIds = data.records.map((record) => String(record.studentId));
    if (new Set(recordIds).size !== recordIds.length || activeById.size !== recordIds.length) throw { statusCode: 400, message: "Submit each active student in this section exactly once." };
    const records = data.records.map((record) => {
      const student: any = activeById.get(String(record.studentId));
      return { studentId: student._id, studentName: student.name, rollNumber: student.rollNumber, status: record.status, remarks: record.remarks };
    });
    const teacher = await User.findOne({ _id: teacherUserId, schoolId }).select("name email");

    const doc = await StudentAttendance.findOneAndUpdate(
      { schoolId, classId: data.classId, sectionId: data.sectionId, date },
      {
        $set: {
          schoolId,
          academicSessionId: session._id,
          classId: data.classId,
          className: classRecord.name,
          sectionId: data.sectionId || null,
          sectionName: section?.name,
          date,
          records,
          markedByUserId: teacherUserId,
          markedByName: teacher?.name || teacher?.email || "Teacher",
        },
      },
      { upsert: true, new: true }
    );
    void TeacherNotification.create({ schoolId, teacherUserId, title: "Student attendance submitted", message: `Attendance for ${classRecord.name} · ${section.name} has been submitted.`, href: "/teacher/attendance" }).catch(() => console.warn("[TEACHER-NOTIFICATION] Unable to create attendance notification."));
    return doc;
  }

  static async getMyAttendance(schoolId: string, teacherUserId: string, from?: string, to?: string) {
    const query: any = { schoolId, "records.teacherUserId": teacherUserId };
    if (from || to) query.date = { ...(from ? { $gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59.999`) } : {}) };
    const docs = await TeacherAttendance.find(query).sort({ date: -1 }).lean();
    const merged=mergeTeacherBatches(docs,await teacherBatches(schoolId,from,to,teacherUserId));
    return merged.map((doc: any) => ({ date: doc.date, ...(doc.records || []).find((item: any) => String(item.teacherUserId) === teacherUserId) })).filter((item: any) => item.teacherUserId);
  }

  static async checkInTeacher(schoolId:string,teacherUserId:string){const {manual}=await import("./workforce.service");return manual({schoolId,userId:teacherUserId,userType:"TEACHER"},"in");}
  static async checkOutTeacher(schoolId:string,teacherUserId:string){const {manual}=await import("./workforce.service");return manual({schoolId,userId:teacherUserId,userType:"TEACHER"},"out");}

  // 5. TEACHER MARKS ENTRY (STRICT SCOPE)
  static async saveMarks(schoolId: string, teacherUserId: string, data: {
    examId: string;
    classId: string;
    subjectId: string;
    marksRecords: Array<{ studentId: string; obtainedMarks?: number; isAbsent?:boolean; remarks?: string }>;
  }) {
    // Security check: Verify teacher is assigned to this subject & class!
    const subject = await Subject.findOne({ _id: data.subjectId, schoolId, classId: data.classId });
    if (!subject) throw { statusCode: 404, message: "Subject not found." };

    const exam = await ExamSchedule.findOne({ _id: data.examId, schoolId });
    if (!exam || !exam.classes.includes(data.classId) || !exam.subjects.includes(data.subjectId)) throw { statusCode: 400, message: "This exam does not include the selected class and subject." };
    const currentSession = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("_id");
    if (currentSession && exam.academicSessionId && String(exam.academicSessionId) !== String(currentSession._id)) throw { statusCode: 403, message: "Marks can only be entered for the current academic session." };
    const assignment = await TeachingAssignment.exists({ schoolId, teacherUserId, classId: data.classId, subjectId: data.subjectId, status: "ACTIVE", ...(currentSession ? { academicSessionId: currentSession._id } : {}) });
    if (!assignment && (!subject.teacherId || subject.teacherId.toString() !== teacherUserId)) throw { statusCode: 403, message: "You are not assigned to this subject and class." };
    const allowedAssignments = await TeachingAssignment.find({ schoolId, teacherUserId, classId: data.classId, subjectId: data.subjectId, status: "ACTIVE", ...(currentSession ? { academicSessionId: currentSession._id } : {}) }).select("sectionId").lean();
    const studentQuery: any = { schoolId, classId: data.classId, status: "ACTIVE" };
    if (allowedAssignments.length && allowedAssignments.some((item: any) => item.sectionId)) studentQuery.sectionId = { $in: allowedAssignments.map((item: any) => item.sectionId) };
    const roster = await Student.find(studentQuery).select("_id name rollNumber").lean();
    const rosterById = new Map(roster.map((student: any) => [String(student._id), student]));
    if (!data.marksRecords.length || data.marksRecords.some((record) => !rosterById.has(String(record.studentId)) || !record.isAbsent && (!Number.isFinite(record.obtainedMarks) || record.obtainedMarks! < 0 || record.obtainedMarks! > subject.totalMarks))) throw { statusCode: 400, message: "Marks must be within the subject limit and belong to students in your assigned class." };
    const recordIds = data.marksRecords.map((record) => String(record.studentId));
    if (new Set(recordIds).size !== recordIds.length) throw { statusCode: 400, message: "Submit marks for each active student in your assigned class exactly once." };
    const teacher = await User.findOne({ _id: teacherUserId, schoolId, userType: "TEACHER" });
    const classRecord = await ClassModel.findOne({ _id: data.classId, schoolId }).select("name");
    const records = data.marksRecords.map((record) => { const student: any = rosterById.get(String(record.studentId)); return { studentId: student._id, studentName: student.name, rollNumber: student.rollNumber, obtainedMarks: record.isAbsent?0:record.obtainedMarks, isAbsent:Boolean(record.isAbsent), remarks: record.remarks }; });
    const doc = await persistMarks(schoolId, {
          schoolId,
          examId: data.examId,
          classId: data.classId,
          subjectId: data.subjectId,
          examTitle: exam.title,
          className: classRecord?.name || "",
          subjectName: subject.name,
          maxMarks: subject.totalMarks,
          passingMarks: subject.passingMarks,
          enteredByTeacherId: teacherUserId,
          enteredByTeacherName: teacher?.name || teacher?.email || "Teacher",
          status: "SUBMITTED",
    }, records);

    return doc;
  }

  // 6. TEACHER LEAVE REQUEST SYSTEM
  static async applyLeave(schoolId: string, teacherUserId: string, data: {
    leaveType: "Casual" | "Sick" | "Earned" | "Maternity" | "Unpaid";
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    const teacher = await User.findOne({ _id: teacherUserId, schoolId, userType: "TEACHER" });
    if (!teacher) throw { statusCode: 404, message: "Teacher not found." };
    const profile = await TeacherProfile.findOne({ schoolId, userId: teacherUserId }).select("employeeId");

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return LeaveRequest.create({
      schoolId,
      teacherId: teacherUserId,
      teacherName: teacher.name,
      employeeId: profile?.employeeId || "",
      leaveType: data.leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason: data.reason,
      status: "PENDING",
    });
  }

  static async getTeacherLeaves(schoolId: string, teacherUserId: string) {
    return LeaveRequest.find({ schoolId, teacherId: teacherUserId }).sort({ createdAt: -1 });
  }

  static async getSchoolLeavesForAdmin(schoolId: string, statusFilter?: string) {
    const query: any = { schoolId };
    if (statusFilter && statusFilter !== "ALL") query.status = statusFilter;
    return LeaveRequest.find(query).sort({ createdAt: -1 });
  }

  static async reviewLeaveRequest(schoolId: string, leaveId: string, status: "APPROVED" | "REJECTED", reviewerName: string, comment?: string) {
    const {reviewLeave}=await import("./workforce.service");const {branchContext}=await import("../utils/branchScope");const context=branchContext.getStore();
    const leave=await reviewLeave({schoolId,userId:context?.userId,userType:"SCHOOL_ADMIN",email:reviewerName},leaveId,status,reviewerName,comment);

    await TeacherNotification.create({ schoolId, teacherUserId: leave.teacherId, title: `Leave request ${status.toLowerCase()}`, message: `Your ${leave.leaveType.toLowerCase()} leave request for ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} was ${status.toLowerCase()}.${comment ? ` ${comment}` : ""}`, href: "/my-attendance" }).catch(() => console.warn("[TEACHER-NOTIFICATION] Unable to create leave status notification."));

    return leave;
  }

  // 7. TEACHER CLASSES & STUDENT HISTORY
  static async getTeacherClasses(schoolId: string, teacherUserId: string) {
    const currentSession = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("name");
    const sessionFilter = currentSession ? { academicSessionId: currentSession._id } : {};

    const assignments = await TeachingAssignment.find({ schoolId, teacherUserId, status: "ACTIVE", ...sessionFilter })
      .populate("classId", "name code")
      .populate("sectionId", "name roomNumber capacity")
      .populate("subjectId", "name code")
      .lean();

    const classTeacherAssignments = currentSession
      ? await ClassTeacherAssignment.find({ schoolId, academicSessionId: currentSession._id, teacherUserId })
          .populate("classId", "name code")
          .populate("sectionId", "name roomNumber capacity")
          .lean()
      : [];

    const directSubjects = await Subject.find({ schoolId, teacherId: teacherUserId })
      .populate("classId", "name code")
      .lean();

    const classMap = new Map<string, any>();

    for (const item of assignments as any[]) {
      const cid = String(item.classId?._id || item.classId);
      const sid = String(item.sectionId?._id || item.sectionId);
      const key = `${cid}:${sid}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          classId: item.classId?._id || item.classId,
          className: item.classId?.name || "Class",
          classCode: item.classId?.code || "",
          sectionId: item.sectionId?._id || item.sectionId,
          sectionName: item.sectionId?.name || "Section",
          roomNumber: item.sectionId?.roomNumber || "",
          capacity: item.sectionId?.capacity || 40,
          academicSessionName: currentSession?.name || "",
          isClassTeacher: false,
          subjects: [],
          studentCount: 0,
        });
      }
      const record = classMap.get(key);
      if (item.subjectId && !record.subjects.some((s: any) => String(s._id) === String(item.subjectId._id))) {
        record.subjects.push({ _id: item.subjectId._id, name: item.subjectId.name, code: item.subjectId.code });
      }
    }

    for (const item of classTeacherAssignments as any[]) {
      const cid = String(item.classId?._id || item.classId);
      const sid = String(item.sectionId?._id || item.sectionId);
      const key = `${cid}:${sid}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          classId: item.classId?._id || item.classId,
          className: item.classId?.name || "Class",
          classCode: item.classId?.code || "",
          sectionId: item.sectionId?._id || item.sectionId,
          sectionName: item.sectionId?.name || "Section",
          roomNumber: item.sectionId?.roomNumber || "",
          capacity: item.sectionId?.capacity || 40,
          academicSessionName: currentSession?.name || "",
          isClassTeacher: true,
          subjects: [],
          studentCount: 0,
        });
      } else {
        classMap.get(key).isClassTeacher = true;
      }
    }

    for (const subject of directSubjects as any[]) {
      const classObj = subject.classId;
      const cid = String((classObj as any)?._id || classObj || "");
      if (!cid) continue;

      const sections = await SectionModel.find({ schoolId, classId: cid }).lean();
      if (sections.length > 0) {
        for (const sec of sections as any[]) {
          const sid = String(sec._id);
          const key = `${cid}:${sid}`;
          if (!classMap.has(key)) {
            classMap.set(key, {
              classId: (classObj as any)?._id || cid,
              className: (classObj as any)?.name || subject.className || "Class",
              classCode: (classObj as any)?.code || "",
              sectionId: sec._id,
              sectionName: sec.name || "Section",
              roomNumber: sec.roomNumber || "",
              capacity: sec.capacity || 40,
              academicSessionName: currentSession?.name || "",
              isClassTeacher: false,
              subjects: [],
              studentCount: 0,
            });
          }
          const record = classMap.get(key);
          if (!record.subjects.some((s: any) => String(s._id) === String(subject._id))) {
            record.subjects.push({ _id: subject._id, name: subject.name, code: subject.code });
          }
        }
      } else {
        const key = `${cid}:general`;
        if (!classMap.has(key)) {
          classMap.set(key, {
            classId: (classObj as any)?._id || cid,
            className: (classObj as any)?.name || subject.className || "Class",
            classCode: (classObj as any)?.code || "",
            sectionId: undefined,
            sectionName: "All Sections",
            roomNumber: "",
            capacity: 40,
            academicSessionName: currentSession?.name || "",
            isClassTeacher: false,
            subjects: [],
            studentCount: 0,
          });
        }
        const record = classMap.get(key);
        if (!record.subjects.some((s: any) => String(s._id) === String(subject._id))) {
          record.subjects.push({ _id: subject._id, name: subject.name, code: subject.code });
        }
      }
    }

    const classesList = Array.from(classMap.values());
    for (const cls of classesList) {
      const studentFilter: any = {
        schoolId,
        classId: cls.classId,
        status: "ACTIVE",
      };
      if (cls.sectionId) {
        studentFilter.sectionId = cls.sectionId;
      }
      cls.studentCount = await Student.countDocuments(studentFilter);
    }

    return classesList;
  }

  static async getStudentHistory(schoolId: string, studentId: string, teacherUserId?: string) {
    if (teacherUserId) { const allowed = await this.getTeacherStudents(schoolId, teacherUserId); if (!allowed.some((s: any) => String(s._id) === studentId)) throw { statusCode: 404, message: "Student is not assigned to your classes." }; }
    const student = await Student.findOne({ _id: studentId, schoolId })
      .populate("classId", "name code")
      .populate("sectionId", "name roomNumber")
      .populate("academicSessionId", "name")
      .lean();

    if (!student) throw { statusCode: 404, message: "Student record not found." };

    const results = !branchContext.getStore() || hasFeature(branchContext.getStore()?.plan, "EXAMINATIONS") ? await ProcessedResult.find({ schoolId, studentId }).sort({ createdAt: -1 }).lean() : [];

    const attendanceDocs = await StudentAttendance.find({
      schoolId,
      "records.studentId": studentId,
    }).sort({ date: -1 }).limit(100).lean();

    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;

    const recentAttendance = attendanceDocs.map((doc: any) => {
      const rec = doc.records.find((r: any) => String(r.studentId) === String(studentId));
      const status = rec?.status || "PRESENT";
      if (status === "PRESENT") presentDays++;
      else if (status === "ABSENT") absentDays++;
      else if (status === "LATE") lateDays++;
      else if (status === "LEAVE") leaveDays++;

      return {
        date: doc.date,
        className: doc.className,
        sectionName: doc.sectionName,
        status,
        remarks: rec?.remarks || "",
      };
    });

    const totalDays = presentDays + absentDays + lateDays + leaveDays;
    const attendancePercentage = totalDays > 0 ? Number((((presentDays + lateDays) / totalDays) * 100).toFixed(1)) : 100;

    const lifecycleEvents = await StudentLifecycleEvent.find({ schoolId, studentId }).sort({ createdAt: -1 }).lean();

    return {
      student,
      examResults: results,
      attendanceSummary: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        leaveDays,
        attendancePercentage,
        recentAttendance: recentAttendance.slice(0, 20),
      },
      lifecycleEvents,
    };
  }
}
