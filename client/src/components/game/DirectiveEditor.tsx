"use client";

import { useState } from "react";

interface DirectiveEditorProps {
  charCount?: number;
  maxChars?: number;
}

export function DirectiveEditor({
  charCount = 0,
  maxChars = 2000,
}: DirectiveEditorProps) {
  const [directive, setDirective] = useState("");

  const handleSubmit = () => {
    console.log("Submitting directive:", directive);
  };

  return (
    <section className="flex-1 flex flex-col bg-black relative">
      <div className="p-3 border-b border-[#353534] flex justify-between items-center bg-[#131313]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FFB000]">
            edit_note
          </span>
          <span className="text-[10px] font-bold text-zinc-300 uppercase">
            DIRECTIVE_DRAFT ({charCount} / {maxChars})
          </span>
        </div>
        <div className="flex gap-2">
          <button className="bg-[#353534] px-3 py-1 text-[9px] text-zinc-300 hover:text-white border border-[#353534] uppercase">
            SAVE_LOCAL
          </button>
          <button
            onClick={handleSubmit}
            className="bg-[#00c853] px-4 py-1 text-[9px] text-black font-bold uppercase"
          >
            SUBMIT TO BOARD
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 text-sm relative overflow-hidden flex flex-col gap-6">
        <div className="flex-1 bg-black border border-[#353534] p-6">
          <textarea
            value={directive}
            onChange={(e) => setDirective(e.target.value.slice(0, maxChars))}
            placeholder="_Submit strategic directive..."
            className="w-full h-full bg-transparent outline-none text-zinc-300 resize-none placeholder:text-zinc-600"
            style={{ minHeight: "200px" }}
          />
        </div>

        {/* Bottom Panel: The Board Responds */}
        <BoardResponse />
      </div>

      {/* Tactical Stats */}
      <TacticalStats />
    </section>
  );
}

function BoardResponse() {
  return (
    <div className="h-44 bg-[#131313] border border-[#353534] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-[#353534] pb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FFB000] text-sm">
            gavel
          </span>
          <span className="font-bold text-[10px] tracking-widest uppercase">
            THE BOARD RESPONDS
          </span>
        </div>
        <span className="text-[9px] text-zinc-500">--:--:--</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <p className="text-[11px] text-zinc-300 leading-relaxed normal-case font-medium">
          Board feedback will appear here after submitting your first directive.
        </p>
      </div>
    </div>
  );
}

function TacticalStats() {
  return (
    <div className="h-12 grid grid-cols-4 border-t border-[#353534] bg-[#131313]">
      <div className="border-r border-[#353534] p-2 flex flex-col justify-center">
        <span className="text-[8px] text-zinc-500 uppercase">
          PORTFOLIO_RISK
        </span>
        <div className="w-full bg-[#353534] h-1 mt-1">
          <div className="bg-[#FFB000] h-full w-2/3"></div>
        </div>
      </div>
      <div className="border-r border-[#353534] p-2 flex flex-col justify-center">
        <span className="text-[8px] text-zinc-500 uppercase">
          MARKET_STATUS
        </span>
        <span className="text-[10px] text-[#00c853] font-bold uppercase">
          ACTIVE
        </span>
      </div>
      <div className="border-r border-[#353534] p-2 flex flex-col justify-center">
        <span className="text-[8px] text-zinc-500 uppercase">
          ALPHA_GENERATION
        </span>
        <span className="text-[10px] text-[#FFB000]">--</span>
      </div>
      <div className="p-2 flex flex-col justify-center">
        <span className="text-[8px] text-zinc-500 uppercase">
          PENDING_DIRECTIVES
        </span>
        <span className="text-[10px] text-[#FFB000] font-bold">0</span>
      </div>
    </div>
  );
}
