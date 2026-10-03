import mongoose, { Document, Schema } from "mongoose";

export interface ITeacherNotification extends Document {
  schoolId: mongoose.Types.ObjectId;
  teacherUserId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  href?: string;
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

TeacherNotificationSchema.index({ schoolId: 1, teacherUserId: 1, createdAt: -1 });
export const TeacherNotification = mongoose.models.TeacherNotification || mongoose.model<ITeacherNotification>("TeacherNotification", TeacherNotificationSchema);
