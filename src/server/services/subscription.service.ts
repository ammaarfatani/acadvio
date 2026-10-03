import { Subscription } from "../models/subscription.model";
import { School } from "../models/school.model";

export class SubscriptionService {
  static async getSchoolSubscription(schoolId: string) {
    const sub = await Subscription.findOne({ schoolId }).populate("schoolId", "name email status plan");
    if (!sub) {
      throw { statusCode: 404, message: "Subscription record not found." };
    }
    return sub;
  }
}
