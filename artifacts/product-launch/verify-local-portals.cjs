const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname,accounts=JSON.parse(fs.readFileSync(path.join(root,'private/portal-accounts.private.json'),'utf8')),seed=JSON.parse(fs.readFileSync(path.join(root,'private/demo-credentials.private.json'),'utf8'));
accounts.TEACHER=seed.accounts.teacher0;accounts.PARENT=seed.accounts.parent0;
const paths={SUPER_ADMIN:'/super-admin/analytics',SCHOOL_ADMIN:'/school-admin/dashboard',TEACHER:'/teacher/dashboard',FINANCE:'/finance/dashboard',EXAM_STAFF:'/exams/dashboard',RECEPTIONIST:'/receptionist/dashboard',PARENT:'/parent/children'};
(async()=>{const results=[];for(const [role,p] of Object.entries(paths)){
 const account=accounts[role];assert(account,'Missing local account '+role);
 const r=await fetch('http://127.0.0.1:5005/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});const body=await r.json();
 if(r.status!==200){results.push({role,login:r.status,message:body.message});continue;}
 const page=await fetch('http://127.0.0.1:5005/api'+p,{headers:{Authorization:'Bearer '+body.data.accessToken}});results.push({role,login:r.status,endpoint:p,status:page.status});await page.arrayBuffer();
 }
 fs.writeFileSync(path.join(root,'portal-verification.json'),JSON.stringify({localOnly:true,recorded:false,results},null,2));for(const r of results)console.log(r.role+': login '+r.login+', data '+r.status);if(results.some(r=>r.login!==200||r.status!==200))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
