import { Router } from "express";
import { PublicController } from "../controllers/public.controller";
import { validate } from "../middlewares/validate.middleware";
import { RegisterSchoolSchema } from "../validators/public.validator";
import rateLimit from "express-rate-limit";
import {submitContact,contactSchema} from "../services/contactInquiry.service";

const router = Router();

router.get("/health", PublicController.healthCheck);
router.post("/contact",rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,message:{message:"Too many inquiries. Please try again later."}}),async(req,res,next)=>{
 const parsed=contactSchema.safeParse(req.body);
 if(!parsed.success){res.status(400).json({message:"Please provide your name, valid email, subject and a message of 10–4,000 characters."});return;}
 try{await submitContact(parsed.data);res.json({message:"Your inquiry has been sent successfully. Our team will get back to you."});}catch(error){next(error);}
});
router.post("/register-school", validate(RegisterSchoolSchema), PublicController.registerSchool);

export default router;
