"use client";

import { useState, useRef } from "react";

import { ArrowUpRight } from "lucide-react";

import { apiFetch } from "@/lib/api";

import { company } from "@/lib/company";



export function ContactInquiry() {

  const requestId=useRef("");

  const lastPayload=useRef("");

  const [busy,setBusy]=useState(false);

  const [status,setStatus]=useState("");

  const [success,setSuccess]=useState(false);

  const [website,setWebsite]=useState("");

  const [topic, setTopic] = useState("Product demonstration");

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [school, setSchool] = useState("");

  const [message, setMessage] = useState("");

  const field = "mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-red-100";

  return <form onSubmit={async event => { event.preventDefault();if(busy)return;setBusy(true);setStatus("");setSuccess(false);const payload=JSON.stringify({name,email,school,topic,message,website});if(!requestId.current||lastPayload.current!==payload){requestId.current=crypto.randomUUID();lastPayload.current=payload;}try{const result=await apiFetch("/public/contact",{method:"POST",body:JSON.stringify({requestId:requestId.current,name,email,school,topic,message,website})});setStatus(result.message);setSuccess(true);}catch(error:any){setStatus(/school administrator/i.test(error.message||"")?"We could not send your inquiry. Please try again or email us directly.":error.message||"We could not send your inquiry. Please try again.");}finally{setBusy(false);}}} className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">

    <h2 className="text-2xl font-semibold tracking-tight">Let’s talk about your school.</h2><p className="mt-3 text-sm leading-6 text-zinc-600">Tell us what you need. Your inquiry goes directly to our team. Include the details that will help us support you.</p>

    <div hidden aria-hidden="true"><label>Leave this empty<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>

    <fieldset disabled={busy||success}><div className="mt-7 grid gap-5 sm:grid-cols-2">

      <label className="text-sm font-medium">Your name<input required placeholder="Your full name" autoComplete="name" maxLength={100} value={name} onChange={event => setName(event.target.value)} className={field}/></label>

      <label className="text-sm font-medium">Email address<input required placeholder="you@school.edu" type="email" autoComplete="email" maxLength={150} value={email} onChange={event => setEmail(event.target.value)} className={field}/></label>

      <label className="text-sm font-medium">School name <span className="font-normal text-zinc-500">(optional)</span><input placeholder="Your school name" autoComplete="organization" maxLength={150} value={school} onChange={event => setSchool(event.target.value)} className={field}/></label>

      <label className="text-sm font-medium">How can we help?<select value={topic} onChange={event => setTopic(event.target.value)} className={field}>{["Product demonstration", "Pricing and subscriptions", "School onboarding", "Technical support", "Other inquiry"].map(item => <option key={item}>{item}</option>)}</select></label>

      <label className="text-sm font-medium sm:col-span-2">Your message<textarea required rows={4} minLength={10} maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Which workflows would you like to improve?" className={field}/></label>

    </div>

    </fieldset>

    {status&&<p role={success?"status":"alert"} className={`mt-5 rounded-md border p-4 text-sm ${success?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-red-200 bg-red-50 text-red-900"}`}>{status}</p>}

    <button disabled={busy||success} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">{busy?"Sending inquiry…":success?"Inquiry sent":"Send inquiry"} <ArrowUpRight size={16}/></button><p className="mt-3 text-xs leading-5 text-zinc-500">You can also write directly to <a className="underline" href={`mailto:${company.email}`}>{company.email}</a>.</p>

  </form>;

}

