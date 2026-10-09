"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
export default function BranchSwitcher() {
  const {user}=useAuth();const [branches,setBranches]=useState<any[]>([]),[error,setError]=useState("");
  useEffect(()=>{if(user?.isOrganizationOwner)apiFetch("/organization/branches").then(r=>setBranches(r.data)).catch(e=>setError(e.message));},[user?.isOrganizationOwner]);
  if(!user?.isOrganizationOwner)return null;
  return <label className="max-w-48 text-[10px] text-zinc-500">Current branch<select aria-label="Current branch" disabled={!branches.length} value={user.branchId||"all"} onChange={e=>{sessionStorage.setItem("acadivo:branch",e.target.value);window.location.reload();}} className="block w-full rounded-md border bg-white px-2 py-1.5 text-xs text-zinc-800"><option value="all">All branches</option>{branches.filter(b=>b.status==="ACTIVE").map(b=><option key={b._id} value={b._id}>{b.name}</option>)}</select>{error&&<span role="alert">{error}</span>}</label>;
}
