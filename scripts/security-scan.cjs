const fs=require('fs'),path=require('path'),cp=require('child_process'),dotenv=require('dotenv');
const root=process.cwd(),findings=[];
const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['provider-secret',/\b(?:sk-proj-|sk-live-|sk-ant-|ghp_)[A-Za-z0-9_-]{20,}/g],['cloud-access-key',/\bAKIA[A-Z0-9]{16}\b/g],['database-credentials',/mongodb(?:\+srv)?:\/\/[^\s"']+:[^\s"']+@/g],['public-secret-env',/process\.env\.NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|PASSWORD|TOKEN|API_KEY)/g]];
const config=fs.existsSync('.env')?dotenv.parse(fs.readFileSync('.env')):{};
const privateValues=Object.entries(config).filter(([key,v])=>!key.startsWith('NEXT_PUBLIC_')&&/(SECRET|PASS|PRIVATE|TOKEN|API_KEY|MONGODB_URI)/.test(key)&&v.length>=16);
let files=0;
function scan(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())scan(p);else if(/\.(?:ts|tsx|js|cjs|mjs|json|txt|html|map|md)$/.test(p)){const text=fs.readFileSync(p,'utf8');files++;for(const [category,pattern]of patterns){pattern.lastIndex=0;if(pattern.test(text))findings.push({file:p,category});}if(dir.startsWith('public')||dir.startsWith(path.join('.next','static')))for(const [key,value]of privateValues)if(text.includes(value))findings.push({file:p,category:'configured-secret-in-public-output',key});}}}
for(const dir of ['src','public',path.join('.next','static')])scan(dir);
const tracked=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0');for(const p of tracked)if(/(^|\/)\.env($|\.)/.test(p)&&!p.endsWith('.env.example'))findings.push({file:p,category:'tracked-private-environment'});
const output={filesScanned:files,scopes:['src','public','.next/static when present'],findings};console.log(JSON.stringify(output,null,2));if(findings.length)process.exitCode=1;
