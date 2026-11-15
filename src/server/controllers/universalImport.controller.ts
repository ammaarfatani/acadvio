import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UniversalImportService } from "../services/universalImport.service";
import { sendSuccess } from "../utils/response.util";
import { UNIVERSAL_ENTITIES } from "../../lib/universal-import-config";

export const universalPreviewSchema = z.object({
  filename: z.string().min(1).max(200),
  base64: z.string().min(1).max(35 * 1024 * 1024), // Up to 25 MB payload
});

export const universalCommitSchema = z.object({
  skipDuplicates: z.boolean().default(true),
});

export class UniversalImportController {
  private static getContext(req: Request) {
    if (!req.user?.schoolId || !req.user?.userId) {
      throw { statusCode: 403, message: "School administrator context required." };
    }
    return [req.user.schoolId, req.user.userId] as const;
  }

  private static sendDownload(res: Response, buffer: Buffer, filename: string) {
    return sendSuccess(
      res,
      {
        base64: buffer.toString("base64"),
        filename,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      "Excel workbook ready."
    );
  }

  /**
   * Retrieves active plan tier entitlements and template metadata for the authenticated school.
   */
  static async planInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId] = UniversalImportController.getContext(req);
      const info = await UniversalImportService.getPlanInfo(schoolId);
      return sendSuccess(res, info, "Plan migration info retrieved.");
    } catch (e) {
      next(e);
    }
  }

  /**
   * Retrieves past master school migration jobs for the school.
   */
  static async history(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId] = UniversalImportController.getContext(req);
      const list = await UniversalImportService.history(schoolId);
      return sendSuccess(res, list, "Migration history retrieved.");
    } catch (e) {
      next(e);
    }
  }

  /**
   * Downloads the Plan-Specific Master School Migration Template (Blank).
   */
  static async masterTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId] = UniversalImportController.getContext(req);
      const planOverride = typeof req.query.plan === "string" ? req.query.plan : undefined;
      const type = req.query.type === "example" || req.query.type === "demo" ? "example" : "blank";
      const { buffer, filename } = await UniversalImportService.template(schoolId, "master", planOverride, type);
      return UniversalImportController.sendDownload(res, buffer, filename);
    } catch (e) {
      next(e);
    }
  }

  /**
   * Downloads the complete Plan-Specific Fictional Demonstration Example Workbook.
   */
  static async masterSample(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId] = UniversalImportController.getContext(req);
      const planOverride = typeof req.query.plan === "string" ? req.query.plan : undefined;
      const { buffer, filename } = await UniversalImportService.template(schoolId, "master", planOverride, "example");
      return UniversalImportController.sendDownload(res, buffer, filename);
    } catch (e) {
      next(e);
    }
  }

  /**
   * Downloads an individual module Excel template (blank or pre-filled example).
   */
  static async moduleTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId] = UniversalImportController.getContext(req);
      const entity = String(req.params.entity);
      const type = req.query.type === "example" || req.query.type === "demo" ? "example" : "blank";
      const { buffer, filename } = await UniversalImportService.template(schoolId, entity, undefined, type);
      return UniversalImportController.sendDownload(res, buffer, filename);
    } catch (e) {
      next(e);
    }
  }

  /**
   * Previews an uploaded spreadsheet (master or single-entity).
   */
  static async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId, actorId] = UniversalImportController.getContext(req);
      const entity = String(req.params.entity || req.body.entity || "master");
      const { filename, base64 } = universalPreviewSchema.parse(req.body);

      const result = await UniversalImportService.preview(schoolId, actorId, entity, filename, base64);
      return sendSuccess(res, result, "Spreadsheet validated. Review preview before committing.");
    } catch (e) {
      next(e);
    }
  }

  /**
   * Gets import job status and paginated rows.
   */
  static async status(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId, actorId] = UniversalImportController.getContext(req);
      const importId = String(req.params.importId);
      const page = Number(req.query.page) || 1;

      const job = await UniversalImportService.getJob(schoolId, actorId, importId, page);
      return sendSuccess(res, job, "Import status retrieved.");
    } catch (e) {
      next(e);
    }
  }

  /**
   * Starts processing the import.
   */
  static async commit(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId, actorId] = UniversalImportController.getContext(req);
      const importId = String(req.params.importId);
      const { skipDuplicates } = universalCommitSchema.parse(req.body);

      const result = await UniversalImportService.start(schoolId, actorId, importId, skipDuplicates);
      return sendSuccess(res, result, "Import execution started.", 202);
    } catch (e) {
      next(e);
    }
  }

  /**
   * Downloads line-by-line Excel Error Report.
   */
  static async errorReport(req: Request, res: Response, next: NextFunction) {
    try {
      const [schoolId, actorId] = UniversalImportController.getContext(req);
      const importId = String(req.params.importId);
      const entity = String(req.params.entity || "migration");

      const buffer = await UniversalImportService.errorReport(schoolId, actorId, importId);
      return UniversalImportController.sendDownload(
        res,
        buffer,
        `Acadivo-${entity}-Import-Errors.xlsx`
      );
    } catch (e) {
      next(e);
    }
  }
}
