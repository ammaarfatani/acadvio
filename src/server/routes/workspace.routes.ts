import {Router} from "express";
import {z} from "zod";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import {authenticate} from "../middlewares/auth.middleware";
import {sendSuccess} from "../utils/response.util";
import {workspaceNotifications,markWorkspaceNotificationRead} from "../services/workspace.service";
import {assistantConfigured,answerWorkspaceQuestion} from "../services/assistant.service";
import {workspaceAnalytics} from "../services/workspaceAnalytics.service";
const router=Router();router.use(authenticate);
router.get("/analytics",async(req,res,next)=>{try{return sendSuccess(res,await workspaceAnalytics(req.user!));}catch(e){next(e);}});
router.get("/notifications",async(req,res,next)=>{try{return sendSuccess(res,await workspaceNotifications(req.user!));}catch(e){next(e);}});
router.patch("/notifications/:id/read",async(req,res,next)=>{try{if(!mongoose.isValidObjectId(req.params.id))throw {statusCode:400,message:"Invalid notification."};return sendSuccess(res,await markWorkspaceNotificationRead(req.user!,String(req.params.id)));}catch(e){next(e);}});
router.get("/assistant/status",(_req,res)=>sendSuccess(res,{available:assistantConfigured()}));
router.post("/assistant",rateLimit({windowMs:15*60000,max:20,keyGenerator:req=>req.user!.userId,standardHeaders:true,legacyHeaders:false,message:{message:"Too many assistant questions. Please try again later."}}),async(req,res,next)=>{try{const input=z.object({message:z.string().trim().min(3).max(1200)}).strict().safeParse(req.body);if(!input.success)throw {statusCode:400,message:"Enter a question between 3 and 1200 characters."};return sendSuccess(res,await answerWorkspaceQuestion(req.user!,input.data.message));}catch(e){next(e);}});
export default router;

