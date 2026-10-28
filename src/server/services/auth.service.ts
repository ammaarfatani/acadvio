import {frontendLink} from "../utils/emailTemplate";
import { sendEmailNotification } from "../utils/email.util";
import { env } from "../config/env";
import { resolveBranchContext } from "./branchContext.service";
import { branchContext, withoutBranchScope } from "../utils/branchScope";
import { PLAN_FEATURES } from "../../lib/plan-features";
import crypto from "crypto";
import { User } from "../models/user.model";
import { School } from "../models/school.model";
import { Role } from "../models/role.model";
import { LoginActivity } from "../models/loginActivity.model";
import { UserType, UserStatus } from "../constants/roles.constant";
import { SubscriptionStatus } from "../constants/subscription.constant";
import { comparePassword, hashPassword } from "../utils/password.util";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.util";
import { expireTrials } from "./trialLifecycle.service";
import { LoginInput } from "../validators/auth.validator";

export class AuthService {
  static async login(input: LoginInput, ipAddress: string = "127.0.0.1", userAgent: string = "Unknown") {
    // 1. Find user by email
    const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash").populate("roleId");

    if (!user) {
      await LoginActivity.create({
        emailAttempt: input.email,
        action: "LOGIN_FAILED_USER_NOT_FOUND",
        ipAddress,
        userAgent,
      });
      throw { statusCode: 401, message: "Invalid email or password credentials." };
    }

    // 2. Compare password
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await LoginActivity.create({
        userId: user._id,
        schoolId: user.schoolId,
        organizationId: user.schoolId,
        branchId: user.branchId || user.schoolId,
        userType: user.userType,
        emailAttempt: input.email,
        action: "LOGIN_FAILED_INVALID_PASSWORD",
        ipAddress,
        userAgent,
      });
      throw { statusCode: 401, message: "Invalid email or password credentials." };
    }

    if (input.schoolSlug || input.schoolCode) {
      if (!user.schoolId || user.userType === UserType.SUPER_ADMIN) {
        throw { statusCode: 403, message: "This account cannot sign in through a school portal." };
      }
      const matchedSchool = await School.findById(user.schoolId).select("slug code");
      const matchesSlug = !input.schoolSlug || (matchedSchool?.slug || matchedSchool?.code) === input.schoolSlug;
      const matchesCode = !input.schoolCode || matchedSchool?.code === input.schoolCode;
      if (!matchedSchool || !matchesSlug || !matchesCode) {
        throw { statusCode: 403, message: "These credentials do not belong to this school's portal." };
      }
    }

    // 3. Check user status
    if (user.status === UserStatus.PENDING_APPROVAL && (user.userType !== UserType.SCHOOL_ADMIN || !user.schoolId || (await School.findById(user.schoolId).select("registrationType"))?.registrationType !== "paid")) {
      throw {
        statusCode: 403,
        message: "Your school is still awaiting approval. You will receive an email once the approval is complete.",
      };
    }

    if (user.status === UserStatus.DEACTIVATED || user.status === UserStatus.INACTIVE) {
      throw {
        statusCode: 403,
        message: `Your account status is '${user.status}'. Please contact your school administrator.`,
      };
    }

    // 4. Check School status (if not Super Admin)
    let schoolCode: string | null = null;
    let schoolSlug: string | null = null;
    let schoolName: string | null = null;
    let schoolStatus: string | null = null;
    let registrationType: string | undefined;
    if (user.schoolId && user.userType !== UserType.SUPER_ADMIN) {
      await expireTrials(user.schoolId.toString());
      const school = await School.findById(user.schoolId);
      if (!school) {
        throw { statusCode: 404, message: "Associated school profile not found." };
      }

      if (school.status === SubscriptionStatus.PENDING_APPROVAL && (school.registrationType !== "paid" || user.userType !== UserType.SCHOOL_ADMIN)) {
        throw {
          statusCode: 403,
          message: "Your school is still awaiting approval. Your account will be available once approval is complete.",
        };
      }

      if(school.accountStatus==="DEACTIVATED"&&user.userType!==UserType.SCHOOL_ADMIN)throw {statusCode:403,message:"Your organization is deactivated. Contact your school administrator."};
      if (school.status === SubscriptionStatus.SUSPENDED || school.status === SubscriptionStatus.CANCELLED) {
        throw {
          statusCode: 403,
          message: `Access restricted. Your school subscription status is '${school.status}'.`,
        };
      }

      if (![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL].includes(school.status) && user.userType !== UserType.SCHOOL_ADMIN) throw { statusCode: 403, message: "School access is restricted. Ask your school administrator to upgrade the subscription." };
      await resolveBranchContext(user, school);
      schoolCode = school.code;
      schoolSlug = school.slug || school.code;
      schoolName = school.name;
      schoolStatus = school.status;
      registrationType = school.registrationType;
    }

    // 5. Extract permissions
    let permissions: string[] = [];
    if (user.roleId && typeof user.roleId === "object") {
      permissions = (user.roleId as any).permissions || [];
    }

