import smartReportsRoutes from "./smartReports.routes";
import identityCardRoutes from "./identityCard.routes";
import schoolDocumentRoutes from "./schoolDocument.routes";
import studentMediaRoutes from "./studentMedia.routes";
import workforceRoutes from "./workforce.routes";
import documentRoutes from "./document.routes";
import organizationRoutes from "./organization.routes";
import parentRoutes from "./parent.routes";
import noticeRoutes from "./notice.routes";
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
router.use("/smart-reports",smartReportsRoutes);
router.use("/id-cards",identityCardRoutes);
router.use("/school-documents",schoolDocumentRoutes);
router.use("/student-media",studentMediaRoutes);
router.use("/workforce", workforceRoutes);

router.use("/organization", organizationRoutes);
router.use("/documents", documentRoutes);
router.use("/parent", parentRoutes);
router.use("/notices", noticeRoutes);
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



