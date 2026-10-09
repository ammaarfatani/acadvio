const fs=require('fs'),ts=require('typescript');
for(const [file,tag,title,desc] of [['src/app/school-admin/students/page.tsx','div','Students & admissions','Student profiles, guardian contacts, enrollment and admission records.'],['src/app/school-admin/teachers/page.tsx','header','Teachers & assigned classes','Teacher accounts, contact information and class responsibilities.']]){
 let s=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,s,99,true,ts.ScriptKind.TSX),target;
 function visit(n){if(target)return;if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(sf)===tag){const a=n.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text==='className');if(a?.initializer&&ts.isStringLiteral(a.initializer)&&a.initializer.text.includes('border-b')&&n.children.some(x=>ts.isJsxElement(x)&&x.getText(sf).includes('<h1'))){target=n;return;}}ts.forEachChild(n,visit);}visit(sf);if(!target)throw Error(file+' header missing');
 const action=target.children.filter(ts.isJsxElement).at(-1).getText(sf);
 s=s.slice(0,target.getStart(sf))+`<PageHeading eyebrow="School directory" title="${title}" description="${desc}" actions={${action}}/>`+s.slice(target.end);
 s=s.replace('"use client";','"use client";\nimport {PageHeading} from "@/components/ProductUI";');
 const toolbar= file.includes('students')?'bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4':'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs';
 s=s.replace('className="'+toolbar+'"','className="ui-data-toolbar '+toolbar+'"');
 if(file.includes('students'))s=s.replace('className="flex items-center gap-2 w-full sm:w-auto"','className="flex flex-wrap items-center gap-2 w-full sm:w-auto"');
 fs.writeFileSync(file,s);
}
console.log('Student/teacher headings and directory toolbars rebuilt; action JSX retained.');