    // 6. Generate Tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion || 0,
      email: user.email,
      userType: user.userType,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      permissions,
    });

    const refreshToken = generateRefreshToken({ userId: user._id.toString(), tokenVersion: user.tokenVersion || 0 });

    // Store refresh token hash & last login
    user.refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    user.lastLogin = new Date();
    await user.save();

    // Log Activity
    await LoginActivity.create({
      userId: user._id,
      schoolId: user.schoolId,
      organizationId: user.schoolId,
      branchId: user.branchId || user.schoolId,
      userType: user.userType,
      emailAttempt: input.email,
      action: "LOGIN_SUCCESS",
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        status: user.status,
        schoolId: user.schoolId,
        organizationId: user.schoolId,
        branchId: user.branchId || user.schoolId,
        schoolCode,
        schoolSlug,
        schoolName,
        school: user.schoolId ? { name: schoolName, code: schoolCode, slug: schoolSlug, status: schoolStatus, registrationType } : null,
        permissions,
        lastLogin: user.lastLogin,
      },
    };
  }

  static async refreshToken(refreshToken: string) {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId).select("+refreshTokenHash").populate("roleId");
    if (!user || !user.refreshTokenHash || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      throw { statusCode: 401, message: "Invalid refresh token session." };
    }

    const isValid = /^[a-f0-9]{64}$/.test(user.refreshTokenHash) ? crypto.timingSafeEqual(Buffer.from(user.refreshTokenHash,"hex"),crypto.createHash("sha256").update(refreshToken).digest()) : await comparePassword(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      throw { statusCode: 401, message: "Expired or invalid refresh token." };
    }

    if (user.userType !== UserType.SUPER_ADMIN) {
      const school = user.schoolId ? await School.findById(user.schoolId).select("status registrationType accountStatus") : null;
      if(school?.accountStatus==="DEACTIVATED"&&user.userType!==UserType.SCHOOL_ADMIN)throw {statusCode:403,message:"Organization deactivated."};
      const paidPending = user.userType === UserType.SCHOOL_ADMIN && school?.registrationType === "paid";
      if ((user.status !== UserStatus.ACTIVE && !(user.status === UserStatus.PENDING_APPROVAL && paidPending)) || !school || (school.status === SubscriptionStatus.PENDING_APPROVAL && !paidPending) || [SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED].includes(school.status)) throw { statusCode: 403, message: "Your school/account is awaiting approval or access is restricted." };
    }

    let permissions: string[] = [];
    if (user.roleId && typeof user.roleId === "object") {
      permissions = (user.roleId as any).permissions || [];
    }

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion || 0,
      email: user.email,
      userType: user.userType,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      permissions,
    });

    const newRefreshToken = generateRefreshToken({ userId: user._id.toString(), tokenVersion: user.tokenVersion || 0 });
    user.refreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    return withoutBranchScope(async () => {
      const user = await User.findById(userId).select("+passwordHash");
      if (!user || !await comparePassword(currentPassword, user.passwordHash)) throw { statusCode: 400, message: "Current password is incorrect." };
      if (await comparePassword(newPassword, user.passwordHash)) throw { statusCode: 400, message: "Choose a different new password." };
      const updated = await User.findOneAndUpdate({ _id: userId, passwordHash: user.passwordHash }, { $set: { passwordHash: await hashPassword(newPassword) }, $inc: { tokenVersion: 1 }, $unset: { refreshTokenHash: 1, resetPasswordToken: 1, resetPasswordExpires: 1 } });
      if (!updated) throw { statusCode: 409, message: "Account changed. Sign in and try again." };
      return { message: "Password changed successfully. Please sign in again." };
    });
  }

  static async logout(userId: string) {
    await withoutBranchScope(() => User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } }).exec());
    return { message: "Logged out successfully." };
  }

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return generic message for security
      return { message: "If an account with that email exists, password reset instructions have been sent." };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    try{await sendEmailNotification({to:user.email,subject:"Reset your Acadivo password",greeting:"Hello "+user.name+",",text:"You requested a password reset. This link expires in one hour and can only be used once. If you did not request this, you can ignore this email.",actionLabel:"Reset Your Password",actionUrl:frontendLink(env.FRONTEND_URL,"/reset-password#token="+encodeURIComponent(resetToken),env.NODE_ENV==="production")});}catch{console.error("[EMAIL] Password reset delivery unavailable.");}
    return { message: "If an account with that email exists, password reset instructions have been sent." };
  }

  static async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw { statusCode: 400, message: "Password reset token is invalid or has expired." };
    }

    const changed=await User.findOneAndUpdate({_id:user._id,resetPasswordToken:hashedToken,resetPasswordExpires:{$gt:new Date()}},{$set:{passwordHash:await hashPassword(newPassword)},$inc:{tokenVersion:1},$unset:{resetPasswordToken:1,resetPasswordExpires:1,refreshTokenHash:1}});
    if(!changed)throw {statusCode:400,message:"Password reset token is invalid or has expired."};

    return { message: "Password reset successful. You can now login with your new password." };
  }

  static async getMe(userId: string) {
    const user = await withoutBranchScope(() => User.findById(userId).populate("roleId").populate("schoolId").exec());
    if (!user) {
      throw { statusCode: 404, message: "User not found." };
    }

    let permissions: string[] = [];
    if (user.roleId && typeof user.roleId === "object") {
      permissions = (user.roleId as any).permissions || [];
    }

    const schoolRecord: any = user.schoolId && typeof user.schoolId === "object" ? user.schoolId : null;
    const school = schoolRecord ? { ...schoolRecord.toObject(), slug: schoolRecord.slug || schoolRecord.code } : null;

    if (school) { delete school.theme; delete school.documentSettings; }
    return {
      organizationId: school ? String(school._id) : null,
      branchId: branchContext.getStore() ? branchContext.getStore()!.branchId : (user.branchId ? String(user.branchId) : school ? String(school._id) : null),
      isOrganizationOwner: branchContext.getStore()?.owner ?? user.isOrganizationOwner === true,
      features: school ? PLAN_FEATURES[school.status === "TRIAL" ? "FREE_TRIAL" : school.plan] || [] : [],
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      status: user.status,
      school,
      role: user.roleId,
      permissions,
      lastLogin: user.lastLogin,
    };
  }
}




