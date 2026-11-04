const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let token='expired',refreshes=0;
const context={exports:{},process:{env:{}},Headers,Blob,URL,Map,Promise,JSON,
 window:{dispatchEvent(){}},CustomEvent:class{},localStorage:{getItem:()=>token,setItem:(k,v)=>{token=v}},sessionStorage:{getItem:()=>null},
 fetch:async(url,options)=>{
  if(url.endsWith('/auth/refresh-token')){refreshes++;await new Promise(r=>setTimeout(r,15));return new Response(JSON.stringify({data:{accessToken:'fresh'}}),{headers:{'Content-Type':'application/json'}})}
  const auth=options.headers instanceof Headers?options.headers.get('Authorization'):options.headers.Authorization;
  if(auth==='Bearer expired')return new Response('{"message":"Expired"}',{status:401,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/binary'))return new Response('private-file',{headers:{'Content-Type':'application/pdf'}});
  return new Response('{"data":{"ok":true}}',{headers:{'Content-Type':'application/json'}});
 }};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
(async()=>{
 const results=await Promise.all([context.exports.apiFetch('/one'),context.exports.apiFetch('/two'),context.exports.privateFile('/binary')]);
 assert.equal(refreshes,1,'parallel JSON and binary reads share one refresh');assert.equal(token,'fresh');assert.equal(results[0].data.ok,true);assert.equal(results[1].data.ok,true);assert.equal(results[2].size,12);
 token='expired';refreshes=0;let locks=0;
 context.navigator={locks:{request:async(name,callback)=>{locks++;return callback()}}};
 await Promise.all([context.exports.apiFetch('/three'),context.exports.privateFile('/binary')]);
 assert.equal(locks,1);assert.equal(refreshes,1);assert.equal(token,'fresh');
 console.log('PASS: 8 parallel frontend session-refresh, Web Locks and private-file regression checks. No network or database used.');
})().catch(e=>{console.error(e);process.exitCode=1});
