"use client";

import { User, ShieldCheck, Mail, Building2, Calendar, Phone, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function ReceptionistProfilePage() {
  const { user } = useAuth();

  const userName = user?.name || "Front Desk Officer";
  const userEmail = user?.email || "";
  const schoolName = user?.school?.name || "School ERP";
  const userRole = user?.userType || "RECEPTIONIST";

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
          <User className="h-6 w-6 text-school-primary" />
          Receptionist Account Profile
        </h1>
        <p className="text-xs text-zinc-500">
          Account details, assigned department role, active school tenant context, and front-desk access permissions.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-zinc-100 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-school-primary text-white font-black text-2xl flex items-center justify-center shadow-xs">
            {userName
              .split(/\s+/)
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-zinc-950">{userName}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-school-primary/10 text-school-primary font-bold px-2.5 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> {userRole}
              </span>
              <span className="text-zinc-500 font-mono">{userEmail}</span>
            </div>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-zinc-400" /> Institution / School Campus
            </span>
            <p className="font-bold text-zinc-950">{schoolName}</p>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
              <Mail className="h-3.5 w-3.5 text-zinc-400" /> Account Email Address
            </span>
            <p className="font-bold text-zinc-950 font-mono">{userEmail}</p>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" /> Assigned Portal Role
            </span>
            <p className="font-bold text-zinc-950">{userRole}</p>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" /> Portal Access
            </span>
            <p className="font-bold text-emerald-700">Active — Reception & Front Desk</p>
          </div>
        </div>

        {/* Permission Summary */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
            Front Desk Access Permissions
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              "students.view",
              "students.create",
              "attendance.view",
              "teachers.view",
              "admissions.view",
              "admissions.manage",
              "visitors.manage",
              "settings.view",
              "settings.update",
            ].map((perm) => (
              <span
                key={perm}
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-school-primary/10 text-school-primary border border-school-primary/20"
              >
                {perm}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500">
            These permissions are configured by your school administrator and cannot be modified from this profile.
          </p>
        </div>
      </div>
    </div>
  );
}
