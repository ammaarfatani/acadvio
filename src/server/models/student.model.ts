import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IStudent extends Document {
  schoolId: mongoose.Types.ObjectId;
  studentId: string;
  admissionNumber: string;
  name: string;
  nameUrdu?: string;
  nationality?: string;
  religion?: string;
  bloodGroup?: string;
  placeOfBirth?: string;
  previousSchool?: string;
  previousClass?: string;
  permanentAddress?: string;
  billingAddress?: string;
  motherOccupation?: string;
  medicalInformation?: string;
  allergies?: string;
  supportRequirements?: string;
  photoUrl?: string;
  photoStorageId?: string;
  bFormNumber?: string;
  dob: Date;
  gender: "Male" | "Female" | "Other";
  classId: mongoose.Types.ObjectId;
  className: string;
  sectionId?: mongoose.Types.ObjectId;
  sectionName?: string;
  rollNumber: string;
  admissionDate: Date;
  academicSessionId?: mongoose.Types.ObjectId;
  academicSessionName?: string;
  address: string;
  phone?: string;
  parentInfo: {
    fatherName: string;
    fatherPhone: string;
    fatherCnic?: string;
    fatherOccupation?: string;
    motherName?: string;
    motherPhone?: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    guardianRelation?: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  documents?: { title: string; url: string }[];
  status:
    | "ACTIVE"
    | "INACTIVE"
    | "LEFT"
    | "GRADUATED"
    | "TRANSFERRED"
    | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: { type: String, required: true, immutable: true },
    admissionNumber: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    nameUrdu: { type: String, trim: true, maxlength: 2000 },
    nationality: { type: String, trim: true, maxlength: 2000 },
    religion: { type: String, trim: true, maxlength: 2000 },
    bloodGroup: { type: String, trim: true, maxlength: 2000 },
    placeOfBirth: { type: String, trim: true, maxlength: 2000 },
    previousSchool: { type: String, trim: true, maxlength: 2000 },
    previousClass: { type: String, trim: true, maxlength: 2000 },
    permanentAddress: { type: String, trim: true, maxlength: 2000 },
    billingAddress: { type: String, trim: true, maxlength: 2000 },
    motherOccupation: { type: String, trim: true, maxlength: 2000 },
    medicalInformation: { type: String, trim: true, maxlength: 2000 },
    allergies: { type: String, trim: true, maxlength: 2000 },
    supportRequirements: { type: String, trim: true, maxlength: 2000 },
    photoUrl: { type: String },
    photoStorageId: { type: String, select: false },
    bFormNumber: { type: String, trim: true, maxlength: 32 },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" },
    sectionName: { type: String },
    rollNumber: { type: String, required: true },
    admissionDate: { type: Date, required: true, default: Date.now },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    academicSessionName: { type: String },
    address: { type: String, required: true },
    phone: { type: String },
    parentInfo: {
      fatherName: { type: String, required: true },
      fatherPhone: { type: String, required: true },
      fatherCnic: { type: String },
      fatherOccupation: { type: String },
      motherName: { type: String },
      motherPhone: { type: String },
      guardianName: { type: String },
      guardianPhone: { type: String },
      guardianEmail: { type: String },
      guardianRelation: { type: String },
    },
    emergencyContact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      relation: { type: String, required: true },
    },
    documents: [{ title: String, url: String }],
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "INACTIVE",
        "LEFT",
        "GRADUATED",
        "TRANSFERRED",
        "ARCHIVED",
      ],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

StudentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
StudentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });
StudentSchema.index(
  {
    schoolId: 1,
    academicSessionId: 1,
    classId: 1,
    sectionId: 1,
    rollNumber: 1,
  },
  { unique: true, name: "school_session_class_section_roll_unique" },
);

StudentSchema.index(
  {
    schoolId: 1,
    branchId: 1,
    academicSessionId: 1,
    classId: 1,
    status: 1,
    _id: 1,
  },
  { name: "student_class_print_cursor" },
);
StudentSchema.plugin(branchScoped);
StudentSchema.pre("validate", async function () {
  const { permanentIdentity } = await import(
    "../services/permanentIdentity.service"
  );
  if (this.isNew) {
    this.studentId = await permanentIdentity(
      this.schoolId,
      "student",
      this._id,
      this.studentId || undefined,
    );
    if (!this.admissionNumber)
      this.admissionNumber = await permanentIdentity(
        this.schoolId,
        "admission",
        this._id,
      );
  }
});
StudentSchema.post("save", async function (doc: any) {
  if (doc.schoolId) {
    const { IdentityCard } = await import("./identityCard.model");
    await IdentityCard.updateOne(
      { schoolId: doc.schoolId, kind: "student", subjectId: doc._id },
      {
        $setOnInsert: {
          status: "PENDING_APPROVAL",
          organizationId: doc.organizationId || doc.schoolId,
          branchId: doc.branchId || doc.schoolId,
        },
      },
      { upsert: true, session: doc.$session() || undefined },
    );
  }
});
// Use the existing scoped write path; generic bulkWrite is intentionally forbidden.
StudentSchema.post("insertMany", async function (docs: any[]) {
  const { IdentityCard } = await import("./identityCard.model");
  for (const doc of docs) {
    if (doc.schoolId)
      await IdentityCard.updateOne(
        { schoolId: doc.schoolId, kind: "student", subjectId: doc._id },
        {
          $setOnInsert: {
            status: "PENDING_APPROVAL",
            organizationId: doc.organizationId || doc.schoolId,
            branchId: doc.branchId || doc.schoolId,
          },
        },
        { upsert: true, session: doc.$session?.() || undefined },
      );
  }
});
export const Student =
  mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);
