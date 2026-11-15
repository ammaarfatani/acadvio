import mongoose from "mongoose";
import { School } from "../models/school.model";
import { Branch } from "../models/branch.model";
import { withoutBranchScope } from "../utils/branchScope";
import { ClassModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
// Additive and restart-safe. One write per collection; no school/student records are deleted.
export async function migrateBranchScopes() {
  return withoutBranchScope(async () => {
    const schools = await School.find({}).select("name address phone email").lean();
    if (schools.length) {
      const existingMainBranches = await Branch.find({ isMain: true }).select("organizationId").lean();
      const existingMainOrgIds = new Set(existingMainBranches.map((b: any) => String(b.organizationId)));
      const schoolsNeedingMain = schools.filter((s: any) => !existingMainOrgIds.has(String(s._id)));
      if (schoolsNeedingMain.length) {
        await Branch.bulkWrite(
          schoolsNeedingMain.map((school: any) => ({
            updateOne: {
              filter: { organizationId: school._id, isMain: true },
              update: {
                $setOnInsert: {
                  _id: school._id,
                  organizationId: school._id,
                  isMain: true,
                  name: school.name,
                  code: "main",
                  address: school.address,
                  phone: school.phone,
                  email: school.email,
                  status: "ACTIVE",
                },
              },
              upsert: true,
            },
          }))
        );
      }
    }
    const schoolIds = schools.map((s:any)=>s._id);
    const seen = new Set<string>(); const tasks: Promise<any>[] = [];
    for (const model of Object.values(mongoose.models)) {
      if (!model.schema.path("branchId") || !model.schema.path("schoolId") || seen.has(model.collection.name)) continue;
      seen.add(model.collection.name);
      tasks.push(model.collection.updateMany({schoolId:{$in:schoolIds},$or:[{organizationId:{$exists:false}},{branchId:{$exists:false}}]},[{$set:{organizationId:{$cond:[{$eq:[{$type:"$organizationId"},"missing"]},"$schoolId","$organizationId"]},branchId:{$cond:[{$eq:[{$type:"$branchId"},"missing"]},"$schoolId","$branchId"]}}}]));
      if (tasks.length===6) { await Promise.all(tasks); tasks.length=0; }
    }
    await Promise.all(tasks);
    for (const model of [ClassModel, AcademicSession]) {
      const indexes = await model.collection.indexes();
      await model.collection.createIndex({schoolId:1,branchId:1,name:1},{unique:true});
      const old = indexes.find((index:any)=>Object.keys(index.key).length===2&&index.key.schoolId===1&&index.key.name===1&&index.unique);
      if(old)await model.collection.dropIndex(old.name!);
    }
  });
}
