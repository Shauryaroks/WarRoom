"use client";

import { useState, useRef, useEffect } from "react";
import { useGameContext } from "@/contexts/GameContext";

const STORAGE_KEY = "complex_directive_draft";

/**
 * The DirectiveEditor component provides a terminal-like text editor for players
 * to draft and submit strategic directives to the AI board.
 *
 * It features line numbers, character counting, local storage draft saving,
 * template insertion, and visual cooldown management.
 *
 * @param {Object} props - Component props.
 * @param {number} [props.maxChars=2000] - The maximum number of characters allowed for a directive.
 * @returns The rendered DirectiveEditor component.
 */
export function DirectiveEditor({ maxChars = 2000 }: { maxChars?: number }) {
  const { cooldownRemaining, setCooldownRemaining, setIsFeedbackModalOpen } =
    useGameContext();
  const [directive, setDirective] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load draft
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleSubmit = () => {
    if (!directive.trim() || cooldownRemaining > 0) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setCooldownRemaining(600); // 10 mins
      setIsFeedbackModalOpen(true); // Demo: show feedback after submit
      setDirective("");
      setCharCount(0);
      localStorage.removeItem(STORAGE_KEY);
    }, 1500);
  };

  // Generate line numbers
  const lineCount = directive.split("\n").length;
  const lines = Array.from(
    { length: Math.max(10, lineCount) },
    (_, i) => i + 1,
  );

  // Format time MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Demo decrement cooldown
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(
        () => setCooldownRemaining(cooldownRemaining - 1),
        1000,
      );
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining, setCooldownRemaining]);

  const isWarningChars = charCount >= 1800;
  const isMaxChars = charCount >= maxChars;

  return (
    <div className="flex flex-col h-full w-full font-mono text-[13px] bg-[#0d0d0d] text-[#e0e0e0] relative">
      {/* Toolbar (40px) */}
      <div className="h-[40px] shrink-0 border-b border-[#2a2a2a] flex items-center px-4 gap-4 bg-[#0a0a0a]">
        <button className="text-[#0077b6] hover:text-[#e0e0e0]">
          [TEMPLATE ▼]
        </button>
        <button
          onClick={() =>
            handleTemplate("# Price War\nWe will cut prices by 15%...")
          }
          className="text-[#505050] hover:text-[#e0e0e0]"
        >
          [PRICE WAR]
        </button>
        <button
          onClick={() =>
            handleTemplate("# R&D Push\nWe are allocating $500k to R&D...")
          }
          className="text-[#505050] hover:text-[#e0e0e0]"
        >
          [R&D PUSH]
        </button>
        <button
          onClick={() => handleTemplate("# Pivot\nWe are shifting focus to...")}
          className="text-[#505050] hover:text-[#e0e0e0]"
        >
          [PIVOT]
        </button>
        <div className="flex-1"></div>
        <button className="text-[#505050] hover:text-[#e0e0e0]">
          [? HELP]
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative flex overflow-hidden group">
        {/* Line Numbers Gutter */}
        <div
          className="w-[40px] shrink-0 border-r border-[#2a2a2a] bg-[#0a0a0a] text-[#505050] text-right py-[20px] px-2 select-none overflow-hidden"
          style={{
            transform: `translateY(-${scrollTop}px)`,
          }}
        >
          {lines.map((n) => (
            <div key={n} className={n === lineCount ? "text-[#808080]" : ""}>
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
          disabled={cooldownRemaining > 0}
          className="flex-1 w-full h-full bg-transparent outline-none resize-none p-[20px] leading-[1.6] placeholder:text-[#505050] focus:ring-1 focus:ring-inset focus:ring-[#0077b6]"
          placeholder="# Enter strategic directive here..."
          spellCheck={false}
        />

        {/* Character Counter */}
        <div
          className={`absolute bottom-4 right-4 font-bold ${isMaxChars ? "text-[#ff3333] animate-pulse" : isWarningChars ? "text-[#0077b6]" : "text-[#505050]"}`}
        >
          {charCount} / {maxChars}
        </div>

        {/* Cooldown Overlay */}
        {cooldownRemaining > 0 && (
          <div className="absolute inset-0 bg-[#0a0a0acc] flex items-center justify-center backdrop-blur-[1px] z-10">
            <div className="border-2 border-[#0077b6] p-8 text-center bg-[#0a0a0a] shadow-[0_0_20px_rgba(255,176,0,0.2)] animate-pulse">
              <div className="text-[#0077b6] mb-4 text-[16px] tracking-widest">
                BOARD REVIEWING DIRECTIVE
              </div>
              <div className="text-[#0077b6] text-[48px] font-bold tracking-widest mb-4">
                ██ {formatTime(cooldownRemaining)} ██
              </div>
              <div className="text-[#808080]">Trading still enabled</div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar (30px) */}
      <div className="h-[30px] shrink-0 border-t border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center px-4 justify-between text-[#808080] text-[11px]">
        <span>READY</span>
        <span>|</span>
        <span>LAST SAVE: {new Date().toLocaleTimeString()}</span>
        <span>|</span>
        <span className="flex items-center gap-2">
          CONFIDENCE: <span className="text-[#e0e0e0]">[████░░░░░░] 45%</span>
        </span>
      </div>

      {/* Submit Area (60px) */}
      <div className="h-[60px] shrink-0 bg-[#0a0a0a] p-1.5 flex">
        {cooldownRemaining > 0 ? (
          <button
            disabled
            className="w-full h-full bg-[#1a1a1a] text-[#505050] font-bold uppercase tracking-widest border border-[#2a2a2a]"
          >
            COOLDOWN ACTIVE - {formatTime(cooldownRemaining)}
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
            className="w-full h-full bg-[#0077b6] text-black font-bold uppercase tracking-[0.1em] hover:brightness-110 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            [ SUBMIT TO BOARD ]
          </button>
        )}
      </div>
    </div>
  );
}
