import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ImportEntity } from "../../lib/bulk-import";
import { BulkImportService } from "../services/bulkImport.service";
import { sendSuccess } from "../utils/response.util";
export const previewImportSchema = z.object({ filename: z.string().min(1).max(150), base64: z.string().min(1).max(7 * 1024 * 1024) });
export const commitImportSchema = z.object({ skipDuplicates: z.boolean() });
export function bulkImportHandlers(entity: ImportEntity) {
    const context = (req: Request) => { if (!req.user?.schoolId || !req.user.userId)
        throw { statusCode: 403, message: "School administrator context required." }; return [req.user.schoolId, req.user.userId] as const; };
    const downloadable = (res: Response, buffer: Buffer) => sendSuccess(res, { base64: buffer.toString("base64"), filename: `acadivo-${entity}-template.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, "Excel file ready.");
    return {
        template: async (req: Request, res: Response, next: NextFunction) => { try {
            const [schoolId] = context(req);
            downloadable(res, await BulkImportService.template(schoolId, entity));
        }
        catch (e) {
            next(e);
        } },
        preview: async (req: Request, res: Response, next: NextFunction) => { try {
            const [schoolId, actorId] = context(req);
            sendSuccess(res, await BulkImportService.preview(schoolId, actorId, entity, req.body.filename, req.body.base64), "File validated. Review the preview before importing.");
        }
        catch (e) {
            next(e);
        } },
        status: async (req: Request, res: Response, next: NextFunction) => { try {
            const [schoolId, actorId] = context(req);
            const job = await BulkImportService.get(schoolId, actorId, String(req.params.importId), Number(req.query.page) || 1);
            if (job.entity !== entity)
                throw { statusCode: 404, message: "Import not found." };
            sendSuccess(res, job, "Import status retrieved.");
        }
        catch (e) {
            next(e);
        } },
        commit: async (req: Request, res: Response, next: NextFunction) => { try {
            const [schoolId, actorId] = context(req);
            const job = await BulkImportService.get(schoolId, actorId, String(req.params.importId));
            if (job.entity !== entity)
                throw { statusCode: 404, message: "Import not found." };
            sendSuccess(res, await BulkImportService.start(schoolId, actorId, String(req.params.importId), req.body.skipDuplicates), "Import processing started.", 202);
        }
        catch (e) {
            next(e);
        } },
        errors: async (req: Request, res: Response, next: NextFunction) => { try {
            const [schoolId, actorId] = context(req);
            const job = await BulkImportService.get(schoolId, actorId, String(req.params.importId));
            if (job.entity !== entity)
                throw { statusCode: 404, message: "Import not found." };
            sendSuccess(res, { base64: (await BulkImportService.errorReport(schoolId, actorId, String(req.params.importId))).toString("base64"), filename: `acadivo-${entity}-import-errors.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, "Error report ready.");
        }
        catch (e) {
            next(e);
        } },
    };
}
