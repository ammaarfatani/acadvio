const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const routes={'/':'artifacts/print-regression/nine-subjects.html','/qa.css':'artifacts/print-regression/qa.css','/documents.css':'src/app/documents.css'};
 const file=routes[url.pathname] || (/^\/fonts\/[\w.-]+\.ttf$/.test(url.pathname)?'public'+url.pathname:null);
 if(!file||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
}).listen(3099,'127.0.0.1',()=>console.log('Local static marksheet QA fixture: http://127.0.0.1:3099. No database or authentication changes.'));
