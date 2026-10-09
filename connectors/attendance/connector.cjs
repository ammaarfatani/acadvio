#!/usr/bin/env node
// Outbound-only connector. HTTP JSON adapter is a defined contract, not a claim of universal SDK support.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=(process.env.ACADIVO_API_URL||'').replace(/\/$/,''),device=process.env.ACADIVO_DEVICE_ID,token=process.env.ACADIVO_DEVICE_TOKEN;
const url=new URL(base);if(url.protocol!=='https:'&&!(process.env.ACADIVO_ALLOW_LOCAL_HTTP==='true'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('HTTPS cloud URL required.');
if(!/^[a-f0-9]{24}$/i.test(device||'')||!token)throw Error('Device ID/token required.');
const directory=path.resolve(process.env.ACADIVO_QUEUE_DIR||path.join(__dirname,'data'));fs.mkdirSync(directory,{recursive:true,mode:0o700});
const statePath=path.join(directory,'queue.json'),lockPath=path.join(directory,'connector.lock');
try{fs.writeFileSync(lockPath,String(process.pid),{flag:'wx',mode:0o600});}catch(e){const old=Number(fs.readFileSync(lockPath,'utf8'));try{process.kill(old,0);throw Error('Connector is already running.');}catch(err){if(err.code!=='ESRCH')throw err;}fs.unlinkSync(lockPath);fs.writeFileSync(lockPath,String(process.pid),{flag:'wx',mode:0o600});}
let state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{queue:[],cursor:null};let stopped=false;
function persist(){const tmp=statePath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});fs.renameSync(tmp,statePath);}
function status(error='',connected=false){fs.writeFileSync(path.join(directory,'status.json'),JSON.stringify({at:new Date(),deviceConnected:connected,pendingQueue:state.queue.length,lastSync:state.lastSync||null,lastError:error},null,2),{mode:0o600});}
async function cloud(endpoint,body){const res=await fetch(base+'/workforce/biometric/'+device+'/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('Cloud HTTP '+res.status);const result=await res.json();return result.data;}
const adapters={
 async HTTP_JSON(config,cursor){if(!config?.host||/[\/@?#]/.test(config.host))throw Error('Invalid adapter host.');const local=new URL('http://'+config.host+':'+config.port+config.transactionPath);if(cursor)local.searchParams.set('cursor',cursor);const res=await fetch(local,{headers:config.credentials?{Authorization:'Basic '+Buffer.from((config.username||'')+':'+config.credentials).toString('base64')}:{},signal:AbortSignal.timeout(15000),redirect:'error'});if(!res.ok)throw Error('Device HTTP '+res.status);const data=await res.json();if(!Array.isArray(data.events)||data.events.length>5000)throw Error('Adapter requires events array (maximum 5000).');return data;}
};
function seal(config){const key=crypto.createHash('sha256').update(token).digest(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(config)),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64')).join('.');}
function unseal(value){try{const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64'));const cipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(token).digest(),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString());}catch{return null;}}
async function cycle(){let connected=false,error='',completed,config=state.configuration?unseal(state.configuration):null;
 try{const info=await cloud('heartbeat',{pendingQueue:state.queue.length,deviceConnected:false});if(info.configuration){config=info.configuration;state.configuration=seal(config);persist();}completed=info.commandId;}catch{error='Cloud unreachable; local adapter remains active and uploads will retry.';}
 try{if(config){const result=await adapters.HTTP_JSON(config,state.cursor);for(const event of result.events){if(typeof event.eventId!=='string'||typeof event.biometricUserId!=='string'||!event.timestamp||!/(Z|[+-]\d{2}:\d{2})$/.test(event.timestamp)||Number.isNaN(Date.parse(event.timestamp)))throw Error('Invalid adapter transaction.');if(!state.queue.some(x=>x.eventId===event.eventId))state.queue.push(event);}if(result.cursor!==undefined)state.cursor=result.cursor;persist();connected=true;}}
 catch{error='Device connection/adapter failed; retry scheduled.';}
 try{while(state.queue.length){const batch=state.queue.slice(0,100);const result=await cloud('transactions',{events:batch});if(!result.stored)throw Error('Cloud did not confirm storage.');state.queue.splice(0,batch.length);state.lastSync=new Date().toISOString();persist();}await cloud('heartbeat',{pendingQueue:state.queue.length,deviceConnected:connected,...(completed&&connected?{commandCompletedId:completed}:{}),...(error?{error}:{})});}
 catch{error='Cloud upload failed; durable queue retained for retry.';}
 status(error,connected);if(!stopped)setTimeout(cycle,Math.max(250,Number(process.env.ACADIVO_POLL_MS||30000)));}

function stop(){stopped=true;persist();try{fs.unlinkSync(lockPath);}catch{}process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);cycle();
