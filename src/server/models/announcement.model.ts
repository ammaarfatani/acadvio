import mongoose, { Schema, Document } from "mongoose";

export interface IAnnouncement extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  category: "General" | "Academic" | "Examination" | "Holiday" | "Urgent";
  targetRoles?: string[]; // e.g. ["TEACHER", "FINANCE"]
  postedByName: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, enum: ["General", "Academic", "Examination", "Holiday", "Urgent"], default: "General" },
    targetRoles: [{ type: String }],
    postedByName: { type: String, required: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Announcement =
  mongoose.models.Announcement || mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
