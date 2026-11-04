/* Start the isolated, loopback-only Enterprise demonstration API. */
const crypto=require('node:crypto');
process.env.NODE_ENV='development';
process.env.PORT='5019';
process.env.MONGODB_URI='mongodb://127.0.0.1:27019/acadivo_enterprise_demo?replicaSet=acadivoEnterpriseDemo';
process.env.NEXT_PUBLIC_API_URL='http://127.0.0.1:5019/api';
process.env.FRONTEND_URL='http://127.0.0.1:3019';
process.env.JWT_ACCESS_SECRET=crypto.randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET=crypto.randomBytes(48).toString('hex');
process.env.SMTP_HOST='127.0.0.1';process.env.SMTP_PORT='1';process.env.SMTP_USER='';process.env.SMTP_PASS='';process.env.FROM_EMAIL='demo@example.invalid';
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {connectDB}=require('../src/server/config/db.ts');const {createApp}=require('../src/server/app.ts');
(async()=>{try{await connectDB({maintenance:false});const school=await require('../src/server/models/school.model.ts').School.findOne({code:'bright-future-enterprise-demo',isDemo:true}).select('_id').lean();if(!school)throw Error('Expected demo school missing; refusing to start.');const server=createApp().listen(5019,'127.0.0.1',()=>console.log('Bright Future demo API ready at http://127.0.0.1:5019/api (loopback only; SMTP disabled).'));const stop=()=>server.close(()=>process.exit(0));process.on('SIGINT',stop);process.on('SIGTERM',stop);}catch(e){console.error('Demo API startup failed:',e.message);process.exit(1)}})();
