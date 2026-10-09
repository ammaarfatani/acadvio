import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IAcademicSession extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isArchived?:boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicSessionSchema = new Schema<IAcademicSession>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
    isArchived:{type:Boolean,default:false},
  },
  { timestamps: true }
);

AcademicSessionSchema.index({ schoolId: 1, branchId: 1, name: 1 }, { unique: true });

AcademicSessionSchema.plugin(branchScoped);
export const AcademicSession =
  mongoose.models.AcademicSession ||
  mongoose.model<IAcademicSession>("AcademicSession", AcademicSessionSchema);
