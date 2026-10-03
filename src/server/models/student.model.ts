import mongoose, { Schema, Document } from "mongoose";

export interface IStudent extends Document {
  schoolId: mongoose.Types.ObjectId;
  studentId: string;
  admissionNumber: string;
  name: string;
  photoUrl?: string;
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
  status: "ACTIVE" | "INACTIVE" | "LEFT" | "GRADUATED" | "TRANSFERRED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: String, required: true },
    admissionNumber: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    photoUrl: { type: String },
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
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "LEFT", "GRADUATED", "TRANSFERRED", "ARCHIVED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

StudentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
StudentSchema.index({ schoolId: 1, academicSessionId: 1, classId: 1, sectionId: 1, rollNumber: 1 }, { unique: true, name: "school_session_class_section_roll_unique" });

export const Student = mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);
