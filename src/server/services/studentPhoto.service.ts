import mongoose from "mongoose";
import sharp from "sharp";
import { decodePaymentImage } from "./paymentImage";
export function photoLimit(){const value=Number(process.env.STUDENT_PHOTO_MAX_BYTES||5242880);return Number.isInteger(value)&&value>0?Math.min(value,5242880):5242880;}
const bucket=()=>new mongoose.mongo.GridFSBucket(mongoose.connection.db!,{bucketName:"studentPhotos"});
export async function validateStudentPhoto(value:unknown){
 if(value===undefined||value===null||value==="")return null;
 let input:ReturnType<typeof decodePaymentImage>;
 try{input=decodePaymentImage(value,photoLimit());}catch{throw {statusCode:400,message:`Upload a valid JPEG, PNG or WebP student photo up to ${Math.round(photoLimit()/1048576*10)/10} MB.`};}
 try{const image=sharp(input.bytes,{limitInputPixels:16000000,failOn:"warning"});const meta=await image.metadata();if(!["jpeg","png","webp"].includes(meta.format||"")||(meta.pages||1)>1)throw Error();return await image.rotate().resize({width:800,height:800,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();}
 catch{throw {statusCode:400,message:"Choose a valid, non-animated JPEG, PNG or WebP photo (maximum 16 megapixels)."};}
}
export async function storeStudentPhoto(student:any,bytes:Buffer){const upload=bucket().openUploadStream(`student-${new mongoose.Types.ObjectId()}.webp`,{metadata:{schoolId:String(student.schoolId),studentId:String(student._id),branchId:String(student.branchId||student.schoolId),mime:"image/webp"}});await new Promise<void>((resolve,reject)=>{upload.on("finish",resolve);upload.on("error",reject);upload.end(bytes);});return String(upload.id);}
export async function deleteStudentPhoto(id?:string){if(id&&!(await mongoose.connection.db!.collection("certificaterecords").findOne({"documentSnapshot.photoStorageId":id},{projection:{_id:1}}))&&!(await mongoose.connection.db!.collection("issuedschooldocuments").findOne({"snapshot.photoStorageId":id},{projection:{_id:1}})))await bucket().delete(new mongoose.Types.ObjectId(id));}
export async function readStudentPhoto(student:any){if(!student.photoStorageId)throw {statusCode:404,message:"Student photo not found."};const id=new mongoose.Types.ObjectId(student.photoStorageId);const files=await bucket().find({_id:id,"metadata.schoolId":String(student.schoolId),"metadata.studentId":String(student._id)}).toArray();if(!files.length)throw {statusCode:404,message:"Student photo not found."};const chunks:Buffer[]=[];for await(const chunk of bucket().openDownloadStream(id))chunks.push(Buffer.from(chunk));return "data:image/webp;base64,"+Buffer.concat(chunks).toString("base64");}
