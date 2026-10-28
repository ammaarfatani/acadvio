import {existsSync,readFileSync} from "node:fs";
import path from "node:path";
import "../config/env";
import nodemailer from "nodemailer";
import {renderTransactionalEmail,TransactionalEmail} from "./emailTemplate";
export const sendEmailNotification=async(options:TransactionalEmail&{to:string;replyTo?:string}):Promise<boolean>=>{
 const {SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_PASS,FROM_EMAIL}=process.env;
 const port=Number(SMTP_PORT);
 if(!SMTP_HOST?.trim()||!SMTP_USER?.trim()||!SMTP_PASS?.trim()||!FROM_EMAIL?.trim()||!Number.isInteger(port)||port<=0){console.error("[EMAIL] SMTP configuration incomplete.");return false;}
 try{
   if(process.env.NODE_ENV==="production"&&options.actionUrl){const url=new URL(options.actionUrl);if(url.protocol!=="https:"||["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Unsafe production email URL");}
   const logo=path.resolve(process.cwd(),"public/logo.png"),hasLogo=existsSync(logo);
   const rendered=renderTransactionalEmail({...options,logoCid:hasLogo?"acadivo-logo":undefined});
   const transporter=nodemailer.createTransport({host:SMTP_HOST,port,secure:port===465,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,auth:{user:SMTP_USER,pass:SMTP_PASS}});
   const result=await transporter.sendMail({from:{name:"Acadivo",address:FROM_EMAIL.trim()},to:options.to,replyTo:options.replyTo,subject:options.subject,text:rendered.text,html:options.html||rendered.html,...(hasLogo?{attachments:[{filename:"acadivo-logo.png",content:readFileSync(logo),cid:"acadivo-logo"}]}:{})});
   if(!result.accepted?.length)return false;
   console.info("[EMAIL] Delivery accepted by SMTP provider.");return true;
 }catch{console.error("[EMAIL] Delivery unavailable. Account data remains saved.");return false;}
};
