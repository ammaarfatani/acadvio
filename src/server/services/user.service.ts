import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { LoginActivity } from "../models/loginActivity.model";
import { UserType, UserStatus } from "../constants/roles.constant";
import { SubscriptionEntitlementService } from "./subscriptionEntitlement.service";
import { hashPassword } from "../utils/password.util";
import { CreateUserInput } from "../validators/user.validator";

export class UserService {
  static async getSchoolUsers(schoolId: string) {
    return User.find({ schoolId }).populate("roleId").select("-passwordHash -refreshTokenHash").sort({ createdAt: -1 });
  }

  static async createStaffUser(schoolId: string, input: CreateUserInput) {
    if (input.userType === UserType.TEACHER) {
      await SubscriptionEntitlementService.checkCapacityLimit(schoolId, "teachers");
    }
    // 1. Check if email already exists
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw { statusCode: 400, message: "A user with this email address already exists." };
    }

    // 2. Map role by userType
    let role = await Role.findOne({
      $or: [
        { schoolId, userType: input.userType },
        { schoolId: null, userType: input.userType },
      ],
    });

    if (!role) {
      role = await Role.create({
        schoolId,
        name: `${input.userType} Staff Role`,
        code: `ROLE_${input.userType}`,
        userType: input.userType,
        permissions: [],
        isSystemRole: false,
      });
    }

    // 3. Create User
    const passwordHash = await hashPassword(input.password);
    const user = await User.create({
      schoolId,
      roleId: role._id,
      userType: input.userType,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      status: user.status,
    };
  }

  static async updateUserStatus(schoolId: string, userId: string, status: UserStatus) {
    const user = await User.findOne({ _id: userId, schoolId });
    if (!user) {
      throw { statusCode: 404, message: "Staff user not found in this school tenant." };
    }

    if (user.userType === UserType.SCHOOL_ADMIN && status === UserStatus.DEACTIVATED) {
      throw { statusCode: 400, message: "Cannot deactivate primary School Admin account." };
    }

    user.status = status;
    await user.save();

    return { id: user._id, status: user.status, message: `User status updated to ${status}.` };
  }

  static async getSchoolLoginActivity(schoolId: string) {
    return LoginActivity.find({ schoolId }).sort({ timestamp: -1 }).limit(50);
  }
}
