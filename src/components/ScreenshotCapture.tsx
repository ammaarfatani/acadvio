"use client";
const sizes:Record<string,[number,number]>={"teacher-full.jpg":[1272,1432],"receptionist.jpg":[1280,450]};
export function ScreenshotCapture({image,label,priority=false}:{image:string;label:string;priority?:boolean}){
 const [width,height]=sizes[image]||[1280,800];
 const mask=["examination.jpg","finance.jpg","receptionist.jpg"].includes(image);
 const picture=(eager:boolean)=><div className="m-shot-wrap"><img src={`/product-showcase/${image}`} alt={`Actual Acadivo ${label} portal capture`} width={width} height={height} loading={eager?"eager":"lazy"} className="m-product-image"/>{mask&&<span aria-hidden="true" className="m-capture-mask" style={{top:`${18/height*100}%`,height:`${20/height*100}%`}}/>}</div>;
 return <div className="m-screenshot">{picture(priority)}</div>;
}
