import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IClassCategory extends Document {
  schoolId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClassCategorySchema = new Schema<IClassCategory>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ClassCategorySchema.index({ schoolId: 1, branchId: 1, name: 1 }, { unique: true });

ClassCategorySchema.plugin(branchScoped);

export const ClassCategory =
  mongoose.models.ClassCategory ||
  mongoose.model<IClassCategory>("ClassCategory", ClassCategorySchema);

export const ClassCategoryModel = ClassCategory;
