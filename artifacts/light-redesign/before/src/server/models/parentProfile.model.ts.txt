import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const schema = new Schema({ schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true }, userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true }, studentIds: [{ type: Schema.Types.ObjectId, ref: "Student", required: true }] }, { timestamps: true });
schema.plugin(branchScoped);
export const ParentProfile = mongoose.models.ParentProfile || mongoose.model("ParentProfile", schema);
