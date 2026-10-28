import {COUNTRIES} from "./pricing-countries";
import currencies from "../../config/country-currencies.json";
export type MarketCode=string;
export const MARKETS=COUNTRIES.map(c=>({code:c.code,currency:(currencies as Record<string,string>)[c.code]||"USD",locale:`en-${c.code}`,label:c.name}));
export const isMarket=(value:unknown):value is MarketCode=>typeof value==="string"&&MARKETS.some(m=>m.code===value);
export function money(amount:number,currency="PKR"){const valid=/^[A-Z]{3}$/.test(currency)?currency:"PKR";return new Intl.NumberFormat(valid==="PKR"?"en-PK":valid==="INR"?"en-IN":"en",{style:"currency",currency:valid,minimumFractionDigits:0}).format(amount);}
export function discountPercent(original:number,payable:number){return Number.isFinite(original)&&original>payable&&payable>0?Math.round((original-payable)/original*10000)/100:0;}
