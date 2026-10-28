const fs=require("fs"),ts=require("typescript"),assert=require("node:assert/strict");require.extensions[".ts"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {DEFAULT_SUBSCRIPTION_PRICES:prices,annualSavingPercent:save}=require("../src/lib/subscription-prices.ts"),{PLAN_FEATURE_LABELS}=require("../src/lib/plan-features.ts"),{TeacherAdminUpdateSchema}=require("../src/server/validators/domain.validator.ts"),{answerWebsiteQuestion}=require("../src/lib/website-guide.ts");let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++};
for(const [code,monthly]of Object.entries({STARTER:2000,PROFESSIONAL:4000,ENTERPRISE:8000})){eq(prices[code].monthly,monthly);eq(save(monthly,prices[code].annualMonthly),16);eq(prices[code].annualMonthly*12,monthly*10);eq(PLAN_FEATURE_LABELS[code].includes("Portal Guides & Onboarding Guidance"),true);}
for(const [a,b]of [[0,0],[100,100],[100,120],[NaN,20],[100,Infinity]])eq(save(a,b),0);
const update=TeacherAdminUpdateSchema.parse({name:"Teacher renamed"});eq(Object.hasOwn(update,"assignments"),false);eq(TeacherAdminUpdateSchema.parse({assignments:[]}).assignments.length,0);
const help=answerWebsiteQuestion("Do you provide portal-use guides and onboarding guidance?");eq(help.links.some(l=>l.href==="/guide"),true);eq(help.answer.includes("Every Acadivo plan"),true);
for(const question of ["Do you provide portal guides?","Portal-use guides","Guide me through onboarding"]){eq(answerWebsiteQuestion(question).links.some(l=>l.href==="/guide"),true);}
console.log(`PASS: ${checks} requested prices, real annual savings, guidance inclusion and partial-update compatibility checks.`);

