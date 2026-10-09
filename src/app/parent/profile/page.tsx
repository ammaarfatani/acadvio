"use client";


import { useAuth } from "@/lib/auth-context";
export default function Page(){const {user}=useAuth();return <div className="space-y-4"><h1 className="text-2xl font-black">My profile</h1><div className="rounded-xl border bg-white p-5"><p className="font-semibold">{user?.name}</p><p className="mt-2 text-sm text-zinc-500">{user?.email}</p><p className="mt-2 text-sm">{user?.school?.name}</p></div></div>;}
