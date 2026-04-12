"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-[#0077b6] tracking-widest uppercase text-sm animate-pulse">
        Initializing...
      </div>
    </div>
  );
}
