import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IClass extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string; // e.g. "Grade 10", "Matric Science"
  code: string; // e.g. "G10"
  numericLevel: number;
  classTeacherId?: mongoose.Types.ObjectId;
  classTeacherName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    numericLevel: { type: Number, default: 1 },
    classTeacherId: { type: Schema.Types.ObjectId, ref: "User" },
    classTeacherName: { type: String },
  },
  { timestamps: true }
);

ClassSchema.index({ schoolId: 1, branchId: 1, name: 1 }, { unique: true });

ClassSchema.plugin(branchScoped);
export const ClassModel =
  mongoose.models.ClassModel ||
  mongoose.models.Class ||
  mongoose.model<IClass>("ClassModel", ClassSchema);

if (!mongoose.models.Class) {
  try {
    mongoose.model("Class", ClassSchema);
  } catch {
    // Model already registered
  }
}

export interface ISection extends Document {
  schoolId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  className: string;
  name: string; // e.g. "Section A"
  roomNumber?: string;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    roomNumber: { type: String },
    capacity: { type: Number, default: 40 },
  },
  { timestamps: true }
);

SectionSchema.index({ schoolId: 1, classId: 1, name: 1 }, { unique: true });

SectionSchema.plugin(branchScoped);
export const SectionModel =
  mongoose.models.SectionModel ||
  mongoose.models.Section ||
  mongoose.model<ISection>("SectionModel", SectionSchema);

if (!mongoose.models.Section) {
  try {
    mongoose.model("Section", SectionSchema);
  } catch {
    // Model already registered
  }
}
