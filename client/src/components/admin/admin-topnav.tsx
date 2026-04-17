"use client";

import { useEffect, useState } from "react";

export function AdminTopNav() {
  const [utcTime, setUtcTime] = useState("");

  useEffect(() => {
    function tick() {
      setUtcTime(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          timeZone: "UTC",
        }),
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex justify-between items-center w-full px-4 h-14 bg-[#0e0e0e] fixed top-0 z-50">
      <div className="flex items-center gap-6">
        <span className="text-xl font-black tracking-tighter text-[#2196f3]">
          COMPLEX
        </span>
        <span className="font-sans uppercase tracking-widest text-[0.8rem] font-bold text-[#2196f3] border-b-2 border-[#2196f3] pb-1">
          ADMIN
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-gray-600">
          {utcTime} UTC
        </span>
        <span className="w-2 h-2 bg-[#40e56c]" />
      </div>
    </header>
  );
}
