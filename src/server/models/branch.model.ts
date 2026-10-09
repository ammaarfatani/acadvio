import mongoose, { Schema } from "mongoose";
const BranchSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  name: { type: String, trim: true, required: true }, code: { type: String, trim: true, lowercase: true, required: true },
  address: { type: String, trim: true, required: true }, phone: { type: String, trim: true, required: true }, email: { type: String, trim: true, lowercase: true },
  logoUrl: String, domain: String, currency: { type: String, enum: ["PKR"] }, dateFormat: String, bankDetails: { bankName: String, accountTitle: String, accountNumber: String, iban: String, branch:String, instructions:String, enabled:{type:Boolean} },
  bankDetailsConfigured:{type:Boolean,default:false},
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }, isMain: { type: Boolean, default: false },
}, { timestamps: true });
BranchSchema.index({ organizationId: 1, code: 1 }, { unique: true });
BranchSchema.index({ organizationId: 1, isMain: 1 }, { unique: true, partialFilterExpression: { isMain: true } });
export const Branch = mongoose.models.Branch || mongoose.model("Branch", BranchSchema);
