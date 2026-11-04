import Link from "next/link";
type Metric={used:number;limit:number|null;remaining:number|null;overLimit:boolean};
export default function SubscriptionUsage({usage}:{usage:any}) {
  if(!usage)return null;
  const rows:[string,Metric,string][]=[
    ["Students",usage.students,"Active enrolled students"],
    ["Teachers",usage.teachers,"Active teacher accounts"],
    ["Department staff",usage.staff,"Finance, examination & reception; teachers counted separately"],
    ["Additional branches",usage.additionalBranches,"Main / owner branch is included separately; inactive branches also use a slot"],
  ];
  return <section className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-7">
    <div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-bold">Your plan usage</h2><p className="mt-1 text-xs text-zinc-500">{usage.scope} · Counts update when you refresh subscription status.</p></div><Link href="/contact" className="text-sm font-semibold text-red-700">Need more capacity? Contact Acadivo →</Link></div>
    <div className="grid gap-4 sm:grid-cols-2">{rows.map(([label,m,note])=><article key={label} className="rounded-md border border-zinc-200 bg-zinc-50 p-4"><div className="flex justify-between gap-2"><h3 className="text-sm font-semibold">{label}</h3><span className={m.overLimit?"text-xs font-semibold text-red-700":"text-xs text-zinc-500"}>{m.overLimit?"Above plan limit":m.limit===null?"No seat limit":m.limit===0?"Not included":`${m.remaining?.toLocaleString()} remaining`}</span></div><p className="my-3 text-2xl font-bold tabular-nums">{m.used.toLocaleString()} <span className="text-sm font-normal text-zinc-500">used{m.limit!==null&&` / ${m.limit.toLocaleString()}`}</span></p>{m.limit!==null&&m.limit>0&&<div role="progressbar" aria-label={`${label} capacity used`} aria-valuemin={0} aria-valuemax={m.limit} aria-valuenow={Math.min(m.used,m.limit)} className="h-1.5 overflow-hidden rounded bg-zinc-200"><div className={m.remaining===0?"h-full bg-red-600":"h-full bg-zinc-700"} style={{width:`${Math.min(100,m.used/m.limit*100)}%`}}/></div>}<p className="mt-3 text-xs leading-5 text-zinc-500">{note}</p></article>)}</div>
    <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-semibold">What your plan includes</summary><ul className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">{usage.includedFeatures.map((f:string)=><li key={f}>✓ {f}</li>)}</ul></details>
  </section>;
}
