const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const mongoose=require('mongoose');let attempts=0;const original=mongoose.connect;
mongoose.connect=async()=>{attempts++;throw Error('driver-error-containing-private-fixture-credentials')};
const {connectDB}=require('../src/server/config/db.ts');
(async()=>{try{await assert.rejects(()=>connectDB(),e=>e.message==='Configured database connection unavailable.');assert.equal(attempts,1,'no automatic connection to another database');console.log('PASS: 2 database fail-closed and error-redaction checks. No database connection used.')}finally{mongoose.connect=original}})().catch(e=>{console.error(e);process.exitCode=1});
