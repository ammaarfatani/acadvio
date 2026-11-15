import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { bridgeContextFor, bridgeInput, executeBridgeTool } from "../services/aieBridge.service";
import { sendSuccess } from "../utils/response.util";
const router=Router();
router.use(authenticate);
router.get("/context",(req,res,next)=>{try {return sendSuccess(res,bridgeContextFor(req.user!));}catch(e){next(e);}});
router.post("/tools",async(req,res,next)=>{try {return sendSuccess(res,await executeBridgeTool(req.user!,bridgeInput.parse(req.body)));}catch(e){next(e);}});
export default router;
