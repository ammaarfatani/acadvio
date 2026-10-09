// Exercise the real form submit handler without submitting a test school to production.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('node:module');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const resolve=Module._resolveFilename;Module._resolveFilename=function(request,...rest){return resolve.call(this,request.startsWith('@/')?path.join(process.cwd(),'src',request.slice(2)):request,...rest);};
const React=require('react'),navigation=require('next/navigation'),api=require('../src/lib/api.ts').authApi;
let states=[],refs=[],stateIndex=0,refIndex=0,registrations=0,logins=0,callbacks=0,payload;
React.useState=initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];};
React.useRef=value=>{const i=refIndex++;return refs[i]??=( {current:value} );};React.useEffect=()=>{};
const load=Module._load;Module._load=function(request,...rest){return request==='next/navigation'?{useSearchParams:()=>new URLSearchParams()}:load.call(this,request,...rest);};
api.registerSchool=async data=>{registrations++;payload=data;await new Promise(r=>setTimeout(r,5));return {data:{status:'PENDING_APPROVAL'}};};api.login=async()=>{logins++;return {};};
const {FreeTrialForm}=require('../src/components/FreeTrialForm.tsx');
function render(props={}){stateIndex=0;refIndex=0;return FreeTrialForm(props);}
function find(element,type){if(!element||typeof element!=='object')return null;if(element.type===type)return element;for(const child of React.Children.toArray(element.props?.children)){const result=find(child,type);if(result)return result;}return null;}
function text(element){if(typeof element==='string')return element;if(!element||typeof element!=='object')return '';return React.Children.toArray(element.props?.children).map(text).join(' ');}
function ready(){states=[];refs=[];render();states[0]={schoolName:'Isolated school',schoolEmail:'school@example.invalid',schoolPhone:'03001234567',schoolAddress:'Verification address',adminName:'Verification admin',adminEmail:'admin@example.invalid',password:'VerificationPassword',studentCount:'1-200',teacherCount:'1',selectedPlan:'starter'};}
(async()=>{
 ready();const form=find(render({onRegistered:async()=>{callbacks++;}}),'form');await Promise.all([form.props.onSubmit({preventDefault(){}}),form.props.onSubmit({preventDefault(){}})]);
 assert.equal(registrations,1);assert.equal(logins,0);assert.equal(callbacks,0);assert.equal(payload.registrationType,'trial');assert.equal(states[0].password,'');const confirmation=render();assert.equal(find(confirmation,'form'),null);assert(text(confirmation).includes('Your school registration has been submitted.'));assert(text(confirmation).includes('Your free trial request is currently under review. You will receive an email once your school has been approved.'));assert(text(confirmation).includes('Please check your email for further updates.'));
 ready();await find(render({checkout:true,selectedPlan:'STARTER',onRegistered:async()=>{callbacks++;}}),'form').props.onSubmit({preventDefault(){}});assert.equal(logins,1);assert.equal(callbacks,1);assert.equal(payload.registrationType,'paid');assert.equal(payload.selectedPlan,'STARTER');
 console.log('PASS: actual trial form submits once, shows exact confirmation copy, clears password and never logs in/redirects; paid checkout login/callback preserved');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
