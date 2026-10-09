import {School} from "../models/school.model";
import {persistMarks} from "./marksPersistence.service";
import mongoose from "mongoose";
import { ExamSchedule, GradingScale, MarksEntry, ProcessedResult, CertificateRecord } from "../models/exam.model";
import { Student } from "../models/student.model";
import { AuditLog } from "../models/auditLog.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { Subject } from "../models/subject.model";
import { AcademicSession } from "../models/academicSession.model";
import { StudentAttendance } from "../models/attendance.model";

export class ExamService {
  // 1. DEFAULT GRADING SCALE HELPER
  static getDefaultRules() {
    return [
      { grade: "A+", minPercentage: 90, maxPercentage: 100, remarks: "Outstanding" },
      { grade: "A", minPercentage: 80, maxPercentage: 89.99, remarks: "Excellent" },
      { grade: "B", minPercentage: 70, maxPercentage: 79.99, remarks: "Very Good" },
      { grade: "C", minPercentage: 60, maxPercentage: 69.99, remarks: "Good" },
      { grade: "D", minPercentage: 50, maxPercentage: 59.99, remarks: "Satisfactory" },
      { grade: "F", minPercentage: 0, maxPercentage: 49.99, remarks: "Needs Improvement" },
    ];
  }

  static calculateGrade(percentage: number, rules: Array<{ grade: string; minPercentage: number; maxPercentage: number }>) {
    const sorted = [...rules].sort((a, b) => b.minPercentage - a.minPercentage);
    for (const r of sorted) {
      if (percentage >= r.minPercentage) {
        return r.grade;
      }
    }
    return "F";
  }

  // 2. DASHBOARD METRICS
  static async getDashboardMetrics(schoolId: string) {
    const today = new Date();
    const [
      totalExams,
      upcomingExams,
      activeExams,
      completedExams,
      candidateCount,
      marksEntriesCount,
      publishedResultsCount,
      recentLogs
    ] = await Promise.all([
      ExamSchedule.countDocuments({ schoolId }),
      ExamSchedule.countDocuments({ schoolId, startDate: { $gt: today } }),
      ExamSchedule.countDocuments({ schoolId, startDate: { $lte: today }, endDate: { $gte: today } }),
      ExamSchedule.countDocuments({ schoolId, status: { $in: ["PROCESSED", "PUBLISHED"] } }),
      Student.countDocuments({ schoolId, status: "ACTIVE" }),
      MarksEntry.countDocuments({ schoolId }),
      ProcessedResult.countDocuments({ schoolId, isPublished: true }),
      AuditLog.find({ schoolId, action: { $regex: "^(EXAM|MARKS|CERTIFICATE)" } }).sort({ createdAt: -1 }).limit(8),
    ]);

    return {
      totalExams,
      upcomingExams,
      activeExams,
      completedExams,
      candidateCount,
      marksEntriesCount,
      publishedResultsCount,
      recentLogs,
    };
  }

  // 3. EXAM SCHEDULES
  static async getExams(schoolId: string) {
    return ExamSchedule.find({ schoolId }).sort({ startDate: -1 });
  }

  static async createExam(schoolId: string, data: any) {
    const classes=await ClassModel.find({schoolId,$or:[{_id:{$in:data.classes.filter((v:string)=>mongoose.Types.ObjectId.isValid(v))}},{name:{$in:data.classes}}]});
    if(classes.length!==new Set(data.classes).size)throw {statusCode:400,message:"Select classes belonging to this school."};
    const session=data.academicSessionId?await AcademicSession.findOne({_id:data.academicSessionId,schoolId}):await AcademicSession.findOne({schoolId,isCurrent:true});
    if(!session)throw {statusCode:400,message:"Select an academic session belonging to this school."};
    const subjects=await Subject.find({schoolId,classId:{$in:classes.map(c=>c._id)}}).select("_id");
    if(!subjects.length)throw {statusCode:400,message:"Configure subjects for the selected classes before creating the exam."};
    data={...data,classes:classes.map(c=>String(c._id)),subjects:subjects.map(s=>String(s._id)),academicSessionId:session._id};
    const academicSessionName=session.name;

    const exam = await ExamSchedule.create({
      ...data,
      schoolId,
      academicSessionName: academicSessionName || "Current Session",
      status: data.status || "SCHEDULED",
    });

    await AuditLog.create({
      schoolId,
      action: "EXAM_SCHEDULE_CREATED",
      performedByName: "Examination Staff",
      details: `Created examination schedule for "${exam.title}".`,
    });

    return exam;
  }

