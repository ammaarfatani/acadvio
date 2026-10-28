import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { TeacherService } from "../services/teacher.service";
import { linkedChild } from "../services/parent.service";
import { readStudentPhoto } from "../services/studentPhoto.service";
import { sendSuccess } from "../utils/response.util";
const router = Router();
router.use(authenticate, enforceSchoolTenant);
router.get(
  "/staff/:id/photo",
  (req, res, next) => {
    const allowed = [
      "teachers.view",
      "users.view",
      "staff-attendance.manage",
      "payroll.view",
    ].find((p) => req.user?.permissions?.includes(p));
    return requirePermission(allowed || "teachers.view")(req, res, next);
  },
  async (req, res, next) => {
    try {
      const id = z
        .string()
        .regex(/^[a-f0-9]{24}$/i)
        .parse(req.params.id);
      const staff = (await User.findOne({
        _id: id,
        schoolId: req.user!.schoolId,
        userType: { $nin: ["PARENT", "SUPER_ADMIN"] },
      })
        .select("+idPhoto")
        .lean()) as any;
      if (!staff) throw { statusCode: 404, message: "Staff record not found." };
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(res, { image: staff.idPhoto || "" });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/:id/photo",
  (req, res, next) =>
    req.user?.userType === "PARENT"
      ? next()
      : requirePermission(
          req.user?.userType === "FINANCE" ? "fees.view" : "students.view",
        )(req, res, next),
  async (req, res, next) => {
    try {
      const id = z
        .string()
        .regex(/^[a-f0-9]{24}$/i)
        .parse(req.params.id);
      if (req.user!.userType === "TEACHER")
        await TeacherService.getStudentHistory(
          req.user!.schoolId!,
          id,
          req.user!.userId,
        );
      if (req.user!.userType === "PARENT") await linkedChild(req.user!, id);
      const student = await Student.findOne({
        _id: id,
        schoolId: req.user!.schoolId,
      }).select("+photoStorageId");
      if (!student) throw { statusCode: 404, message: "Student not found." };
      res.set({
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return sendSuccess(res, { image: await readStudentPhoto(student) });
    } catch (error) {
      next(error);
    }
  },
);
export default router;
