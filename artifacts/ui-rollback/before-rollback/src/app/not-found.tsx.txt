import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-16 h-16 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h1 className="text-4xl font-black tracking-tight text-white mb-2">404 - Page Not Found</h1>
      <p className="text-sm text-zinc-400 max-w-md mb-6">
        The requested page or resource could not be found on Acadivo. Please verify the URL or return to the main dashboard.
      </p>

      <Link
        href="/"
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-colors shadow-xs"
      >
        <Home className="h-4 w-4" />
        Return to Homepage
      </Link>
    </div>
  );
}
