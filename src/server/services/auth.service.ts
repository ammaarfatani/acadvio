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
    const user = await User.findOne({ email: input.email.toLowerCase() }).populate("roleId");

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
    if (user.status === UserStatus.PENDING_APPROVAL && user.userType !== UserType.SCHOOL_ADMIN) {
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
    if (user.schoolId && user.userType !== UserType.SUPER_ADMIN) {
      await expireTrials(user.schoolId.toString());
      const school = await School.findById(user.schoolId);
      if (!school) {
        throw { statusCode: 404, message: "Associated school profile not found." };
      }

      if (school.status === SubscriptionStatus.PENDING_APPROVAL && user.userType !== UserType.SCHOOL_ADMIN) {
        throw {
          statusCode: 403,
          message: "Your school is still awaiting approval. Your account will be available once approval is complete.",
        };
      }

      if (school.status === SubscriptionStatus.SUSPENDED || school.status === SubscriptionStatus.CANCELLED) {
        throw {
          statusCode: 403,
          message: `Access restricted. Your school subscription status is '${school.status}'.`,
        };
      }

      if (![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL].includes(school.status) && user.userType !== UserType.SCHOOL_ADMIN) throw { statusCode: 403, message: "School access is restricted. Ask your school administrator to upgrade the subscription." };
      schoolCode = school.code;
      schoolSlug = school.slug || school.code;
      schoolName = school.name;
      schoolStatus = school.status;
    }

    // 5. Extract permissions
    let permissions: string[] = [];
    if (user.roleId && typeof user.roleId === "object") {
      permissions = (user.roleId as any).permissions || [];
    }

    // 6. Generate Tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      userType: user.userType,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      permissions,
    });

    const refreshToken = generateRefreshToken({ userId: user._id.toString() });

    // Store refresh token hash & last login
    user.refreshTokenHash = await hashPassword(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    // Log Activity
    await LoginActivity.create({
      userId: user._id,
      schoolId: user.schoolId,
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
        schoolCode,
        schoolSlug,
        schoolName,
        school: user.schoolId ? { name: schoolName, code: schoolCode, slug: schoolSlug, status: schoolStatus } : null,
        permissions,
        lastLogin: user.lastLogin,
      },
    };
  }

  static async refreshToken(refreshToken: string) {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId).populate("roleId");
    if (!user || !user.refreshTokenHash) {
      throw { statusCode: 401, message: "Invalid refresh token session." };
    }

    const isValid = await comparePassword(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      throw { statusCode: 401, message: "Expired or invalid refresh token." };
    }

    let permissions: string[] = [];
    if (user.roleId && typeof user.roleId === "object") {
      permissions = (user.roleId as any).permissions || [];
    }

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      userType: user.userType,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      permissions,
    });

    const newRefreshToken = generateRefreshToken({ userId: user._id.toString() });
    user.refreshTokenHash = await hashPassword(newRefreshToken);
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
    return { message: "Logged out successfully." };
  }

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return generic message for security
      return { message: "If an account with that email exists, a password reset token has been generated." };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    return {
      message: "Password reset token generated.",
      resetToken, // For dev testing
    };
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

    user.passwordHash = await hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokenHash = undefined;
    await user.save();

    return { message: "Password reset successful. You can now login with your new password." };
  }

  static async getMe(userId: string) {
    const user = await User.findById(userId).populate("roleId").populate("schoolId");
    if (!user) {
      throw { statusCode: 404, message: "User not found." };
    }

    let permissions: string[] = [];
    if (user.roleId && typeof user.roleId === "object") {
      permissions = (user.roleId as any).permissions || [];
    }

    const schoolRecord: any = user.schoolId && typeof user.schoolId === "object" ? user.schoolId : null;
    const school = schoolRecord ? { ...schoolRecord.toObject(), slug: schoolRecord.slug || schoolRecord.code } : null;

    return {
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




