import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Permission } from "../models/permission.model";
import { Role } from "../models/role.model";
import { User } from "../models/user.model";
import { School } from "../models/school.model";
import { Subscription } from "../models/subscription.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { ClassTeacherAssignment } from "../models/classTeacherAssignment.model";
import { TeacherProfile, TeachingAssignment } from "../models/teacherProfile.model";
import { Subject, TimetableSlot } from "../models/subject.model";
import { Student } from "../models/student.model";
import { FeeStructure, FeeChallan, FeePayment, Expense } from "../models/fee.model";
import { GradingScale, ExamSchedule, MarksEntry, ProcessedResult } from "../models/exam.model";
import { Admission } from "../models/admission.model";
import { StudentAttendance, TeacherAttendance } from "../models/attendance.model";
import { Announcement } from "../models/announcement.model";
import { PERMISSIONS, ROLE_PERMISSION_MAP } from "../constants/permissions.constant";
import { SYSTEM_ROLES, UserType, UserStatus } from "../constants/roles.constant";
import { SubscriptionStatus, SubscriptionPlan } from "../constants/subscription.constant";
import { hashPassword } from "./password.util";

export const seedDatabase = async () => {
  await connectDB();
  console.log("[Seeder] Starting database initialization...");

  // 1. Seed Permissions
  for (const perm of PERMISSIONS) {
    await Permission.updateOne(
      { code: perm.code },
      { $set: perm },
      { upsert: true }
    );
  }
  console.log(`[Seeder] Seeded ${PERMISSIONS.length} system permissions.`);

  // 2. Seed System Roles
  for (const roleDef of SYSTEM_ROLES) {
    const permissions = ROLE_PERMISSION_MAP[roleDef.userType] || [];
    await Role.updateOne(
      { schoolId: null, code: roleDef.code },
      {
        $set: {
          ...roleDef,
          schoolId: null,
          permissions,
        },
      },
      { upsert: true }
    );
  }
  await Role.updateMany(
    { userType: { $in: [UserType.EXAM_STAFF, UserType.FINANCE, UserType.RECEPTIONIST] } },
    { $addToSet: { permissions: { $each: ["settings.view", "settings.update", "admissions.view", "admissions.manage", "visitors.manage"] } } }
  );
  console.log(`[Seeder] Seeded ${SYSTEM_ROLES.length} system roles and synced permissions.`);

  // 3. Seed Platform Super Admin User
  const superAdminRole = await Role.findOne({ code: "ROLE_SUPER_ADMIN" });
  const superAdminEmail = "superadmin@acadivo.com";
  let superAdminUser = await User.findOne({ email: superAdminEmail });

  if (!superAdminUser) {
    const passwordHash = await hashPassword("SuperAdmin2026!Pass");
    superAdminUser = await User.create({
      schoolId: null,
      roleId: superAdminRole?._id,
      userType: UserType.SUPER_ADMIN,
      name: "AKTech Super Admin",
      email: superAdminEmail,
      passwordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
    console.log("[Seeder] Created Super Admin account: superadmin@acadivo.com / SuperAdmin2026!Pass");
  }

  if (process.env.SEED_DEMO_DATA !== "true") return;
  // 4. Seed Demo Active School: Oakridge Model School
  const demoSchoolCode = "oakridge";
  let demoSchool = await School.findOne({ code: demoSchoolCode });

  if (!demoSchool) {
    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    demoSchool = await School.create({
      name: "Oakridge Model School",
      isDemo: true,
      code: demoSchoolCode,
      email: "info@oakridge.edu.pk",
      phone: "+92 42 35700000",
      address: "Campus 1, Gulberg III, Lahore, Pakistan",
      studentCountRange: "501-1000",
      teacherCount: 45,
      plan: SubscriptionPlan.PROFESSIONAL,
      status: SubscriptionStatus.TRIAL,
      trialStartedAt: now,
      trialEndsAt: fourteenDaysLater,
    });

    const schoolAdminRole = await Role.findOne({ code: "ROLE_SCHOOL_ADMIN" });
    const adminPasswordHash = await hashPassword("Admin2026!Pass");

    await User.create({
      schoolId: demoSchool._id,
      roleId: schoolAdminRole?._id,
      userType: UserType.SCHOOL_ADMIN,
      name: "Principal Rashid Malik",
      email: "principal.malik@oakridge.edu.pk",
      passwordHash: adminPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });

    await Subscription.create({
      schoolId: demoSchool._id,
      plan: SubscriptionPlan.PROFESSIONAL,
      status: SubscriptionStatus.TRIAL,
      price: 9999,
      trialStartedAt: now,
      trialEndsAt: fourteenDaysLater,
    });

    await AcademicSession.create({
      schoolId: demoSchool._id,
      name: "2026–2027",
      startDate: new Date(2026, 7, 1),
      endDate: new Date(2027, 5, 30),
      isCurrent: true,
    });

    console.log("[Seeder] Created Demo Active School & Admin (principal.malik@oakridge.edu.pk / Admin2026!Pass)");
  }

  // 5. Seed Primary Target School: Apex International Institute
  const apexSchoolCode = "apex";
  let apexSchool = await School.findOne({ code: apexSchoolCode });

  if (!apexSchool) {
    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    apexSchool = await School.create({
      name: "Apex International Institute",
      isDemo: true,
      code: apexSchoolCode,
      email: "info@apex.edu.pk",
      phone: "+92 51 9200000",
      address: "Campus 1, Main Boulevard, Blue Area, Islamabad, Pakistan",
      studentCountRange: "251-500",
      teacherCount: 25,
      plan: SubscriptionPlan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      trialStartedAt: now,
      trialEndsAt: fourteenDaysLater,
    });

    await Subscription.create({
      schoolId: apexSchool._id,
      plan: SubscriptionPlan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      price: 19999,
      startedAt: now,
      endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    });
    console.log("[Seeder] Created Apex International Institute School.");
  }

  const schoolAdminRole = await Role.findOne({ code: "ROLE_SCHOOL_ADMIN" });
  const teacherRole = await Role.findOne({ code: "ROLE_TEACHER" });
  const financeRole = await Role.findOne({ code: "ROLE_FINANCE" });
  const examRole = await Role.findOne({ code: "ROLE_EXAM_STAFF" });
  const receptionRole = await Role.findOne({ code: "ROLE_RECEPTIONIST" });

  const defaultPasswordHash = await hashPassword("Apex2026!Pass");

  // Create Apex Users across all 5 operational roles
  let apexAdmin = await User.findOne({ email: "admin@apex.edu.pk" });
  if (!apexAdmin) {
    apexAdmin = await User.create({
      schoolId: apexSchool._id,
      roleId: schoolAdminRole?._id,
      userType: UserType.SCHOOL_ADMIN,
      name: "Principal Tariq Mahmood",
      email: "admin@apex.edu.pk",
      passwordHash: defaultPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
  }

  let apexTeacherAhmed = await User.findOne({ email: "ahmed.math@apex.edu.pk" });
  if (!apexTeacherAhmed) {
    apexTeacherAhmed = await User.create({
      schoolId: apexSchool._id,
      roleId: teacherRole?._id,
      userType: UserType.TEACHER,
      name: "Ahmed Khan",
      email: "ahmed.math@apex.edu.pk",
      passwordHash: defaultPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
  }

  let apexTeacherSara = await User.findOne({ email: "sara.science@apex.edu.pk" });
  if (!apexTeacherSara) {
    apexTeacherSara = await User.create({
      schoolId: apexSchool._id,
      roleId: teacherRole?._id,
      userType: UserType.TEACHER,
      name: "Sara Ali",
      email: "sara.science@apex.edu.pk",
      passwordHash: defaultPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
  }

  let apexFinance = await User.findOne({ email: "finance@apex.edu.pk" });
  if (!apexFinance) {
    apexFinance = await User.create({
      schoolId: apexSchool._id,
      roleId: financeRole?._id,
      userType: UserType.FINANCE,
      name: "Usman Finance Manager",
      email: "finance@apex.edu.pk",
      passwordHash: defaultPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
  }

  let apexExamStaff = await User.findOne({ email: "exams@apex.edu.pk" });
  if (!apexExamStaff) {
    apexExamStaff = await User.create({
      schoolId: apexSchool._id,
      roleId: examRole?._id,
      userType: UserType.EXAM_STAFF,
      name: "Farhan Exam Controller",
      email: "exams@apex.edu.pk",
      passwordHash: defaultPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
  }

  let apexReceptionist = await User.findOne({ email: "reception@apex.edu.pk" });
  if (!apexReceptionist) {
    apexReceptionist = await User.create({
      schoolId: apexSchool._id,
      roleId: receptionRole?._id,
      userType: UserType.RECEPTIONIST,
      name: "Ayesha Receptionist",
      email: "reception@apex.edu.pk",
      passwordHash: defaultPasswordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
  }

  // Teacher Profiles
  await TeacherProfile.updateOne(
    { userId: apexTeacherAhmed._id },
    {
      $set: {
        schoolId: apexSchool._id,
        userId: apexTeacherAhmed._id,
        qualification: "M.Sc Mathematics, B.Ed",
        employeeId: "EMP-T-101",
        phone: "+92 300 1234567",
      },
    },
    { upsert: true }
  );

  await TeacherProfile.updateOne(
    { userId: apexTeacherSara._id },
    {
      $set: {
        schoolId: apexSchool._id,
        userId: apexTeacherSara._id,
        qualification: "M.Sc Physics, M.Ed",
        employeeId: "EMP-T-102",
        phone: "+92 300 7654321",
      },
    },
    { upsert: true }
  );

  // Academic Session
  let apexSession = await AcademicSession.findOne({ schoolId: apexSchool._id, name: "2026–2027" });
  if (!apexSession) {
    apexSession = await AcademicSession.create({
      schoolId: apexSchool._id,
      name: "2026–2027",
      startDate: new Date(2026, 7, 1),
      endDate: new Date(2027, 5, 30),
      isCurrent: true,
    });
  }

  // Classes & Sections
  let class9 = await ClassModel.findOne({ schoolId: apexSchool._id, name: "Grade 9" });
  if (!class9) {
    class9 = await ClassModel.create({
      schoolId: apexSchool._id,
      name: "Grade 9",
      code: "G9",
      numericLevel: 9,
      classTeacherId: apexTeacherAhmed._id,
      classTeacherName: apexTeacherAhmed.name,
    });
  }

  let sec9A = await SectionModel.findOne({ schoolId: apexSchool._id, classId: class9._id, name: "Section A" });
  if (!sec9A) {
    sec9A = await SectionModel.create({
      schoolId: apexSchool._id,
      classId: class9._id,
      className: class9.name,
      name: "Section A",
      roomNumber: "Room 101",
      capacity: 35,
    });
  }

  let class10 = await ClassModel.findOne({ schoolId: apexSchool._id, name: "Grade 10" });
  if (!class10) {
    class10 = await ClassModel.create({
      schoolId: apexSchool._id,
      name: "Grade 10",
      code: "G10",
      numericLevel: 10,
      classTeacherId: apexTeacherSara._id,
      classTeacherName: apexTeacherSara.name,
    });
  }

  let sec10A = await SectionModel.findOne({ schoolId: apexSchool._id, classId: class10._id, name: "Section A" });
  if (!sec10A) {
    sec10A = await SectionModel.create({
      schoolId: apexSchool._id,
      classId: class10._id,
      className: class10.name,
      name: "Section A",
      roomNumber: "Room 102",
      capacity: 35,
    });
  }

  // Class Teacher Assignments
  await ClassTeacherAssignment.updateOne(
    { schoolId: apexSchool._id, academicSessionId: apexSession._id, sectionId: sec9A._id },
    {
      $set: {
        schoolId: apexSchool._id,
        academicSessionId: apexSession._id,
        classId: class9._id,
        sectionId: sec9A._id,
        teacherUserId: apexTeacherAhmed._id,
        teacherName: apexTeacherAhmed.name,
      },
    },
    { upsert: true }
  );

  await ClassTeacherAssignment.updateOne(
    { schoolId: apexSchool._id, academicSessionId: apexSession._id, sectionId: sec10A._id },
    {
      $set: {
        schoolId: apexSchool._id,
        academicSessionId: apexSession._id,
        classId: class10._id,
        sectionId: sec10A._id,
        teacherUserId: apexTeacherSara._id,
        teacherName: apexTeacherSara.name,
      },
    },
    { upsert: true }
  );

  // Subjects
  let subMath9 = await Subject.findOne({ schoolId: apexSchool._id, classId: class9._id, name: "Mathematics" });
  if (!subMath9) {
    subMath9 = await Subject.create({
      schoolId: apexSchool._id,
      name: "Mathematics",
      code: "MATH-9",
      type: "Core",
      classId: class9._id,
      className: class9.name,
      totalMarks: 100,
      passingMarks: 33,
      teacherId: apexTeacherAhmed._id,
      teacherName: apexTeacherAhmed.name,
    });
  }

  let subEng9 = await Subject.findOne({ schoolId: apexSchool._id, classId: class9._id, name: "English" });
  if (!subEng9) {
    subEng9 = await Subject.create({
      schoolId: apexSchool._id,
      name: "English",
      code: "ENG-9",
      type: "Core",
      classId: class9._id,
      className: class9.name,
      totalMarks: 100,
      passingMarks: 33,
      teacherId: apexTeacherAhmed._id,
      teacherName: apexTeacherAhmed.name,
    });
  }

  let subSci10 = await Subject.findOne({ schoolId: apexSchool._id, classId: class10._id, name: "Science" });
  if (!subSci10) {
    subSci10 = await Subject.create({
      schoolId: apexSchool._id,
      name: "Science",
      code: "SCI-10",
      type: "Core",
      classId: class10._id,
      className: class10.name,
      totalMarks: 100,
      passingMarks: 33,
      teacherId: apexTeacherSara._id,
      teacherName: apexTeacherSara.name,
    });
  }

  let subPhy10 = await Subject.findOne({ schoolId: apexSchool._id, classId: class10._id, name: "Physics" });
  if (!subPhy10) {
    subPhy10 = await Subject.create({
      schoolId: apexSchool._id,
      name: "Physics",
      code: "PHY-10",
      type: "Core",
      classId: class10._id,
      className: class10.name,
      totalMarks: 100,
      passingMarks: 33,
      teacherId: apexTeacherSara._id,
      teacherName: apexTeacherSara.name,
    });
  }

  // Teaching Assignments
  await TeachingAssignment.updateOne(
    { schoolId: apexSchool._id, teacherUserId: apexTeacherAhmed._id, subjectId: subMath9._id },
    {
      $set: {
        schoolId: apexSchool._id,
        teacherUserId: apexTeacherAhmed._id,
        academicSessionId: apexSession._id,
        classId: class9._id,
        sectionId: sec9A._id,
        subjectId: subMath9._id,
        status: "ACTIVE",
      },
    },
    { upsert: true }
  );

  await TeachingAssignment.updateOne(
    { schoolId: apexSchool._id, teacherUserId: apexTeacherSara._id, subjectId: subSci10._id },
    {
      $set: {
        schoolId: apexSchool._id,
        teacherUserId: apexTeacherSara._id,
        academicSessionId: apexSession._id,
        classId: class10._id,
        sectionId: sec10A._id,
        subjectId: subSci10._id,
        status: "ACTIVE",
      },
    },
    { upsert: true }
  );

  // Timetable Slots
  const days: ("Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday")[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  for (const day of days) {
    await TimetableSlot.updateOne(
      { schoolId: apexSchool._id, classId: class9._id, sectionId: sec9A._id, dayOfWeek: day, periodNumber: 1 },
      {
        $set: {
          schoolId: apexSchool._id,
          academicSessionId: apexSession._id,
          classId: class9._id,
          sectionId: sec9A._id,
          dayOfWeek: day,
          periodNumber: 1,
          startTime: "08:00 AM",
          endTime: "08:45 AM",
          subjectId: subMath9._id,
          subjectName: subMath9.name,
          teacherId: apexTeacherAhmed._id,
          teacherName: apexTeacherAhmed.name,
          roomNumber: "Room 101",
        },
      },
      { upsert: true }
    );

    await TimetableSlot.updateOne(
      { schoolId: apexSchool._id, classId: class10._id, sectionId: sec10A._id, dayOfWeek: day, periodNumber: 2 },
      {
        $set: {
          schoolId: apexSchool._id,
          academicSessionId: apexSession._id,
          classId: class10._id,
          sectionId: sec10A._id,
          dayOfWeek: day,
          periodNumber: 2,
          startTime: "08:45 AM",
          endTime: "09:30 AM",
          subjectId: subSci10._id,
          subjectName: subSci10.name,
          teacherId: apexTeacherSara._id,
          teacherName: apexTeacherSara.name,
          roomNumber: "Room 102",
        },
      },
      { upsert: true }
    );
  }

  // Students Seed Data
  const studentDataList = [
    {
      studentId: "APX-STU-001",
      admissionNumber: "APX-2026-001",
      name: "Zaid Ali",
      dob: new Date(2011, 2, 15),
      gender: "Male" as const,
      classId: class9._id,
      className: class9.name,
      sectionId: sec9A._id,
      sectionName: sec9A.name,
      rollNumber: "9A-01",
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      address: "House 12, Street 4, F-8/2, Islamabad",
      parentInfo: {
        fatherName: "Ali Hassan",
        fatherPhone: "+92 300 1111111",
        fatherCnic: "61101-1234567-1",
        guardianName: "Ali Hassan",
        guardianPhone: "+92 300 1111111",
      },
      emergencyContact: { name: "Ali Hassan", phone: "+92 300 1111111", relation: "Father" },
      status: "ACTIVE" as const,
    },
    {
      studentId: "APX-STU-002",
      admissionNumber: "APX-2026-002",
      name: "Bilal Khan",
      dob: new Date(2011, 5, 20),
      gender: "Male" as const,
      classId: class9._id,
      className: class9.name,
      sectionId: sec9A._id,
      sectionName: sec9A.name,
      rollNumber: "9A-02",
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      address: "House 45, Street 10, G-9/1, Islamabad",
      parentInfo: {
        fatherName: "Khan Sahib",
        fatherPhone: "+92 300 2222222",
        fatherCnic: "61101-2345678-3",
        guardianName: "Khan Sahib",
        guardianPhone: "+92 300 2222222",
      },
      emergencyContact: { name: "Khan Sahib", phone: "+92 300 2222222", relation: "Father" },
      status: "ACTIVE" as const,
    },
    {
      studentId: "APX-STU-003",
      admissionNumber: "APX-2026-003",
      name: "Fatima Noor",
      dob: new Date(2011, 10, 10),
      gender: "Female" as const,
      classId: class9._id,
      className: class9.name,
      sectionId: sec9A._id,
      sectionName: sec9A.name,
      rollNumber: "9A-03",
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      address: "House 88, Sector I-8/3, Islamabad",
      parentInfo: {
        fatherName: "Noor Ahmad",
        fatherPhone: "+92 300 3333333",
        fatherCnic: "61101-3456789-5",
        guardianName: "Noor Ahmad",
        guardianPhone: "+92 300 3333333",
      },
      emergencyContact: { name: "Noor Ahmad", phone: "+92 300 3333333", relation: "Father" },
      status: "ACTIVE" as const,
    },
    {
      studentId: "APX-STU-004",
      admissionNumber: "APX-2026-004",
      name: "Hamza Umar",
      dob: new Date(2010, 0, 5),
      gender: "Male" as const,
      classId: class10._id,
      className: class10.name,
      sectionId: sec10A._id,
      sectionName: sec10A.name,
      rollNumber: "10A-01",
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      address: "Villa 3, Sector F-10/4, Islamabad",
      parentInfo: {
        fatherName: "Umar Farooq",
        fatherPhone: "+92 300 4444444",
        fatherCnic: "61101-4567890-7",
        guardianName: "Umar Farooq",
        guardianPhone: "+92 300 4444444",
      },
      emergencyContact: { name: "Umar Farooq", phone: "+92 300 4444444", relation: "Father" },
      status: "ACTIVE" as const,
    },
    {
      studentId: "APX-STU-005",
      admissionNumber: "APX-2026-005",
      name: "Ayesha Zainab",
      dob: new Date(2010, 3, 12),
      gender: "Female" as const,
      classId: class10._id,
      className: class10.name,
      sectionId: sec10A._id,
      sectionName: sec10A.name,
      rollNumber: "10A-02",
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      address: "House 102, Sector E-11/2, Islamabad",
      parentInfo: {
        fatherName: "Zainab Shah",
        fatherPhone: "+92 300 5555555",
        fatherCnic: "61101-5678901-9",
        guardianName: "Zainab Shah",
        guardianPhone: "+92 300 5555555",
      },
      emergencyContact: { name: "Zainab Shah", phone: "+92 300 5555555", relation: "Father" },
      status: "ACTIVE" as const,
    },
  ];

  const createdStudents: any[] = [];
  for (const sData of studentDataList) {
    let student = await Student.findOne({ schoolId: apexSchool._id, admissionNumber: sData.admissionNumber });
    if (!student) {
      student = await Student.create({
        ...sData,
        schoolId: apexSchool._id,
        admissionDate: new Date(2026, 7, 1),
      });
    }
    createdStudents.push(student);
  }

  // Fee Structures
  let feeStruct9 = await FeeStructure.findOne({ schoolId: apexSchool._id, classId: class9._id });
  if (!feeStruct9) {
    feeStruct9 = await FeeStructure.create({
      schoolId: apexSchool._id,
      title: "Grade 9 Regular Fee Structure",
      academicSession: apexSession.name,
      classId: class9._id,
      className: class9.name,
      sectionId: sec9A._id,
      admissionFee: 15000,
      tuitionFee: 8500,
      examFee: 1500,
      totalMonthlyFee: 10000,
      lateFeeFineRate: 500,
      dueDateDay: 10,
    });
  }

  let feeStruct10 = await FeeStructure.findOne({ schoolId: apexSchool._id, classId: class10._id });
  if (!feeStruct10) {
    feeStruct10 = await FeeStructure.create({
      schoolId: apexSchool._id,
      title: "Grade 10 Regular Fee Structure",
      academicSession: apexSession.name,
      classId: class10._id,
      className: class10.name,
      sectionId: sec10A._id,
      admissionFee: 15000,
      tuitionFee: 8500,
      examFee: 1500,
      totalMonthlyFee: 10000,
      lateFeeFineRate: 500,
      dueDateDay: 10,
    });
  }

  // Fee Challans & Payments
  const currentMonthStr = "September 2026";
  for (const stu of createdStudents) {
    const challanNum = `CHL-2026-${stu.admissionNumber.split("-").pop()}`;
    let challan = await FeeChallan.findOne({ schoolId: apexSchool._id, challanNumber: challanNum });
    if (!challan) {
      const isPaid = stu.rollNumber === "9A-01" || stu.rollNumber === "10A-01";
      const totalAmount = 10000;
      const paidAmount = isPaid ? totalAmount : 0;
      const remaining = totalAmount - paidAmount;

      challan = await FeeChallan.create({
        schoolId: apexSchool._id,
        challanNumber: challanNum,
        studentId: stu._id,
        studentName: stu.name,
        rollNumber: stu.rollNumber,
        admissionNumber: stu.admissionNumber,
        classId: stu.classId,
        className: stu.className,
        sectionName: stu.sectionName,
        academicSession: apexSession.name,
        month: currentMonthStr,
        dueDate: new Date(2026, 8, 10),
        previousBalance: 0,
        feeBreakdown: {
          tuitionFee: 8500,
          examFee: 1500,
          discount: 0,
        },
        totalAmountPKR: totalAmount,
        paidAmountPKR: paidAmount,
        remainingAmountPKR: remaining,
        status: isPaid ? "PAID" : "PENDING",
        paymentMethod: isPaid ? "Cash" : undefined,
        paidDate: isPaid ? new Date(2026, 8, 5) : undefined,
        receiptNumber: isPaid ? `REC-2026-${stu.admissionNumber.split("-").pop()}` : undefined,
        collectedByUserName: isPaid ? apexFinance.name : undefined,
      });

      if (isPaid) {
        await FeePayment.create({
          schoolId: apexSchool._id,
          challanId: challan._id,
          studentId: stu._id,
          studentName: stu.name,
          rollNumber: stu.rollNumber,
          className: stu.className,
          amountPKR: totalAmount,
          paymentMethod: "Cash",
          paidAt: new Date(2026, 8, 5),
          receiptNumber: `REC-2026-${stu.admissionNumber.split("-").pop()}`,
          collectedByUserName: apexFinance.name,
        });
      }
    }
  }

  // School Expenses
  const exp1 = await Expense.findOne({ schoolId: apexSchool._id, title: "Faculty & Staff Salaries - Aug 2026" });
  if (!exp1) {
    await Expense.create({
      schoolId: apexSchool._id,
      title: "Faculty & Staff Salaries - Aug 2026",
      category: "Salary",
      amountPKR: 250000,
      expenseDate: new Date(2026, 8, 1),
      description: "Monthly salary distribution for teaching and administrative staff.",
      paymentMethod: "Bank Transfer",
      receiptRef: "TXN-SAL-0091",
      loggedByName: apexFinance.name,
    });
  }

  const exp2 = await Expense.findOne({ schoolId: apexSchool._id, title: "Electricity Bill - Aug 2026" });
  if (!exp2) {
    await Expense.create({
      schoolId: apexSchool._id,
      title: "Electricity Bill - Aug 2026",
      category: "Electricity",
      amountPKR: 45000,
      expenseDate: new Date(2026, 8, 3),
      description: "IESCO commercial electricity bill for main campus building.",
      paymentMethod: "Online",
      receiptRef: "IESCO-99812",
      loggedByName: apexFinance.name,
    });
  }

  // Grading Scale
  let gradingScale = await GradingScale.findOne({ schoolId: apexSchool._id });
  if (!gradingScale) {
    gradingScale = await GradingScale.create({
      schoolId: apexSchool._id,
      title: "Apex Standard Grading Policy",
      isDefault: true,
      rules: [
        { grade: "A+", minPercentage: 90, maxPercentage: 100, gradePoint: 4.0, remarks: "Outstanding" },
        { grade: "A", minPercentage: 80, maxPercentage: 89, gradePoint: 3.7, remarks: "Excellent" },
        { grade: "B", minPercentage: 70, maxPercentage: 79, gradePoint: 3.0, remarks: "Good" },
        { grade: "C", minPercentage: 60, maxPercentage: 69, gradePoint: 2.0, remarks: "Satisfactory" },
        { grade: "D", minPercentage: 50, maxPercentage: 59, gradePoint: 1.0, remarks: "Pass" },
        { grade: "F", minPercentage: 0, maxPercentage: 49, gradePoint: 0.0, remarks: "Fail" },
      ],
    });
  }

  // Exam Schedule
  let midtermExam = await ExamSchedule.findOne({ schoolId: apexSchool._id, title: "Mid-Term Examination 2026" });
  if (!midtermExam) {
    midtermExam = await ExamSchedule.create({
      schoolId: apexSchool._id,
      title: "Mid-Term Examination 2026",
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      classes: [class9.name, class10.name],
      subjects: ["Mathematics", "English", "Science", "Physics"],
      startDate: new Date(2026, 8, 15),
      endDate: new Date(2026, 8, 25),
      status: "PUBLISHED",
      publishedAt: new Date(2026, 8, 10),
      publishedByUserName: apexExamStaff.name,
    });
  }

  // Marks Entry
  let marksMath9 = await MarksEntry.findOne({ schoolId: apexSchool._id, examId: midtermExam._id, subjectId: subMath9._id });
  if (!marksMath9) {
    marksMath9 = await MarksEntry.create({
      schoolId: apexSchool._id,
      examId: midtermExam._id,
      examTitle: midtermExam.title,
      classId: class9._id,
      className: class9.name,
      subjectId: subMath9._id,
      subjectName: subMath9.name,
      maxMarks: 100,
      passingMarks: 33,
      enteredByTeacherId: apexTeacherAhmed._id,
      enteredByTeacherName: apexTeacherAhmed.name,
      status: "APPROVED",
      records: createdStudents.filter(s => s.className === class9.name).map(s => ({
        studentId: s._id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        obtainedMarks: s.rollNumber === "9A-01" ? 88 : s.rollNumber === "9A-02" ? 92 : 75,
        grade: s.rollNumber === "9A-01" ? "A" : s.rollNumber === "9A-02" ? "A+" : "B",
        remarks: "Good effort",
        isAbsent: false,
      })),
    });
  }

  // Processed Results
  for (const stu of createdStudents.filter(s => s.className === class9.name)) {
    let result = await ProcessedResult.findOne({ schoolId: apexSchool._id, examId: midtermExam._id, studentId: stu._id });
    if (!result) {
      const marksRecord = marksMath9.records.find((r: any) => r.studentId.toString() === stu._id.toString());
      const obtained = marksRecord ? marksRecord.obtainedMarks : 80;
      await ProcessedResult.create({
        schoolId: apexSchool._id,
        examId: midtermExam._id,
        examTitle: midtermExam.title,
        classId: stu.classId,
        className: stu.className,
        studentId: stu._id,
        studentName: stu.name,
        rollNumber: stu.rollNumber,
        admissionNumber: stu.admissionNumber,
        subjectScores: [
          {
            subjectId: subMath9._id,
            subjectName: subMath9.name,
            maxMarks: 100,
            obtainedMarks: obtained,
            grade: obtained >= 90 ? "A+" : obtained >= 80 ? "A" : "B",
          }
        ],
        totalMaxMarks: 100,
        totalObtainedMarks: obtained,
        percentage: obtained,
        overallGrade: obtained >= 90 ? "A+" : obtained >= 80 ? "A" : "B",
        rank: stu.rollNumber === "9A-02" ? 1 : stu.rollNumber === "9A-01" ? 2 : 3,
        status: "PASSED",
        attendancePercentage: 96,
        teacherRemarks: "Promising academic record.",
        isPublished: true,
        publishedAt: new Date(2026, 8, 26),
      });
    }
  }

  // Receptionist Inquiries & Admissions
  const existingAdm1 = await Admission.findOne({ schoolId: apexSchool._id, applicationNumber: "ADM-2026-001" });
  if (!existingAdm1) {
    await Admission.create({
      schoolId: apexSchool._id,
      applicationNumber: "ADM-2026-001",
      studentName: "Mustafa Kamal",
      guardianName: "Kamal Uddin",
      guardianPhone: "+92 312 9876543",
      guardianEmail: "kamal@gmail.com",
      previousSchool: "City Grammar School",
      previousClass: "Grade 8",
      applyingClassId: class9._id,
      applyingClassName: class9.name,
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      admissionSource: "Walk-in Inquiry",
      status: "NEW",
      inquiryDate: new Date(2026, 8, 20),
      notes: "Inquired about science lab facilities and fee installments.",
      documentsStatus: "PENDING",
    });
  }

  const existingAdm2 = await Admission.findOne({ schoolId: apexSchool._id, applicationNumber: "ADM-2026-002" });
  if (!existingAdm2) {
    await Admission.create({
      schoolId: apexSchool._id,
      applicationNumber: "ADM-2026-002",
      studentName: "Maryam Bibi",
      guardianName: "Tariq Shah",
      guardianPhone: "+92 333 4455667",
      guardianEmail: "tariq.shah@gmail.com",
      previousSchool: "Army Public School",
      previousClass: "Grade 9",
      applyingClassId: class10._id,
      applyingClassName: class10.name,
      academicSessionId: apexSession._id,
      academicSessionName: apexSession.name,
      admissionSource: "Online Form",
      status: "APPROVED",
      inquiryDate: new Date(2026, 8, 18),
      notes: "Passed entry test with 85% score.",
      documentsStatus: "COMPLETE",
    });
  }

  // Student Attendance Records for Today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingAtt9 = await StudentAttendance.findOne({ schoolId: apexSchool._id, classId: class9._id, date: today });
  if (!existingAtt9) {
    await StudentAttendance.create({
      schoolId: apexSchool._id,
      date: today,
      classId: class9._id,
      className: class9.name,
      sectionId: sec9A._id,
      sectionName: sec9A.name,
      academicSessionId: apexSession._id,
      markedByUserId: apexTeacherAhmed._id,
      markedByName: apexTeacherAhmed.name,
      records: createdStudents.filter(s => s.className === class9.name).map(s => ({
        studentId: s._id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        status: s.rollNumber === "9A-03" ? "LATE" : "PRESENT",
        remarks: s.rollNumber === "9A-03" ? "Arrived 10 mins late" : undefined,
      })),
    });
  }

  // Teacher Attendance Records for Today
  const existingTeacherAtt = await TeacherAttendance.findOne({ schoolId: apexSchool._id, date: today });
  if (!existingTeacherAtt) {
    await TeacherAttendance.create({
      schoolId: apexSchool._id,
      date: today,
      markedByName: apexAdmin.name,
      records: [
        {
          teacherUserId: apexTeacherAhmed._id,
          teacherName: apexTeacherAhmed.name,
          status: "PRESENT",
          arrivalTime: "07:50 AM",
          checkedInAt: new Date(today.getTime() + 7 * 60 * 60 * 1000 + 50 * 60 * 1000),
        },
        {
          teacherUserId: apexTeacherSara._id,
          teacherName: apexTeacherSara.name,
          status: "PRESENT",
          arrivalTime: "07:55 AM",
          checkedInAt: new Date(today.getTime() + 7 * 60 * 60 * 1000 + 55 * 60 * 1000),
        },
      ],
    });
  }

  // Announcements
  const ann1 = await Announcement.findOne({ schoolId: apexSchool._id, title: "Mid-Term Examination Schedule Released" });
  if (!ann1) {
    await Announcement.create({
      schoolId: apexSchool._id,
      title: "Mid-Term Examination Schedule Released",
      content: "All students and faculty members are advised to inspect the published date sheets on the portal.",
      category: "Examination",
      targetRoles: ["TEACHER", "FINANCE", "EXAM_STAFF", "RECEPTIONIST"],
      postedByName: apexAdmin.name,
      isPublished: true,
    });
  }

  console.log("[Seeder] Complete database seeding finished successfully.");
};

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seeder] Error during seed:", err);
      process.exit(1);
    });
}

