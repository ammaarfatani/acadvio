"use client";
import {useEffect,useState} from "react";
import {apiFetch} from "@/lib/api";
import DataChart from "./DataChart";
export default function WorkspaceAnalytics(){
  const [data,setData]=useState<any>(null),[error,setError]=useState("");
  useEffect(()=>{let live=true;apiFetch("/workspace/analytics").then(response=>{if(live)setData(response.data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  if(error)return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Analytics unavailable: {error}</p>;
  if(!data)return <div role="status" className="h-48 animate-pulse rounded-lg border bg-white p-5 text-sm text-zinc-500">Loading school analytics…</div>;
  if(!data.charts.length)return <p className="text-sm text-zinc-500">No analytics reports are available for your permissions.</p>;
  return <section className="space-y-4"><div><h2 className="text-lg font-semibold">Workspace insights</h2><p className="mt-1 text-xs text-zinc-500">School records · Asia/Karachi · Updated {new Date(data.generatedAt).toLocaleTimeString()}</p></div><div className="grid gap-4 lg:grid-cols-2">{data.charts.map((chart:any)=><DataChart key={chart.title} {...chart}/>)}</div></section>;
}
