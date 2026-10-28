const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const pricing=require('../src/server/services/regionalPricing.service.ts');let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++};
const prices={PK:[2000,4000,8000],US:[29,59,119],GB:[24,49,99],IN:[2499,4999,9999]};
for(const [market,amounts]of Object.entries(prices))for(const [i,code]of ['STARTER','PROFESSIONAL','ENTERPRISE'].entries())for(const cycle of ['monthly','annual']){const p=pricing.regionalQuote({code,name:code,priceMonthlyPKR:prices.PK[i],priceAnnualPKR:1},cycle,market);eq(p.price,amounts[i]*(cycle==='annual'?10:1));eq(p.checkoutAvailable,market==='PK');eq(p.durationMonths,cycle==='annual'?12:1);if(market!=='PK')eq(p.originalMonthly,null);}
assert.throws(()=>pricing.marketSelection('XX'));checks++;for(const m of ['US','GB','IN']){assert.throws(()=>pricing.requirePayableMarket(m));checks++;}
const records=new Map();let calls=0,accept=true,mail;
const model={async create(d){if(records.has(d.requestId))throw {code:11000};const r={...d,_id:d.requestId,createdAt:new Date()};records.set(d.requestId,r);return r;},async findOne(q){return records.get(q.requestId);},async findOneAndUpdate(q,u){const r=records.get(q.requestId);if(r?.status!==q.status)return null;Object.assign(r,u.$set);return r;},async updateOne(q,u){Object.assign(records.get(q._id),u.$set);}};
require.cache[require.resolve('../src/server/models/contactInquiry.model.ts')]={exports:{ContactInquiryRecord:model}};
require.cache[require.resolve('../src/server/utils/email.util.ts')]={exports:{sendEmailNotification:async o=>{calls++;mail=o;return accept;}}};
const {submitContact,contactSchema}=require('../src/server/services/contactInquiry.service.ts');
(async()=>{const data={requestId:require('crypto').randomUUID(),name:'Test Visitor',email:'visitor@example.invalid',topic:'Pricing',school:'Fixture School',message:'This is a synthetic contact inquiry.'};
await submitContact(data);await submitContact(data);eq(calls,1);eq(mail.replyTo,data.email);assert(mail.text.includes(data.message)&&mail.text.includes('UTC'));checks++;
await assert.rejects(()=>submitContact({...data,message:'A changed message is not a replay.'}));checks++;
for(const invalid of [{...data,website:'spam'},{...data,name:'Name\r\nInjected'},{...data,email:'bad'},{...data,message:'short'}]){eq(contactSchema.safeParse(invalid).success,false);}
accept=false;const retry={...data,requestId:require('crypto').randomUUID()};await assert.rejects(()=>submitContact(retry));checks++;eq(records.get(retry.requestId).status,'FAILED');accept=true;await submitContact(retry);eq(records.get(retry.requestId).status,'SENT');
console.log(`PASS: ${checks} regional quote, annual billing, unsupported settlement, contact validation, duplicate and SMTP failure/retry checks. No database or real email was used.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
