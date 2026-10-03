"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare, X, Send, ArrowUpRight } from "lucide-react";
import { answerWebsiteQuestion } from "@/lib/website-guide";

type Message = { role: "user" | "guide"; text: string; links?: {href:string;label:string}[] };
export function WebsiteGuide() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([{role:"guide",text:"Hi! Ask me about Acadivo, AKTech, trial signup, plans or portal access. English aur Roman Urdu mein pooch sakte hain."}]);
  const [typing, setTyping] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [messages, open, typing]);
  useEffect(() => () => { if (replyTimer.current) clearTimeout(replyTimer.current); }, []);
  const ask = (text: string) => {
    if (!text.trim() || pending.current) return;
    pending.current = true;
    const reply = answerWebsiteQuestion(text);
    setMessages(previous=>[...previous.slice(-38),{role:"user",text:text.trim().slice(0,800)}]);
    setQuestion("");
    setTyping(true);
    replyTimer.current = setTimeout(() => {
      setMessages(previous=>[...previous,{role:"guide",text:reply.answer,links:reply.links}]);
      pending.current = false;
      setTyping(false);
      replyTimer.current = null;
      input.current?.focus();
    }, 1600);
  };
  return <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
    {open && <section id="website-guide" aria-label="Acadivo website guide" onKeyDown={event=>{if(event.key === "Escape")close();}} className="mb-3 flex h-[min(590px,calc(100dvh-110px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 p-4"><div className="flex items-center gap-3"><span className="rounded-lg bg-red-50 p-2 text-brand-600"><MessageSquare size={20}/></span><div><h2 className="text-sm font-semibold">Acadivo guide</h2><p className="mt-1 text-xs text-zinc-500">Company & product help</p></div></div><button onClick={close} aria-label="Close website guide" className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100"><X size={18}/></button></div>
      <div ref={history} className="min-h-0 flex-1 overflow-y-auto p-4"><div role="log" aria-live="polite" aria-relevant="additions" className="space-y-4">{messages.map((message,index)=><div key={index} className={message.role === "user" ? "ml-8" : "mr-3"}><p className="mb-1 text-[10px] font-medium text-zinc-500">{message.role === "user" ? "You" : "Acadivo guide"}</p><div className={`whitespace-pre-wrap break-words rounded-lg px-3 py-3 text-sm leading-6 ${message.role === "user" ? "bg-zinc-900 text-white" : "border border-zinc-100 bg-zinc-50 text-zinc-700"}`}>{message.text}</div>{message.links && <div className="mt-2 flex flex-wrap gap-2">{message.links.map(link=><Link key={link.href} href={link.href} onClick={close} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-semibold text-brand-600">{link.label}<ArrowUpRight size={12}/></Link>)}</div>}</div>)}{typing && <div role="status" className="mr-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm text-zinc-500"><span aria-hidden="true" className="mr-2 inline-flex gap-1"><span className="h-1 w-1 rounded-full bg-zinc-400 animate-pulse"/><span className="h-1 w-1 rounded-full bg-zinc-400 animate-pulse [animation-delay:200ms]"/><span className="h-1 w-1 rounded-full bg-zinc-400 animate-pulse [animation-delay:400ms]"/></span>Acadivo is typing…</div>}</div></div>
      <div className="shrink-0 border-t border-zinc-200 p-3"><div className="mb-3 flex gap-2 overflow-x-auto">{["Free trial", "Pricing & payment", "Company contact"].map(text=><button key={text} disabled={typing} onClick={()=>ask(text)} className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">{text}</button>)}</div><form onSubmit={event=>{event.preventDefault();ask(question);}} className="flex gap-2"><input ref={input} value={question} onChange={event=>setQuestion(event.target.value)} maxLength={800} aria-label="Your question" placeholder="Ask about Acadivo…" className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600"/><button disabled={!question.trim() || typing} aria-label="Send question" className="rounded-lg bg-brand-600 p-3 text-white disabled:opacity-40"><Send size={17}/></button></form><p className="mt-2 text-[10px] leading-4 text-zinc-500">Answers from public product information. No access to school records.</p></div>
    </section>}
    <div className="flex justify-end"><button ref={launcher} onClick={()=>open ? close() : setOpen(true)} aria-expanded={open} aria-controls="website-guide" className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-700"><MessageSquare size={19}/>{open ? "Close guide" : "Ask Acadivo"}</button></div>
  </div>;
}

