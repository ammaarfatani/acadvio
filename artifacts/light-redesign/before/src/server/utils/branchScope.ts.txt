import { AsyncLocalStorage } from "node:async_hooks";
import mongoose, { Schema, Types } from "mongoose";

export type BranchScope = { organizationId: string; branchId: string | null; mainBranchId: string; owner: boolean; userId?: string; userType?: string; plan?: string; noticeManagement?: boolean; referenceCache?: Map<string, Set<string>> };
export const branchContext = new AsyncLocalStorage<BranchScope>();
export function withoutBranchScope<T>(work: () => T): T { return branchContext.exit(work); }
export function scopeFilter(context: BranchScope, shared = false) {
  const filter: any = { schoolId: new Types.ObjectId(context.organizationId), $and: [{ $or: [{ organizationId: new Types.ObjectId(context.organizationId) }, { organizationId: { $exists: false } }] }] };
  if (context.branchId) filter.$or = [
    { branchId: new Types.ObjectId(context.branchId) },
    ...(context.branchId === context.mainBranchId ? [{ branchId: { $exists: false } }] : []),
    ...(shared ? [{ branchId: null }] : []),
  ];
  return filter;
}
// Applied explicitly before model compilation: it covers queries, aggregates and writes.
export function branchScoped(schema: Schema, options: { shared?: boolean } = {}) {
  schema.add({ organizationId: { type: Schema.Types.ObjectId, ref: "School", index: true }, branchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true } });
  schema.index({ schoolId: 1, branchId: 1, createdAt: -1 });
  function stamp(doc: any) {
    const context = branchContext.getStore(); if (!context) { if (doc.schoolId) { if (!doc.organizationId) doc.organizationId = doc.schoolId; if (doc.branchId === undefined) doc.branchId = doc.schoolId; } return; }
    if (doc.schoolId && String(doc.schoolId) !== context.organizationId) throw { statusCode: 403, message: "Record belongs to another organization." };
    if (!context.branchId && !options.shared) throw { statusCode: 400, message: "Choose a branch before creating records." };
    if (context.branchId && doc.branchId != null && String(doc.branchId) !== context.branchId) throw { statusCode: 403, message: "Record belongs to another branch." };
    doc.schoolId = context.organizationId; doc.organizationId = context.organizationId;
    if (doc.branchId === undefined || doc.branchId === null && !(options.shared && context.owner)) doc.branchId = context.branchId;
  }
  async function validateReferences(data: any, currentSchema = schema, session?: any) {
    const context = branchContext.getStore(); if (!context || !data) return;
    const tasks: Promise<any>[] = [];
    currentSchema.eachPath((key, path: any) => {
      if (["schoolId", "organizationId", "branchId"].includes(key)) return;
      const value = typeof data.get === "function" ? data.get(key) : data[key];
      if (value == null) return;
      if (path.schema) { for (const row of Array.isArray(value) ? value : [value]) tasks.push(validateReferences(row, path.schema, session)); return; }
      const ref = path.options?.ref || path.caster?.options?.ref;
      const model = ref && mongoose.models[ref];
      if (!model?.schema.path("branchId")) return;
      if (ref === "User" && String(value?._id || value) === context.userId) return;
      const ids = [...new Set((Array.isArray(value) ? value : [value]).map((v: any) => String(v?._id || v)))];
      const cacheable = ["Class", "ClassModel", "Section", "SectionModel", "AcademicSession", "Subject"].includes(ref);
      context.referenceCache ||= new Map();
      const cacheKey = String(context.branchId)+":"+ref;
      const cached = context.referenceCache.get(cacheKey) || new Set<string>();
      if (cacheable && ids.every(id => cached.has(id))) return;
      tasks.push(model.countDocuments({ _id: { $in: ids } }).session(session || null).then((count: number) => { if (count !== ids.length) throw { statusCode: 403, message: `Invalid or unauthorized ${key} reference.` }; if (cacheable) { ids.forEach(id => cached.add(id)); context.referenceCache!.set(cacheKey, cached); } }));
    });
    await Promise.all(tasks);
  }
  schema.pre("validate", async function () { stamp(this); await validateReferences(this, schema, this.$session()); });
  schema.pre("insertMany", function (next: any, docs: any[], options: any) { try { docs.forEach(stamp); Promise.all(docs.map(doc => validateReferences(doc, schema, options?.session))).then(() => next(), next); } catch (error) { next(error); } });
  for (const op of ["find", "findOne", "countDocuments", "distinct", "updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "findOneAndReplace", "replaceOne"] as const) {
    (schema as any).pre(op, async function (this: any) {
      const context = branchContext.getStore(); if (!context) return;
      const writing = /update|delete|replace/i.test(op);
      if (writing && !context.branchId && !options.shared) throw { statusCode: 400, message: "Choose a branch before modifying records." };
      const original = { ...this.getFilter() };
      if (writing && this.getOptions().upsert && original.schoolId !== undefined) {
        if (String(original.schoolId) !== context.organizationId) throw { statusCode: 403, message: "Invalid organization for upsert." };
        delete original.schoolId;
      }
      this.setQuery({ $and: [original, scopeFilter(context, !!options.shared)] });
      if (writing) {
        const update = this.getUpdate();
        if (Array.isArray(update)) throw { statusCode: 400, message: "Pipeline updates are not permitted in a branch workspace." };
        for (const fields of [update, update?.$set, update?.$unset, update?.$setOnInsert]) if (fields) for (const field of ["schoolId", "organizationId", "branchId"]) {
          if (field in fields && (field === "branchId" ? String(fields[field]) !== String(context.branchId) : String(fields[field]) !== context.organizationId)) throw { statusCode: 403, message: "Record scope cannot be reassigned." };
        }
        await validateReferences(update?.$set || update, schema, this.getOptions().session);
        await validateReferences(update?.$setOnInsert, schema, this.getOptions().session);
        for (const operator of ["$push", "$addToSet"]) if (update?.[operator]) {
          const refs = Object.fromEntries(Object.entries(update[operator]).map(([key,value]:any)=>[key,value?.$each || value]));
          await validateReferences(refs, schema, this.getOptions().session);
        }
        if (update?.$rename) throw {statusCode:400,message:"Scope-changing rename updates are not allowed."};
        if (this.getOptions().upsert) {
          const scope: any = { schoolId: context.organizationId, organizationId: context.organizationId, branchId: context.branchId };
          for (const field of Object.keys(update?.$set || {})) delete scope[field];
          this.setUpdate({ ...update, $setOnInsert: { ...update?.$setOnInsert, ...scope } });
        }
      }
    });
  }
  (schema as any).pre("bulkWrite", function (next: any) { next(branchContext.getStore() ? { statusCode: 400, message: "Use scoped model writes inside a branch workspace." } : undefined); });
  schema.pre("aggregate", function () { const context = branchContext.getStore(); if (context) this.pipeline().unshift({ $match: scopeFilter(context, !!options.shared) }); });
}
