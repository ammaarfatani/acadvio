let cached:{updated:number;rates:Record<string,number>}|undefined;
let pending:Promise<void>|undefined,lastAttempt=0;
export function parseExchangeRates(input:any){if(input?.result!=="success"||input.base_code!=="USD"||!Number.isFinite(input.time_last_update_unix)||input.time_last_update_unix*1000>Date.now()+86400000||!input.rates||input.rates.USD!==1)throw Error("Invalid currency rates");const rates:Record<string,number>={};for(const [code,rate]of Object.entries(input.rates))if(/^[A-Z]{3}$/.test(code)&&typeof rate==="number"&&Number.isFinite(rate)&&rate>0)rates[code]=rate;return {updated:input.time_last_update_unix*1000,rates};}
export async function ensureExchangeRates(){
 if(cached&&Date.now()-cached.updated<24*3600000)return;
 if(pending)return pending;
 if(Date.now()-lastAttempt<60000)return;
 lastAttempt=Date.now();pending=(async()=>{try{const response=await fetch("https://open.er-api.com/v6/latest/USD",{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error("Rate provider unavailable");cached=parseExchangeRates(await response.json());}catch{/* Never substitute a different currency on failure. */}})().finally(()=>{pending=undefined;});return pending;
}
export function localCurrencyRate(currency:string){if(!cached||Date.now()-cached.updated>3*86400000||!cached.rates[currency])throw {statusCode:503,message:"Local-currency pricing is temporarily unavailable. Please try again shortly or contact Acadivo."};return {rate:cached.rates[currency],updated:new Date(cached.updated).toISOString()};}
