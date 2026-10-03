import { Router } from "express";
import workspaceRoutes from "./workspace.routes";
import authRoutes from "./auth.routes";
import publicRoutes from "./public.routes";
import superAdminRoutes from "./superadmin.routes";
import schoolRoutes from "./school.routes";
import userRoutes from "./user.routes";
import subscriptionRoutes from "./subscription.routes";
import subscriptionPaymentRoutes from "./subscriptionPayment.routes";
import schoolAdminRoutes from "./schoolAdmin.routes";
import teacherRoutes from "./teacher.routes";
import financeRoutes from "./finance.routes";
import examRoutes from "./exam.routes";
import receptionistRoutes from "./receptionist.routes";

const router = Router();

router.use("/workspace", workspaceRoutes);
router.use("/public", publicRoutes);
router.use("/auth", authRoutes);
router.use("/super-admin", superAdminRoutes);
router.use("/schools", schoolRoutes);
router.use("/users", userRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/subscription-payments", subscriptionPaymentRoutes);
router.use("/school-admin", schoolAdminRoutes);
router.use("/teacher", teacherRoutes);
router.use("/finance", financeRoutes);
router.use("/exams", examRoutes);
router.use("/receptionist", receptionistRoutes);

export default router;



