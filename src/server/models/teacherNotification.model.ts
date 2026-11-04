import { branchScoped } from "../utils/branchScope";
import mongoose, { Document, Schema } from "mongoose";

export interface ITeacherNotification extends Document {
  schoolId: mongoose.Types.ObjectId;
  teacherUserId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  href?: string;
  dedupeKey?:string; studentId?:mongoose.Types.ObjectId;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const TeacherNotificationSchema = new Schema<ITeacherNotification>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  teacherUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  href: { type: String },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });

TeacherNotificationSchema.add({dedupeKey:String,studentId:{type:Schema.Types.ObjectId,ref:"Student"}});
TeacherNotificationSchema.index({schoolId:1,teacherUserId:1,dedupeKey:1},{unique:true,partialFilterExpression:{dedupeKey:{$type:"string"}}});
TeacherNotificationSchema.index({ schoolId: 1, teacherUserId: 1, createdAt: -1 });
TeacherNotificationSchema.plugin(branchScoped);
export const TeacherNotification = mongoose.models.TeacherNotification || mongoose.model<ITeacherNotification>("TeacherNotification", TeacherNotificationSchema);
