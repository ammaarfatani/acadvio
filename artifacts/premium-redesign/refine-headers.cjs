const fs=require('fs'),path=require('path'),ts=require('typescript');
const roots=['school-admin','teacher','finance','exam-staff','receptionist','parent','super-admin'];
const files=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const n=path.join(p,e.name);if(e.isDirectory())walk(n);else if(e.name==='page.tsx')files.push(n);}}roots.forEach(r=>walk('src/app/'+r));
for(const f of ['StaffAdminWorkspace','StaffAttendanceWorkspace','ExamSchedulesWorkspace','WorkspaceNotifications'])files.push('src/components/'+f+'.tsx');
const report=[];
for(const file of files){let s=fs.readFileSync(file,'utf8');if(s.includes('<ModuleFrame>'))continue;const tree=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let heading;function visit(n){if(!heading&&ts.isJsxElement(n)&&n.openingElement.tagName.getText(tree)==='h1')heading=n;ts.forEachChild(n,visit);}visit(tree);if(!heading){report.push({file,status:'shared component or welcome'});continue;}
let selected=heading;let n=heading.parent;
while(n&&ts.isJsxElement(n)){
 const tag=n.openingElement.tagName.getText(tree);const attr=n.openingElement.attributes.getText(tree);
 const content=n.getText(tree);
 if(/id=|role="dialog"/.test(attr)||/<table|<form|<Table|<PayrollTable|<WorkspaceAnalytics|<MetricCard/.test(content)||content.length>9500)break;
 if(tag==='header'||(/className/.test(attr)&&/flex|border-b|workspace-hero/.test(attr))){selected=n;break;}
 n=n.parent;
}
// A plain heading remains compact; never wrap the page root or operational table/form.
const start=selected.getStart(tree),end=selected.end;
s=s.slice(0,start)+'<ModuleFrame>'+s.slice(start,end)+'</ModuleFrame>'+s.slice(end);
const directive=s.match(/^\s*["']use client["'];?/);const pos=directive?directive[0].length:0;
s=s.slice(0,pos)+'\nimport ModuleFrame from "@/components/ModuleFrame";\n'+s.slice(pos);
fs.writeFileSync(file,s,'utf8');report.push({file,status:'composed',element:selected.openingElement.tagName.getText(tree)});
}
fs.mkdirSync('artifacts/premium-refinement',{recursive:true});fs.writeFileSync('artifacts/premium-refinement/header-coverage.json',JSON.stringify(report,null,2));console.log('Composed headers:',report.filter(r=>r.status==='composed').length,'Shared/welcome pages:',report.filter(r=>r.status!=='composed').length);
