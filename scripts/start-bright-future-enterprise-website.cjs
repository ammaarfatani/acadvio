/* Start a separate Next dev build directory on loopback, away from port 3000. */
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),next=path.join(root,'node_modules','next','dist','bin','next');if(!fs.existsSync(next))throw Error('Next.js is not installed in this workspace.');
const env={...process.env,NEXT_BUILD_DIR:'.next-enterprise-demo',NEXT_PUBLIC_API_URL:'http://127.0.0.1:5019/api'};
const child=spawn(process.execPath,[next,'dev','--hostname','127.0.0.1','--port','3019'],{cwd:root,env,stdio:'inherit',windowsHide:true});child.on('exit',code=>process.exit(code??0));
