import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const schema = new Schema({ schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true }, noticeId: { type: Schema.Types.ObjectId, ref: "Announcement", required: true }, userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, readAt: { type: Date, default: Date.now } }, { timestamps: true });
schema.index({ noticeId: 1, userId: 1 }, { unique: true });
schema.plugin(branchScoped, { shared: true });
export const NoticeRead = mongoose.models.NoticeRead || mongoose.model("NoticeRead", schema);
