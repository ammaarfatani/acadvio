"use client";

import { useState } from "react";
import { Bell, Send, Mail, MessageSquare, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";

interface NotificationLog {
  id: string;
  channel: "SMS" | "EMAIL" | "PUSH";
  recipientGroup: string;
  recipientCount: number;
  template: string;
  status: "DELIVERED" | "PENDING" | "FAILED";
  messageSnippet: string;
  sentAt: string;
}

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([
    {
      id: "ntf-1",
      channel: "SMS",
      recipientGroup: "Class 10 Fee Defaulters",
      recipientCount: 14,
      template: "Fee Reminder Notice",
      status: "DELIVERED",
      messageSnippet: "Dear Parent, Monthly tuition fee for Sept 2026 is due. Kindly deposit before Oct 5.",
      sentAt: "2026-09-26 10:15 AM",
    },
    {
      id: "ntf-2",
      channel: "EMAIL",
      recipientGroup: "All Teaching Staff",
      recipientCount: 42,
      template: "Faculty Meeting Circular",
      status: "DELIVERED",
      messageSnippet: "Reminder: Academic alignment session starts today at 2:30 PM in Main Auditorium.",
      sentAt: "2026-09-26 08:30 AM",
    },
    {
      id: "ntf-3",
      channel: "SMS",
      recipientGroup: "Absent Students Parents",
      recipientCount: 8,
      template: "Daily Absence Alert",
      status: "DELIVERED",
      messageSnippet: "Dear Parent, your child was marked ABSENT today (26 Sept). Contact school office.",
      sentAt: "2026-09-26 09:45 AM",
    },
    {
      id: "ntf-4",
      channel: "PUSH",
      recipientGroup: "All School Parents",
      recipientCount: 380,
      template: "Mid-Term Datesheet Alert",
      status: "DELIVERED",
      messageSnippet: "Mid-Term exam datesheet has been published on portal. Download transcript.",
      sentAt: "2026-09-25 04:00 PM",
    },
  ]);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [recipientGroup, setRecipientGroup] = useState("ALL_PARENTS");
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) return;

    setSending(true);
    setTimeout(() => {
      const newLog: NotificationLog = {
        id: "ntf-" + Date.now(),
        channel,
        recipientGroup: recipientGroup.replace("_", " "),
        recipientCount: recipientGroup === "ALL_PARENTS" ? 380 : 25,
        template: "Custom Broadcast",
        status: "DELIVERED",
        messageSnippet: message,
        sentAt: "Just Now",
      };

      setLogs([newLog, ...logs]);
      setSending(false);
      setShowBroadcastModal(false);
      setMessage("");
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 4000);
    }, 800);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Bell className="h-6 w-6 text-red-600" />
            SMS & Communication Gateway
          </h1>
          <p className="text-xs text-zinc-500">Automated SMS alerts, email notifications, and instant broadcast dispatches</p>
        </div>

        <button
          onClick={() => setShowBroadcastModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
        >
          <Send className="h-4 w-4" />
          Send Instant Broadcast
        </button>
      </div>

      {sendSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Broadcast alert dispatched successfully via SMS gateway!</span>
        </div>
      )}

      {/* Gateway KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Alerts Sent Today</span>
          <p className="text-xl font-black text-zinc-950 mt-1">444</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Remaining SMS Credits</span>
          <p className="text-xl font-black text-emerald-600 mt-1">8,580</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Delivery Success Rate</span>
          <p className="text-xl font-black text-zinc-950 mt-1">99.2%</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Gateway Health</span>
          <p className="text-sm font-bold text-emerald-600 mt-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE (API Active)
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-950 uppercase tracking-wide">
            Recent Broadcast & Alert Logs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5 w-24">Channel</th>
                <th className="p-3.5">Target Group</th>
                <th className="p-3.5 text-center w-24">Recipients</th>
                <th className="p-3.5">Message Snippet</th>
                <th className="p-3.5 text-center w-24">Status</th>
                <th className="p-3.5 text-right w-36">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3.5">
                    {log.channel === "SMS" ? (
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                        <MessageSquare className="h-3 w-3" /> SMS
                      </span>
                    ) : log.channel === "EMAIL" ? (
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                        <Mail className="h-3 w-3" /> EMAIL
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                        <Bell className="h-3 w-3" /> PUSH
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 font-bold text-zinc-950">{log.recipientGroup}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-zinc-700">{log.recipientCount}</td>
                  <td className="p-3.5 text-zinc-600 truncate max-w-xs">{log.messageSnippet}</td>
                  <td className="p-3.5 text-center">
                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded">
                      {log.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-zinc-500 text-[11px]">{log.sentAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Send Instant Broadcast Alert</h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel("SMS")}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      channel === "SMS" ? "bg-red-50 border-red-500 text-red-700" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                    }`}
                  >
                    SMS Gateway
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("EMAIL")}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      channel === "EMAIL" ? "bg-red-50 border-red-500 text-red-700" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                    }`}
                  >
                    Email Blast
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Target Recipients</label>
                <select
                  value={recipientGroup}
                  onChange={(e) => setRecipientGroup(e.target.value)}
                  className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
                >
                  <option value="ALL_PARENTS">All School Parents (380 Parents)</option>
                  <option value="FEE_DEFAULTERS">Fee Defaulters (14 Parents)</option>
                  <option value="ALL_TEACHERS">All Teachers & Staff (42 Staff)</option>
                  <option value="CLASS_10">Class 10-A Parents Only (32 Parents)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Message Text</label>
                <textarea
                  required
                  rows={4}
                  maxLength={160}
                  placeholder="Type your SMS/Email broadcast message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                  <span>Standard 1 SMS = 160 characters</span>
                  <span>{message.length} / 160</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {sending ? "Sending..." : "Dispatch Broadcast"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
