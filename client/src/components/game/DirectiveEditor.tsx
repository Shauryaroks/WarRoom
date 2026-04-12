"use client";

import { useState, useRef, useEffect } from "react";
import { useGameContext } from "@/contexts/GameContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { api } from "@/lib/api";

const STORAGE_KEY = "complex_directive_draft";

export function DirectiveEditor({ maxChars = 2000 }: { maxChars?: number }) {
  const { cooldownRemaining, setCooldownRemaining, setIsFeedbackModalOpen } =
    useGameContext();
  const { dossier } = useWebSocket();
  const [directive, setDirective] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setDirective(saved);
      setCharCount(saved.length);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxChars) {
      setDirective(value);
      setCharCount(value.length);
      localStorage.setItem(STORAGE_KEY, value);
    }
  };

  const handleTemplate = (template: string) => {
    const newVal = directive ? directive + "\n\n" + template : template;
    if (newVal.length <= maxChars) {
      setDirective(newVal);
      setCharCount(newVal.length);
    }
  };

  const handleSubmit = async () => {
    if (!directive.trim() || isSubmitting || activeCooldown) return;

    setIsSubmitting(true);
    try {
      const response = await api.submitDirective({
        directive_markdown: directive,
      });
      if (response && response.seconds_remaining) {
        setCooldownRemaining(response.seconds_remaining);
      }
      setIsFeedbackModalOpen(true);
      setDirective("");
      setCharCount(0);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to submit directive:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const lineCount = directive.split("\n").length;
  const lines = Array.from(
    { length: Math.max(10, lineCount) },
    (_, i) => i + 1,
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isWarningChars = charCount >= 1800;
  const isMaxChars = charCount >= maxChars;

  // Use both dossier cooldown status and local countdown
  const activeCooldown =
    dossier?.cooldown_status?.active || cooldownRemaining > 0;
  const displayCooldown = Math.max(
    cooldownRemaining,
    dossier?.cooldown_status?.seconds_remaining || 0,
  );

  return (
    <div className="flex flex-col h-full w-full font-mono text-[13px] bg-[#0a0a0a] text-[#0077b6] relative">
      {/* Toolbar */}
      <div className="h-[40px] shrink-0 border-b border-[#0077b6] flex items-center px-4 gap-4 bg-[#0a0a0a] text-[#0077b6]">
        <button className="hover:text-white uppercase">[TEMPLATE ▼]</button>
        <button
          onClick={() =>
            handleTemplate("# Price War\nWe will cut prices by 15%...")
          }
          className="hover:text-white uppercase"
        >
          [PRICE WAR]
        </button>
        <button
          onClick={() =>
            handleTemplate("# R&D Push\nWe are allocating $500k to R&D...")
          }
          className="hover:text-white uppercase"
        >
          [R&D PUSH]
        </button>
        <button
          onClick={() => handleTemplate("# Pivot\nWe are shifting focus to...")}
          className="hover:text-white uppercase"
        >
          [PIVOT]
        </button>
        <div className="flex-1"></div>
        <button className="hover:text-white uppercase">[? HELP]</button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative flex overflow-hidden group">
        {/* Line Numbers Gutter */}
        <div
          className="w-[40px] shrink-0 border-r border-[#0077b6] bg-[#0a0a0a] text-[#0077b6] text-right py-[20px] px-2 select-none overflow-hidden opacity-50"
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {lines.map((n) => (
            <div key={n} className={n === lineCount ? "opacity-100" : ""}>
              {n}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={directive}
          onChange={handleChange}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          disabled={activeCooldown}
          className="flex-1 w-full h-full bg-transparent outline-none resize-none p-[20px] leading-[1.6] placeholder:text-[#0077b6] focus:ring-0 text-[#0077b6] placeholder-opacity-50"
          placeholder=">_ ENTER STRATEGIC DIRECTIVE..."
          spellCheck={false}
        />

        {/* Character Counter */}
        <div
          className={`absolute bottom-4 right-4 font-bold ${isMaxChars ? "text-red-500 animate-pulse" : isWarningChars ? "text-red-400" : "text-[#0077b6]"}`}
        >
          {charCount} / {maxChars}
        </div>

        {/* Cooldown Overlay */}
        {activeCooldown && (
          <div className="absolute inset-0 bg-[#0a0a0a]/90 flex items-center justify-center z-10">
            <div className="border-2 border-[#0077b6] p-8 text-center bg-[#0a0a0a] animate-pulse">
              <div className="text-[#0077b6] mb-4 text-[16px] tracking-widest">
                [ BOARD REVIEWING DIRECTIVE ]
              </div>
              <div className="text-[#0077b6] text-[48px] font-bold tracking-widest mb-4">
                ██ {formatTime(displayCooldown)} ██
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-[30px] shrink-0 border-t border-b border-[#0077b6] bg-[#0a0a0a] flex items-center px-4 justify-between text-[#0077b6] text-[11px] opacity-70">
        <span>READY</span>
        <span>|</span>
        <span>LAST SAVE: {new Date().toLocaleTimeString()}</span>
        <span>|</span>
        <span className="flex items-center gap-2">
          CONNECTION:{" "}
          <span className="text-[#0077b6]">[████████░░] SECURE</span>
        </span>
      </div>

      {/* Submit Area */}
      <div className="h-[60px] shrink-0 bg-[#0a0a0a] p-1.5 flex">
        {activeCooldown ? (
          <button
            disabled
            className="w-full h-full bg-[#0a0a0a] text-[#0077b6] font-bold uppercase tracking-widest border-2 border-[#0077b6] opacity-50 cursor-not-allowed"
          >
            COOLDOWN ACTIVE - {formatTime(displayCooldown)}
          </button>
        ) : isSubmitting ? (
          <button
            disabled
            className="w-full h-full bg-[#0077b6] text-black font-bold uppercase tracking-widest animate-pulse"
          >
            TRANSMITTING... ▓▒░
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!directive.trim()}
            className="w-full h-full bg-[#0a0a0a] border-2 border-[#0077b6] text-[#0077b6] font-bold uppercase tracking-[0.1em] hover:bg-[#0077b6] hover:text-black active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            [ SUBMIT TO BOARD ]
          </button>
        )}
      </div>
    </div>
  );
}
