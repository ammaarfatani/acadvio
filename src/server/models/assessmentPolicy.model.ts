import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const schema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    academicSessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    method: {
      type: String,
      enum: ["WEIGHTED", "CUMULATIVE", "FINAL_ONLY"],
      required: true,
    },
    components: [
      {
        examId: {
          type: Schema.Types.ObjectId,
          ref: "ExamSchedule",
          required: true,
        },
        weight: { type: Number, min: 0, max: 100 },
      },
    ],
    absence: {
      type: String,
      enum: ["ZERO_FAIL", "INCOMPLETE"],
      default: "ZERO_FAIL",
    },
    requireAllSubjects: { type: Boolean, default: true },
    revision: { type: Number, default: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
schema.plugin(branchScoped);
schema.index(
  { schoolId: 1, branchId: 1, academicSessionId: 1, classId: 1 },
  { unique: true },
);
export const AssessmentPolicy =
  mongoose.models.AssessmentPolicy ||
  mongoose.model("AssessmentPolicy", schema);
