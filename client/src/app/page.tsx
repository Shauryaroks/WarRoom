"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  // Auth redirects commented out for now
  router.replace("/register");

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-[#FFB000] tracking-widest uppercase text-sm animate-pulse">
        Initializing...
      </div>
    </div>
  );
}
