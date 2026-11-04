"use client";
import {ReactNode,useEffect,useRef,useState} from "react";

/** Keeps the semantic table intact; only its viewport scrolls. */
export function TableScroll({children,label="Records table"}:{children:ReactNode;label?:string}){
 const ref=useRef<HTMLDivElement>(null),[overflow,setOverflow]=useState(false);
 useEffect(()=>{const node=ref.current;if(!node)return;const measure=()=>setOverflow(node.scrollWidth>node.clientWidth+1);const observer=new ResizeObserver(measure);observer.observe(node);for(const child of Array.from(node.children))observer.observe(child);measure();return()=>observer.disconnect()},[]);
 return <div className="ui-record-frame"><div ref={ref} className="ui-record-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>{overflow&&<p className="ui-record-hint no-print">Scroll horizontally to view all columns. Keyboard: focus the table and use the arrow keys.</p>}</div>;
}
