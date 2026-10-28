import fs from "node:fs";
import path from "node:path";
import {z} from "zod";
import {MARKETS,MarketCode,isMarket,discountPercent} from "../../lib/market-pricing";
import {localCurrencyRate} from "./exchangeRates.service";
const amount=z.number().positive().max(100000000).refine(v=>Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<.0001,"Prices must have at most two decimal places.");
const codePrices=z.object({STARTER:amount,PROFESSIONAL:amount,ENTERPRISE:amount});
const entry=z.object({currency:z.string(),locale:z.string(),label:z.string(),prices:codePrices.partial(),originalMonthly:codePrices.partial().optional()});
export function pricingConfig(){const raw=process.env.REGIONAL_PRICING_JSON||fs.readFileSync(path.resolve(process.cwd(),"config/regional-pricing.json"),"utf8");const parsed=z.object({PK:entry,US:entry,GB:entry,IN:entry}).parse(JSON.parse(raw));for(const m of MARKETS.filter(m=>["PK","US","GB","IN"].includes(m.code))){const item=parsed[m.code as keyof typeof parsed];if(item.currency!==m.currency||item.locale!==m.locale)throw new Error("Regional pricing currency/locale mismatch");}return parsed;}
export function marketSelection(value:unknown):MarketCode{if(value===undefined)return "PK";if(!isMarket(value))throw {statusCode:400,message:"Select a supported pricing market."};return value;}
export function regionalPlan(plan:any,market:MarketCode,config=pricingConfig()){
 const configured=config[market as keyof typeof config];
 if(!configured){const selected=MARKETS.find(m=>m.code===market);if(!selected)throw {statusCode:400,message:"Select a supported country."};const fx=localCurrencyRate(selected.currency);const base=config.US.prices[plan.code as "STARTER"|"PROFESSIONAL"|"ENTERPRISE"];if(!base)throw {statusCode:503,message:"Plan pricing unavailable."};const digits=new Intl.NumberFormat("en",{style:"currency",currency:selected.currency}).resolvedOptions().maximumFractionDigits||0;const scale=10**digits,monthly=Math.round(base*fx.rate*scale)/scale;return {code:plan.code,name:plan.name,market,country:selected.label,currency:selected.currency,locale:selected.locale,monthly,annualTotal:Math.round(monthly*10*scale)/scale,originalMonthly:null,promotionPercent:0,checkoutAvailable:false,paymentMethod:"UNAVAILABLE",converted:true,rateUpdatedAt:fx.updated};}
 const region=configured;const monthly=market==="PK"?plan.priceMonthlyPKR:region.prices[plan.code as "STARTER"|"PROFESSIONAL"|"ENTERPRISE"];
 if(!Number.isFinite(monthly)||!(monthly!>0))throw {statusCode:503,message:"Pricing is not configured for this market. Contact support."};
 const original=region.originalMonthly?.[plan.code as "STARTER"|"PROFESSIONAL"|"ENTERPRISE"];
 // A catalogue price increase must suppress an obsolete promotion, never display a negative saving.
 return {code:plan.code,name:plan.name,market,country:region.label,currency:region.currency,locale:region.locale,monthly,annualTotal:Math.round(monthly!*10*100)/100,originalMonthly:original&&original>monthly!?original:null,promotionPercent:original?discountPercent(original,monthly!):0,checkoutAvailable:market==="PK",paymentMethod:market==="PK"?"BANK_TRANSFER":"UNAVAILABLE"};
}
export function regionalQuote(plan:any,cycle:"monthly"|"annual",market:MarketCode){const p=regionalPlan(plan,market);return {...p,plan:p.code,price:cycle==="annual"?p.annualTotal:p.monthly,monthlyPrice:cycle==="annual"?p.annualTotal/12:p.monthly,billingCycle:cycle,durationMonths:cycle==="annual"?12:1};}
export function requirePayableMarket(market:MarketCode){if(market!=="PK")throw {statusCode:409,message:"Checkout in this currency is not enabled. Contact Acadivo for an international payment arrangement. No payment has been taken."};}
