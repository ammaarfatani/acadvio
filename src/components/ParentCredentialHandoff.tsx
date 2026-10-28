"use client";
import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
export function ParentCredentialHandoff({email,password,loginUrl,onDismiss}:{email:string;password:string;loginUrl:string;onDismiss:()=>void}) {
  const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const copy=async()=>{
    if(busy)return;setBusy(true);setError("");
    try{await navigator.clipboard.writeText(`Parent Portal Login
Login: ${loginUrl}
Email: ${email}
Password: ${password}`);window.dispatchEvent(new CustomEvent("acadivo:feedback",{detail:{type:"success",message:"Credentials copied to clipboard"}}));}
    catch{setError("Clipboard access is unavailable. Use Show password, then copy the details manually.");}
    finally{setBusy(false);}
  };
  return <section aria-label="New parent login credentials" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Parent account ready</h2><p className="mt-1 text-xs">Copy these details and share privately with the parent. Dismiss clears this copy of the password.</p></div><button type="button" onClick={onDismiss} className="text-xs font-semibold">Dismiss credentials</button></div>
    <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs">Parent email</dt><dd className="mt-1 break-all font-medium">{email}</dd></div><div><dt className="text-xs">Portal login</dt><dd className="mt-1 break-all"><a href={loginUrl} className="underline">{loginUrl}</a></dd></div><div><dt className="text-xs">Password</dt><dd className="mt-1 flex items-center gap-3"><span className="break-all font-mono">{visible?password:"••••••••"}</span><button type="button" onClick={()=>setVisible(!visible)} aria-label={visible?"Hide parent password":"Show parent password"} aria-pressed={visible} className="inline-flex items-center gap-1 text-xs">{visible?<EyeOff size={16}/>:<Eye size={16}/>} {visible?"Hide":"Show"}</button></dd></div></dl>
    <button type="button" disabled={busy} onClick={()=>void copy()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Copy size={16}/>{busy?"Copying…":"Copy Credentials"}</button>
    {error&&<p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
  </section>;
}
