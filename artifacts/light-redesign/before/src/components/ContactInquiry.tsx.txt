"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { company } from "@/lib/company";

export function ContactInquiry() {
  const [topic, setTopic] = useState("Product demonstration");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [message, setMessage] = useState("");
  const field = "mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-red-100";
  return <form onSubmit={event => { event.preventDefault(); const body = `Name: ${name}\nReply email: ${email}\nSchool: ${school || "Not specified"}\n\n${message}`; window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(`Acadivo — ${topic}`)}&body=${encodeURIComponent(body)}`; }} className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
    <h2 className="text-2xl font-semibold tracking-tight">Let’s talk about your school.</h2><p className="mt-3 text-sm leading-6 text-zinc-600">Tell us what you need. We’ll prepare your inquiry as an email draft for you to review and send.</p>
    <div className="mt-7 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Your name<input required placeholder="Your full name" autoComplete="name" maxLength={100} value={name} onChange={event => setName(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">Email address<input required placeholder="you@school.edu" type="email" autoComplete="email" maxLength={150} value={email} onChange={event => setEmail(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">School name <span className="font-normal text-zinc-500">(optional)</span><input placeholder="Your school name" autoComplete="organization" maxLength={150} value={school} onChange={event => setSchool(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">How can we help?<select value={topic} onChange={event => setTopic(event.target.value)} className={field}>{["Product demonstration", "Pricing and subscriptions", "School onboarding", "Technical support", "Other inquiry"].map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="text-sm font-medium sm:col-span-2">Your message<textarea required rows={4} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Which workflows would you like to improve?" className={field}/></label>
    </div>
    <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">Prepare email inquiry <ArrowUpRight size={16}/></button><p className="mt-3 text-xs leading-5 text-zinc-500">Opens your email app. Nothing is sent until you send the draft. You can also write directly to <a className="underline" href={`mailto:${company.email}`}>{company.email}</a>.</p>
  </form>;
}
