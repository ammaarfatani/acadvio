const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
Object.assign(process.env,{NODE_ENV:'test',JWT_ACCESS_SECRET:crypto.randomBytes(48).toString('hex'),JWT_REFRESH_SECRET:crypto.randomBytes(48).toString('hex')});
let delivered=0;require.cache[require.resolve('../src/server/utils/email.util.ts')]={exports:{sendEmailNotification:async()=>{delivered++;return true;}}};
const mongoose=require('mongoose'),express=require('express');let server;let checks=0;
(async()=>{try{
await mongoose.connect('mongodb://127.0.0.1:27018/acadivo_contact_test_'+crypto.randomBytes(6).toString('hex')+'?replicaSet=acadivoDemo',{serverSelectionTimeoutMS:5000});
const app=express();app.use(express.json());app.use('/public',require('../src/server/routes/public.routes.ts').default);app.use((e,req,res,next)=>res.status(e.statusCode||500).json({message:e.message}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port+'/public/contact';const body={requestId:crypto.randomUUID(),name:'Test Visitor',email:'fixture@example.invalid',topic:'Fixture inquiry',message:'Disposable HTTP and MongoDB integration test.'};const send=b=>fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
const responses=await Promise.all([send(body),send(body)]);assert(responses.some(r=>r.status===200));checks++;assert(responses.every(r=>[200,409].includes(r.status)));checks++;assert.equal(delivered,1);checks++;
assert.equal((await send(body)).status,200);checks++;assert.equal(delivered,1);checks++;
assert.equal((await send({...body,email:'invalid'})).status,400);checks++;
assert.equal((await send({...body,message:'Changed payload not an identical replay.'})).status,409);checks++;
assert.equal((await send({...body,requestId:crypto.randomUUID()})).status,429);checks++;
const {ContactInquiryRecord}=require('../src/server/models/contactInquiry.model.ts');assert.equal(await ContactInquiryRecord.countDocuments(),1);checks++;assert.equal((await ContactInquiryRecord.findOne()).status,'SENT');checks++;
console.log(`PASS: ${checks} real HTTP/local MongoDB validation, concurrent duplicate protection and persistence checks. SMTP mocked; production database untouched.`);
}finally{if(server)await new Promise(r=>server.close(r));if(mongoose.connection.readyState){if(!mongoose.connection.name.startsWith('acadivo_contact_test_'))throw Error('Cleanup guard');await mongoose.connection.dropDatabase();await mongoose.disconnect();}}})().catch(e=>{console.error(e.message);process.exitCode=1;});