  // 4. GRADING SCALE CONFIGURATION
  static async getGradingScale(schoolId: string) {
    let scale = await GradingScale.findOne({ schoolId });
    if (!scale) {
      scale = await GradingScale.create({
        schoolId,
        title: "Standard School Grading Scale",
        rules: this.getDefaultRules(),
        isDefault: true,
      });
    }
    return scale;
  }

  static async updateGradingScale(schoolId: string, rules: any[]) {
    const scale = await GradingScale.findOneAndUpdate(
      { schoolId },
      { $set: { rules, isDefault: false } },
      { upsert: true, new: true }
    );
    return scale;
  }

  // 5. MARKS LOOKUP
  static async getMarks(schoolId: string, examId?: string, classId?: string, subjectId?: string, sectionId?: string) {
    const query: any = { schoolId };
    if (examId && mongoose.Types.ObjectId.isValid(examId)) query.examId = examId;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) query.classId = classId;
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) query.subjectId = subjectId;

    const entries = await MarksEntry.find(query).sort({ createdAt: -1 });

    if (sectionId && mongoose.Types.ObjectId.isValid(sectionId)) {
      const sectionStudents = await Student.find({ schoolId, classId, sectionId, status: "ACTIVE" }).select("_id");
      const sectionStudentIds = new Set(sectionStudents.map((s) => s._id.toString()));

      return entries.map((entry) => {
        const doc = entry.toObject();
        doc.records = doc.records.filter((r: any) => sectionStudentIds.has(r.studentId.toString()));
        return doc;
      });
    }

    return entries;
  }

  // 6. MARKS ENTRY & AUDIT
  static async saveMarksEntry(schoolId: string, data: {
    examId: string;
    classId: string;
    subjectId: string;
    subjectName?: string;
    maxMarks: number;
    passingMarks?: number;
    records: Array<{ studentId: string; studentName?: string; rollNumber?: string; obtainedMarks: number; remarks?: string; isAbsent?: boolean }>;
  }, userName: string) {
    const exam = await ExamSchedule.findOne({ _id: data.examId, schoolId });
    if(!exam)throw {statusCode:404,message:"Exam not found."};
    if(!exam.classes.includes(data.classId))throw {statusCode:400,message:"This class is not included in the examination."};
    const examTitle = exam ? exam.title : "Exam Session";

    const linkedClass = await ClassModel.findOne({ _id: data.classId, schoolId }).select("name");
    const className = linkedClass ? linkedClass.name : "Class";

    const subject = await Subject.findOne({ _id: data.subjectId, schoolId,classId:data.classId }).select("name");
    const subjectName = subject?.name || "Subject";

    if(!linkedClass||!subject)throw {statusCode:400,message:"Select a valid class subject."};
    const scale = await this.getGradingScale(schoolId);

    // Populate student names and roll numbers if missing
    const studentIds = data.records.map((r) => r.studentId);
    const studentsMap = new Map<string, any>();
    if (studentIds.length > 0) {
      const studentDocs = await Student.find({ _id: { $in: studentIds }, schoolId,classId:data.classId }).select("name rollNumber");
      studentDocs.forEach((s) => studentsMap.set(s._id.toString(), s));
    }

    if(studentsMap.size!==new Set(studentIds).size||new Set(studentIds).size!==studentIds.length)throw {statusCode:400,message:"Every student must belong to this class and appear only once."};
    const processedRecords = data.records.map((r: any) => {
      const sDoc = studentsMap.get(r.studentId.toString());
      const studentName = sDoc.name;
      const rollNumber = sDoc.rollNumber;

      const obtainedMarks = r.isAbsent?0:Number(r.obtainedMarks);
      if(!Number.isFinite(obtainedMarks)||obtainedMarks<0||obtainedMarks>data.maxMarks)throw {statusCode:400,message:"Marks must be within the subject maximum."};
      const pct = data.maxMarks > 0 ? (obtainedMarks / data.maxMarks) * 100 : 0;
      const grade = r.isAbsent ? "F" : this.calculateGrade(pct, scale.rules);

      return {
        studentId: r.studentId,
        studentName,
        rollNumber,
        obtainedMarks,
        grade,
        remarks: r.remarks || (r.isAbsent ? "Absent" : ""),
        isAbsent: Boolean(r.isAbsent),
      };
    });

    const doc = await persistMarks(schoolId, {
          schoolId,
          examId: data.examId,
          examTitle,
          classId: data.classId,
          className,
          subjectId: data.subjectId,
          subjectName,
          maxMarks: data.maxMarks,
          passingMarks: data.passingMarks ?? 33,
          enteredByTeacherName: userName,
          status: "SUBMITTED",
    }, processedRecords);

    await AuditLog.create({
      schoolId,
      action: "MARKS_ENTRY_UPDATED",
      performedByName: userName,
      details: `Marks saved for ${subjectName} (${className}) - ${processedRecords.length} student records.`,
    });

    return doc;
  }

  // 7. RESULT PROCESSING & MERIT RANK COMPUTATION
  static async processResults(schoolId: string, examId: string, classId: string, userName: string, dbSession?: mongoose.ClientSession) {
    if(!dbSession){const tx=await mongoose.startSession();let result:any;try{await tx.withTransaction(async()=>{await School.updateOne({_id:schoolId},{$inc:{academicRevision:1}},{session:tx});result=await this.processResults(schoolId, examId, classId, userName, tx);});return result;}finally{await tx.endSession();}}
    const exam = await ExamSchedule.findOne({ _id: examId, schoolId }).session(dbSession);
    if (!exam) throw { statusCode: 404, message: "Exam session not found." };

    const marksEntries = await MarksEntry.find({ schoolId, examId, classId, status:{$ne:"DRAFT"} }).session(dbSession);
    if (marksEntries.length === 0) {
      throw { statusCode: 400, message: "No marks entries found for this class and exam session." };
    }

    const scale = await this.getGradingScale(schoolId);
    const students = await Student.find({ schoolId, classId, status: "ACTIVE",...(exam.academicSessionId?{$or:[{academicSessionId:exam.academicSessionId},{academicSessionId:null}]}:{}) }).session(dbSession);

    // Pre-calculate student attendance percentage if attendance records exist
    const attendanceRecords = await StudentAttendance.find({ schoolId, classId }).session(dbSession);
    const attendanceMap = new Map<string, { present: number; total: number }>();

    attendanceRecords.forEach((att: any) => {
      att.records.forEach((rec: any) => {
        const sId = rec.studentId.toString();
        const curr = attendanceMap.get(sId) || { present: 0, total: 0 };
        curr.total += 1;
        if (rec.status === "PRESENT" || rec.status === "LATE") curr.present += 1;
        attendanceMap.set(sId, curr);
      });
    });

    const classSubjects=await Subject.find({schoolId,classId}).sort({name:1}).session(dbSession);
    const studentResults: any[] = [];

    for (const student of students) {
      let studentTotalMax = 0;
      let studentTotalObtained = 0;
      const subjectScores: any[] = [];
      let isAnySubjectFailed = false;

      let pending=false;
      for (const subject of classSubjects) {
        const entry=marksEntries.find(e=>String(e.subjectId)===String(subject._id));
        const studentRec=entry?.records.find((r:any)=>String(r.studentId)===String(student._id));
        const max=entry?.maxMarks??subject.totalMarks??100;studentTotalMax+=max;
        if(!studentRec){pending=true;subjectScores.push({subjectId:subject._id,subjectName:subject.name,maxMarks:max,obtainedMarks:null,grade:"PENDING",remarks:"Marks not entered"});continue;}
        const obtained=studentRec.isAbsent?0:studentRec.obtainedMarks;
        const pct=max>0?obtained/max*100:0;
        const grade=studentRec.isAbsent?"ABSENT":this.calculateGrade(pct,scale.rules);
        if(studentRec.isAbsent||obtained<(entry?.passingMarks??subject.passingMarks??33))isAnySubjectFailed=true;
        studentTotalObtained+=obtained;
        subjectScores.push({subjectId:subject._id,subjectName:subject.name,maxMarks:max,obtainedMarks:obtained,grade,isAbsent:!!studentRec.isAbsent,remarks:studentRec.isAbsent?"Absent":studentRec.remarks||""});
      }
      const overallPct=pending?null:studentTotalMax>0?Number((studentTotalObtained/studentTotalMax*100).toFixed(2)):null;
      const overallGrade=overallPct===null?"PENDING":this.calculateGrade(overallPct,scale.rules);
      const status=pending||overallPct===null?"PENDING":isAnySubjectFailed?"FAILED":"PASSED";
      const attStats=attendanceMap.get(String(student._id));
      const attendancePercentage=attStats?.total?Number((attStats.present/attStats.total*100).toFixed(1)):undefined;

      studentResults.push({
        schoolId,
        examId,
        examTitle: exam.title,
        classId,
        className: student.className || "Class",
        studentId: student._id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        subjectScores,
        totalMaxMarks: studentTotalMax,
        totalObtainedMarks: studentTotalObtained,
        percentage: overallPct,
        overallGrade,
        status,
        attendancePercentage,
        isPublished: false,
        needsProcessing:false,
      });
    }

    // Compute Merit Position Ranks
    studentResults.sort((a,b)=>(b.percentage??-1)-(a.percentage??-1));
    let rank=0;studentResults.forEach(res=>{res.rank=res.status==="PENDING"?undefined:++rank;});

    // Save Processed Results
    for (const resData of studentResults) {
      await ProcessedResult.findOneAndUpdate(
        { schoolId, examId, studentId: resData.studentId },
        { $set: resData },
        { upsert: true, new: true,session:dbSession }
      );
    }

    exam.status = "PROCESSED";
    await exam.save({session:dbSession});

    await AuditLog.create([{
      schoolId,
      action: "EXAM_RESULTS_PROCESSED",
      performedByName: userName,
      details: `Processed & ranked results for ${exam.title} (${studentResults.length} students ranked).`,
    }],{session:dbSession});

    return { count: studentResults.length, message: `Processed & ranked results for ${studentResults.length} students.` };
  }

  static async getResults(schoolId: string, examId?: string, classId?: string) {
    const query: any = { schoolId };
    if (examId && mongoose.Types.ObjectId.isValid(examId)) query.examId = examId;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) query.classId = classId;

    let results = await ProcessedResult.find(query).sort({ rank: 1, percentage: -1 });


    return results;
  }

  // 8. RESULT PUBLISHING & UNPUBLISHING
  static async publishResults(schoolId: string, examId: string, classId: string, publish: boolean, userName: string, dbSession?: mongoose.ClientSession) {
    if(!dbSession){const tx=await mongoose.startSession();let result:any;try{await tx.withTransaction(async()=>{await School.updateOne({_id:schoolId},{$inc:{academicRevision:1}},{session:tx});result=await this.publishResults(schoolId, examId, classId, publish, userName, tx);});return result;}finally{await tx.endSession();}}
    const selectedExam=await ExamSchedule.findOne({_id:examId,schoolId,classes:classId}).session(dbSession);if(!selectedExam)throw {statusCode:404,message:"Examination class not found."};
    if(publish&&!await ProcessedResult.exists({schoolId,examId,classId,status:{$ne:"PENDING"},needsProcessing:{$ne:true}}).session(dbSession))throw {statusCode:409,message:"No complete processed results are ready to publish. Process pending or changed marks first."};
    await ProcessedResult.updateMany(
      { schoolId, examId, classId,...(publish?{status:{$ne:"PENDING"},needsProcessing:{$ne:true}}:{}) },
      { $set: { isPublished: publish, publishedAt: publish ? new Date() : null } },{session:dbSession}
    );

    const exam = await ExamSchedule.findOne({ _id: examId, schoolId }).session(dbSession);
    if (exam) {
      exam.status = publish ? "PUBLISHED" : "PROCESSED";
      exam.publishedAt = publish ? new Date() : undefined;
      exam.publishedByUserName = userName;
      await exam.save({session:dbSession});
    }

    await AuditLog.create([{
      schoolId,
      action: publish ? "EXAM_RESULTS_PUBLISHED" : "EXAM_RESULTS_UNPUBLISHED",
      performedByName: userName,
      details: `${publish ? "Published" : "Unpublished"} results for ${exam?.title || "Exam Session"}.`,
    }],{session:dbSession});

    return { status: publish ? "PUBLISHED" : "UNPUBLISHED" };
  }

  // 9. TABULATION SHEET MATRIX GENERATOR
  static async getTabulationSheet(schoolId: string, examId: string, classId: string) {
    const [exam, linkedClass, subjects, students, marksEntries, processedResults] = await Promise.all([
      ExamSchedule.findOne({ _id: examId, schoolId }),
      ClassModel.findOne({ _id: classId, schoolId }),
      Subject.find({ schoolId, classId }),
      Student.find({ schoolId, classId, status: "ACTIVE" }).sort({ rollNumber: 1 }),
      MarksEntry.find({ schoolId, examId, classId }),
      ProcessedResult.find({ schoolId, examId, classId }),
    ]);

    const processedMap = new Map<string, any>();
    processedResults.forEach((pr) => processedMap.set(pr.studentId.toString(), pr));

    const rows = students.map((student) => {
      const sId = student._id.toString();
      const pr = processedMap.get(sId);
      const subjectMarks: Record<string, { obtained: number; max: number; grade: string }> = {};

      subjects.forEach((subj) => {
        const subId = subj._id.toString();
        const entry = marksEntries.find((me) => me.subjectId.toString() === subId);
        if (entry) {
          const rec = entry.records.find((r: any) => r.studentId.toString() === sId);
          if (rec) {
            subjectMarks[subId] = {
              obtained: rec.obtainedMarks,
              max: entry.maxMarks,
              grade: rec.grade || "F",
            };
          }
        }
      });

      return {
        studentId: student._id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        subjectMarks,
        totalObtained: pr ? pr.totalObtainedMarks : 0,
        totalMax: pr ? pr.totalMaxMarks : 0,
        percentage: pr ? pr.percentage : null,
        grade: pr ? pr.overallGrade : "—",
        rank: pr ? pr.rank : "—",
        status: pr ? pr.status : "PENDING",
      };
    });

    return {
      examTitle: exam ? exam.title : "Exam Session",
      className: linkedClass ? linkedClass.name : "Class",
      subjects: subjects.map((s) => ({ _id: s._id, name: s.name, code: s.code })),
      rows,
    };
  }

  // 10. RESULT PERFORMANCE ANALYTICS
  static async getAnalytics(schoolId: string, examId?: string, classId?: string) {
    const query: any = { schoolId,status:{$ne:"PENDING"} };
    if (examId && mongoose.Types.ObjectId.isValid(examId)) query.examId = examId;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) query.classId = classId;

    const results = await ProcessedResult.find(query);
    if (results.length === 0) {
      return {
        totalStudents: 0,
        passedCount: 0,
        failedCount: 0,
        passPercentage: 0,
        classAverage: 0,
        highestMarks: 0,
        lowestMarks: 0,
        gradeDistribution: {},
      };
    }

    const totalStudents = results.length;
    const passedCount = results.filter((r) => r.status === "PASSED" || r.status === "PROMOTED").length;
    const failedCount = totalStudents - passedCount;
    const passPercentage = Number(((passedCount / totalStudents) * 100).toFixed(1));

    const totalObtainedSum = results.reduce((sum, r) => sum + r.totalObtainedMarks, 0);
    const totalMaxSum = results.reduce((sum, r) => sum + r.totalMaxMarks, 0);
    const classAverage = totalMaxSum > 0 ? Number(((totalObtainedSum / totalMaxSum) * 100).toFixed(1)) : 0;

    const highestMarks = Math.max(...results.map((r) => r.totalObtainedMarks));
    const lowestMarks = Math.min(...results.map((r) => r.totalObtainedMarks));

    const gradeDistribution: Record<string, number> = {};
    results.forEach((r) => {
      const g = r.overallGrade || "F";
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    });

    return {
      totalStudents,
      passedCount,
      failedCount,
      passPercentage,
      classAverage,
      highestMarks,
      lowestMarks,
      gradeDistribution,
    };
  }

  // 11. CERTIFICATES MANAGEMENT
  static async getCertificates(schoolId: string) {
    return CertificateRecord.find({ schoolId }).sort({ issueDate: -1 });
  }

  static async issueCertificate(schoolId: string, data: {
    type: "BONAFIDE" | "CHARACTER" | "LEAVING" | "TRANSFER" | "RESULT";
    studentId: string;
    classId?: string;
    studentName?: string;
    rollNumber?: string;
    className?: string;
    session?: string;
    reason?: string;
    conductRemarks?: string;
  }, userName: string) {
    const student = await Student.findOne({ _id: data.studentId, schoolId });
    if (!student) throw { statusCode: 404, message: "Selected student record not found in database for this school." };

    if (data.classId && String(student.classId) !== String(data.classId)) {
      throw { statusCode: 400, message: "Selected student does not belong to the selected class." };
    }

    const certNo = `CERT-${data.type.slice(0, 3)}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const currentSession = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("name");

    const cert = await CertificateRecord.create({
      schoolId,
      certificateNumber: certNo,
      type: data.type,
      studentId: student._id,
      studentName: data.studentName || student.name,
      rollNumber: data.rollNumber || student.rollNumber,
      admissionNumber: student.admissionNumber,
      className: data.className || student.className,
      session: data.session || currentSession?.name || student.academicSessionName || "2026–2027",
      issueDate: new Date(),
      reason: data.reason || "On student/parent request",
      conductRemarks: data.conductRemarks || "Satisfactory conduct and moral character",
      issuedByUserName: userName,
    });

    await AuditLog.create({
      schoolId,
      action: "CERTIFICATE_ISSUED",
      performedByName: userName,
      details: `Issued ${data.type} Certificate (${certNo}) for ${student.name}.`,
    });

    return cert;
  }
}
