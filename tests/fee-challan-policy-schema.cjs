const fs = require('fs'), ts = require('typescript'), assert = require('assert/strict');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { FeeStructure, FeeChallan } = require('../src/server/models/fee.model.ts');
let checks = 0;
const ok = value => { assert.equal(value, true); checks++; };
ok(FeeStructure.schema.path('lateFeeFinePolicy.model').instance === 'String');
ok(FeeStructure.schema.path('lateFeeFinePolicy.amount').instance === 'Number');
ok(FeeChallan.schema.path('lateFeeFinePolicy').instance === 'Embedded');
const policy = { model: 'ONE_TIME', type: 'FIXED', amount: 10, graceDays: 2, dailyRate: 0, maxFineCap: 0, stages: [] };
const challan = new FeeChallan({
  schoolId: '111111111111111111111111', challanNumber: 'CH-SCHEMA-CHECK', studentId: '222222222222222222222222',
  studentName: 'Fictional Student', rollNumber: 'TEST-1', classId: '333333333333333333333333', className: 'Test Class',
  month: '2026-11', dueDate: new Date('2026-11-10T00:00:00.000Z'), feeBreakdown: { tuitionFee: 100 },
  totalAmountPKR: 100, paidAmountPKR: 0, remainingAmountPKR: 100, lateFeeFinePolicy: policy,
});
(async () => {
  await challan.validate();
  ok(challan.lateFeeFinePolicy.model === 'ONE_TIME' && challan.lateFeeFinePolicy.amount === 10);
  const query = FeeChallan.findOneAndUpdate({ _id: '444444444444444444444444' }, { $setOnInsert: { lateFeeFinePolicy: policy } }, { upsert: true });
  query._castUpdate();
  ok(query.getUpdate().$setOnInsert.lateFeeFinePolicy.model === 'ONE_TIME');
  for (const [stored, expected] of [['ONE_TIME', 'ONE_TIME'], ['FIXED', 'ONE_TIME'], ['DISABLED', 'DISABLED'], ['NO_FINE', 'DISABLED']]) {
    const hydrated = FeeChallan.hydrate({
      schoolId: '111111111111111111111111', challanNumber: 'CH-LEGACY', studentId: '222222222222222222222222',
      studentName: 'Legacy Student', rollNumber: 'OLD-1', classId: '333333333333333333333333', className: 'Test Class',
      month: '2026-11', dueDate: new Date('2026-11-10T00:00:00.000Z'), feeBreakdown: { tuitionFee: 100 },
      totalAmountPKR: 100, paidAmountPKR: 0, remainingAmountPKR: 100, lateFeePolicyAmount: 10, lateFeeFinePolicy: stored,
    });
    ok(hydrated.lateFeeFinePolicy.model === expected);
  }
  for (const [stored, model] of [['ONE_TIME', 'ONE_TIME'], ['FIXED', 'ONE_TIME'], ['PERCENTAGE', 'ONE_TIME'], ['DISABLED', 'DISABLED'], ['STAGES', 'STAGES'], ['RECURRING', 'RECURRING']]) {
    const hydrated = FeeStructure.hydrate({
      schoolId: '111111111111111111111111', title: 'Legacy Structure', classScope: 'ALL',
      tuitionFee: 100, totalMonthlyFee: 100, lateFeeFineRate: stored === 'STAGES' || stored === 'RECURRING' ? 5 : 10,
      lateFeeFinePolicy: stored,
    });
    ok(hydrated.lateFeeFinePolicy.model === model);
  }
  console.log(`Fee policy schema checks passed: ${checks}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
