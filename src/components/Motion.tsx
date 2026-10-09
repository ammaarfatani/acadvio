"use client";
import {useEffect,useRef,useState, type ReactNode} from "react";
import {usePathname} from "next/navigation";

/** Exit content is inert immediately; only its pixels remain for the short fade. */
export function Presence({show,children,kind="panel"}:{show:boolean;children:ReactNode;kind?:string}) {
  const [retained,setRetained]=useState(show);
  const host=useRef<HTMLDivElement>(null);
  const focusOrigin=useRef<HTMLElement|null>(null);
  const lastContent=useRef(children);
  if(show)lastContent.current=children;
  useEffect(()=>{
    const capture=(event:FocusEvent)=>{const target=event.target;if(target instanceof HTMLElement&&!host.current?.contains(target))focusOrigin.current=target;};
    if(document.activeElement instanceof HTMLElement&&!host.current?.contains(document.activeElement))focusOrigin.current=document.activeElement;
    document.addEventListener("focusin",capture);
    return()=>document.removeEventListener("focusin",capture);
  },[]);
  useEffect(()=>{
    if(show){setRetained(true);return;}
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setRetained(false);return;}
    const timer=window.setTimeout(()=>setRetained(false),220);
    return()=>window.clearTimeout(timer);
  },[show]);
  useEffect(()=>{if(!show&&host.current?.contains(document.activeElement)&&focusOrigin.current?.isConnected)focusOrigin.current.focus();if(host.current)host.current.inert=!show;},[show,retained]);
  if(!show&&!retained)return null;
  return <div ref={host} className="motion-presence" data-motion={kind} data-state={show?"open":"closed"} aria-hidden={!show || undefined}>{show?children:lastContent.current}</div>;
}

/** Animates the current tree without retaining stale pages or remounting their state. */
export function RouteMotion({children}:{children:ReactNode}) {
  const pathname=usePathname();
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const animation=ref.current?.animate([{opacity:.45,transform:"translateY(6px)"},{opacity:1,transform:"translateY(0)"}],{duration:220,easing:"cubic-bezier(.2,.7,.2,1)"});
    return()=>animation?.cancel();
  },[pathname]);
  return <div ref={ref} className="motion-route">{children}</div>;
}
export function TypingDots(){return <span className="motion-typing" aria-hidden="true"><i/><i/><i/></span>;}
