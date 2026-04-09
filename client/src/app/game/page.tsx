"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  HeaderBar,
  SecondaryStatusBar,
  LeftSidebar,
  DirectiveEditor,
  RightSidebar,
  Footer,
} from "@/components/game";

export default function GamePage() {
  const { user } = useAuth();
  const ticker = user?.ticker || "$XXX";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e2e1] font-mono">
      <HeaderBar />
      <SecondaryStatusBar />

      <main className="flex flex-1 pt-[72px] pb-6 overflow-hidden h-screen">
        <LeftSidebar ticker={ticker} />
        <DirectiveEditor />
        <RightSidebar />
      </main>

      <Footer ticker={ticker} />
    </div>
  );
}
