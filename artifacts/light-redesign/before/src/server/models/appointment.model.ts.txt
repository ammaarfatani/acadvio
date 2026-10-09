import { branchScoped } from "../utils/branchScope";
import mongoose, { Document, Schema } from "mongoose";

export interface IAppointment extends Document {
  schoolId: mongoose.Types.ObjectId;
  visitorName: string;
  phone: string;
  email?: string;
  purpose: string;
  personToMeet: string;
  department: string;
  appointmentDate: Date;
  timeSlot: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  notes?: string;
  bookedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    visitorName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    purpose: { type: String, required: true, trim: true },
    personToMeet: { type: String, required: true, trim: true },
    department: {
      type: String,
      default: "Principal",
      trim: true,
    },
    appointmentDate: { type: Date, required: true, index: true },
    timeSlot: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED"],
      default: "SCHEDULED",
      index: true,
    },
    notes: { type: String, trim: true },
    bookedBy: { type: String },
  },
  { timestamps: true }
);

AppointmentSchema.index({ schoolId: 1, appointmentDate: 1, status: 1 });

AppointmentSchema.plugin(branchScoped);
export const Appointment =
  mongoose.models.Appointment || mongoose.model<IAppointment>("Appointment", AppointmentSchema);
