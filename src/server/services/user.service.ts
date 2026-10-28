import mongoose from "mongoose";
import {StaffEmployment,StaffDepartment} from "../models/workforce.model";
import { ClientSession } from "mongoose";
import { School } from "../models/school.model";
import { hasFeature } from "../../lib/plan-features";
import { withoutBranchScope } from "../utils/branchScope";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { LoginActivity } from "../models/loginActivity.model";
import { UserType, UserStatus } from "../constants/roles.constant";
import { SubscriptionEntitlementService } from "./subscriptionEntitlement.service";
import { hashPassword } from "../utils/password.util";
import { CreateUserInput } from "../validators/user.validator";

export class UserService {
  static async getSchoolUsers(schoolId: string) {
    return User.find({ schoolId }).populate("roleId").select("-passwordHash -refreshTokenHash -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires").sort({ createdAt: -1 });
  }

  static async createStaffUser(schoolId: string, input: CreateUserInput, session?: ClientSession) {
    if(input.department&&!session){const transaction=await mongoose.startSession();let result:any;try{await transaction.withTransaction(async()=>{result=await this.createStaffUser(schoolId,input,transaction);});return result;}finally{await transaction.endSession();}}
    if(input.department&&!await StaffDepartment.exists({schoolId,name:input.department}).session(session||null))throw {statusCode:400,message:"Select a configured department from this branch."};

    if (input.userType === UserType.SCHOOL_ADMIN) throw { statusCode: 403, message: "Create branch administrators through organization management." };
    const school = await School.findById(schoolId);
    if (![UserType.TEACHER, UserType.PARENT].includes(input.userType) && !hasFeature(school?.status === "TRIAL" ? "FREE_TRIAL" : school?.plan, "STAFF_ROLES")) throw { statusCode: 403, message: "Staff departments require Professional or Enterprise." };
    if (input.userType === UserType.TEACHER) {
      await SubscriptionEntitlementService.checkCapacityLimit(schoolId, "teachers");
    }
    if(input.salary!==undefined&&!hasFeature(school?.status==="TRIAL"?"FREE_TRIAL":school?.plan,"FINANCE"))throw {statusCode:403,message:"Your subscription does not include salary management."};
    // 1. Check if email already exists
    const existing = await withoutBranchScope(() => User.findOne({ email: input.email.toLowerCase() }).exec());
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
    const [user] = await User.create([{
      schoolId,
      roleId: role._id,
      userType: input.userType,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isOrganizationOwner: false,
    }], { session });

    if(input.department)await StaffEmployment.create([{schoolId,userId:user._id,employeeId:user.employeeId,department:input.department,phone:input.phone,designation:input.userType.replaceAll("_"," "),joiningDate:input.joiningDate||new Date().toISOString().slice(0,10),status:"ACTIVE",salaryHistory:input.salary===undefined?[]:[{effectiveDate:input.joiningDate||new Date().toISOString().slice(0,10),amount:input.salary,basis:"MONTHLY"}]}],session?{session}:{});
    return {
      id: user._id,
      employeeId:user.employeeId,
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
