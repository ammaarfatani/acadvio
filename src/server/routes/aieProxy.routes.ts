import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
const router=Router();router.use(authenticate);
// Fixed upstream and explicit path/method allowlist: never proxy arbitrary URLs.
router.use(async(req,res,next)=>{
  try {
    const allowed=(req.method==="GET" && /^\/(capabilities|conversations(?:\/[a-f0-9-]{36})?|intelligence\/(overview|finance|academics|attendance|recommendations))$/.test(req.path)) || (req.method==="POST"&&/^\/(chat|actions\/(preview|confirm))$/.test(req.path)) || (req.method==="DELETE"&&/^\/conversations\/[a-f0-9-]{36}$/.test(req.path));
    if(!allowed)return res.status(404).json({success:false,message:"AIE endpoint not found."});
    if(!process.env.AIE_SERVICE_URL)return res.status(503).json({success:false,message:"Acadivo Intelligence Engine is not configured."});
    const base=new URL(process.env.AIE_SERVICE_URL);
    if(base.pathname!=="/"||base.username||base.password||base.search||base.hash||!["http:","https:"].includes(base.protocol))throw new Error("Invalid AIE URL");
    if(base.protocol!=="https:"&&!["localhost","127.0.0.1","host.docker.internal"].includes(base.hostname))throw new Error("Remote AIE requires HTTPS");
    const body=req.method==="POST"?JSON.stringify(req.body):undefined;
    if(body&&Buffer.byteLength(body)>8192)return res.status(413).json({success:false,message:"Request is too large."});
    const response=await fetch(base.toString().replace(/\/$/,"")+"/api/v1"+req.url,{method:req.method,redirect:"error",headers:{Authorization:req.get("Authorization")!,"Content-Type":"application/json",...(req.get("X-Acadivo-Branch")?{"X-Acadivo-Branch":req.get("X-Acadivo-Branch")!}:{})},...(body?{body}:{}),signal:AbortSignal.timeout(25000)});
    const data=await response.json().catch(()=>null);
    if(!data?.success)return res.status(response.status>=500?503:502).json({success:false,message:response.status===401?"Your Acadivo session has ended. Please sign in again.":response.status===403?"This feature is not available to your account or subscription.":"Acadivo Intelligence is temporarily unavailable."});
    return res.status(response.status).json(data);
  }catch {return res.status(503).json({success:false,message:"Acadivo Intelligence Engine is unavailable."});}
});
export default router;
