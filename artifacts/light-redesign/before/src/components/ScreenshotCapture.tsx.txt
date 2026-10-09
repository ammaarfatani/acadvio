"use client";
import {useRef} from "react";
import {ArrowUpRight,X} from "lucide-react";
const sizes:Record<string,[number,number]>={"teacher-full.jpg":[1272,1432],"receptionist.jpg":[1280,450]};
export function ScreenshotCapture({image,label,priority=false}:{image:string;label:string;priority?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [width,height]=sizes[image]||[1280,800];
 const mask=["examination.jpg","finance.jpg","receptionist.jpg"].includes(image);
 const picture=(eager:boolean)=><div className="m-shot-wrap"><img src={`/product-showcase/${image}`} alt={`Actual Acadivo ${label} portal capture`} width={width} height={height} loading={eager?"eager":"lazy"} className="m-product-image"/>{mask&&<span aria-hidden="true" className="m-capture-mask" style={{top:`${18/height*100}%`,height:`${20/height*100}%`}}/>}</div>;
 return <div className="m-screenshot">{picture(priority)}<button type="button" className="m-capture-open" aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>View full capture <ArrowUpRight size={13}/></button><dialog ref={dialog} className="m-capture-dialog" aria-label={`${label} full screenshot`} onClick={event=>{if(event.target===dialog.current)dialog.current.close();}}><div className="m-capture-dialog-header"><p>Acadivo / {label} · Real product capture</p><button type="button" aria-label="Close screenshot" onClick={()=>dialog.current?.close()}><X size={20}/></button></div>{picture(true)}<p className="m-capture-dialog-note">Captured school records. Account headers are masked where needed in this preview.</p></dialog></div>;
}
