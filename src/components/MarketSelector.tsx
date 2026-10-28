"use client";
import {useEffect,useId,useRef,useState} from "react";
import {Globe2,ChevronDown,Search,Check,X} from "lucide-react";
import {usePathname,useRouter} from "next/navigation";
import {MARKETS,isMarket} from "@/lib/market-pricing";
import {COUNTRIES,isCountry,marketForCountry,countryLabel} from "@/lib/pricing-countries";
const eventName="acadivo:pricing-market",countryKey="acadivo:pricing-country";
export function usePricingMarket(){
 const [country,setCountry]=useState("PK");
 useEffect(()=>{
  const read=(event?:Event)=>{const selected=(event as CustomEvent<string>)?.detail;if(isCountry(selected)){setCountry(selected);return;}try{const saved=localStorage.getItem(countryKey),legacy=localStorage.getItem(eventName);if(isCountry(saved))setCountry(saved);else if(isMarket(legacy))setCountry(legacy);}catch{/* Storage is optional. */}};
  read();window.addEventListener("storage",read);window.addEventListener(eventName,read);return()=>{window.removeEventListener("storage",read);window.removeEventListener(eventName,read);};
 },[]);
 const select=(value:string)=>{if(!isCountry(value))return;setCountry(value);try{localStorage.setItem(countryKey,value);localStorage.setItem(eventName,marketForCountry(value));}catch{/* Optional persistence. */}window.dispatchEvent(new CustomEvent(eventName,{detail:value}));};
 return {country,market:marketForCountry(country),select};
}
function Flag({code}:{code:string}){return <img className="ac-country-flag" src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} width={24} height={18} alt="" loading="lazy" referrerPolicy="no-referrer"/>;}
export function LocationSelector(){
 const router=useRouter();
 const {country,select}=usePricingMarket(),[open,setOpen]=useState(false),[query,setQuery]=useState("");
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null),id=useId(),pathname=usePathname();
 useEffect(()=>{setOpen(false);},[pathname]);
 useEffect(()=>{if(!open)return;input.current?.focus();const dismiss=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);trigger.current?.focus();}};document.addEventListener("pointerdown",dismiss);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",key);};},[open]);
 const results=COUNTRIES.filter(c=>`${c.name} ${c.code} ${countryLabel(c.code)}`.toLowerCase().includes(query.trim().toLowerCase()));
 const selected=COUNTRIES.find(c=>c.code===country)!;
 return <div className="ac-location" ref={root}><button ref={trigger} type="button" className="ac-location-trigger" aria-label={`Select country. Current location: ${selected.name}`} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={()=>{setQuery("");setOpen(!open);}}><Globe2 size={16}/><Flag code={country}/><span>{countryLabel(country)}</span><ChevronDown size={13}/></button>
 {open&&<section id={id} role="dialog" aria-label="Select your location" className="ac-location-panel"><div className="ac-location-heading"><h2>Select your location</h2><button type="button" aria-label="Close location selector" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={19}/></button></div><p>Choose the pricing for your region.</p><label className="ac-location-search"><Search size={19}/><input ref={input} aria-label="Search countries" placeholder="Search country or code" value={query} onChange={e=>setQuery(e.target.value)}/></label><ul className="ac-location-list" aria-label="Countries">{results.map(c=>{const market=MARKETS.find(m=>m.code===marketForCountry(c.code))!;return <li key={c.code}><button type="button" aria-pressed={country===c.code} onClick={()=>{select(c.code);setOpen(false);if(pathname==="/payment"){const url=new URL(window.location.href);url.searchParams.set("market",c.code);router.replace(url.pathname+url.search);}trigger.current?.focus();}}><Flag code={c.code}/><span>{c.name}<small>English · {market.currency}</small></span><b>{countryLabel(c.code)}</b>{country===c.code&&<Check size={16}/>}</button></li>;})}{!results.length&&<li className="ac-location-empty">No countries match your search. Try a country name or code.</li>}</ul><div className="ac-location-footnote">Language: English. Prices follow your selected country’s currency.</div></section>}
 </div>;
}
