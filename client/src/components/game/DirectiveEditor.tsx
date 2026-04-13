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

  // Use both dossier cooldown status and local countdown
  const activeCooldown =
    dossier?.cooldown_status?.active || cooldownRemaining > 0;
  const displayCooldown = Math.max(
    cooldownRemaining,
    dossier?.cooldown_status?.seconds_remaining || 0,
  );

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

  const handleSaveDraft = () => {
    localStorage.setItem(STORAGE_KEY, directive);
  };

  const lineCount = directive.split("\n").length;
  const lines = Array.from(
    { length: Math.max(12, lineCount) },
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

  const complexityScore = Math.min(100, Math.floor((charCount / 500) * 100));

  return (
    <div className="flex flex-col h-full w-full font-mono text-[13px] bg-[var(--color-bg-darkest)] text-[var(--color-text-primary)] relative border-l border-r border-[var(--color-outline)]">
      {/* Toolbar */}
      <div className="h-[40px] shrink-0 border-b border-[var(--color-outline)] flex items-center px-4 gap-4 bg-[var(--color-bg-dark)] text-[var(--color-text-secondary)] text-[12px]">
        <button className="hover:text-[var(--color-text-primary)] transition-colors uppercase">[TEMPLATE ▼]</button>
        <button
          onClick={() =>
            handleTemplate("# Price War\nWe will cut prices by 15%...")
          }
          className="hover:text-[var(--color-text-primary)] transition-colors uppercase"
        >
          [PRICE WAR]
        </button>
        <button
          onClick={() =>
            handleTemplate("# R&D Push\nWe are allocating $500k to R&D...")
          }
          className="hover:text-[var(--color-text-primary)] transition-colors uppercase"
        >
          [R&D PUSH]
        </button>
        <button
          onClick={() => handleTemplate("# Pivot\nWe are shifting focus to...")}
          className="hover:text-[var(--color-text-primary)] transition-colors uppercase"
        >
          [PIVOT]
        </button>
        <div className="flex-1"></div>
        <button className="hover:text-[var(--color-text-primary)] transition-colors uppercase">[? HELP]</button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative flex overflow-hidden group">
        {/* Line Numbers Gutter */}
        <div
          className="w-[40px] shrink-0 border-r border-[var(--color-outline)] bg-[var(--color-bg-darkest)] text-[var(--color-text-muted)] text-right py-[20px] px-2 select-none overflow-hidden"
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {lines.map((n) => (
            <div key={n} className={n === lineCount ? "text-[var(--color-text-secondary)] font-bold" : ""}>
              {n.toString().padStart(2, '0')}
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
          className="flex-1 w-full h-full bg-transparent outline-none resize-none p-[20px] leading-[1.6] placeholder:text-[var(--color-text-muted)] focus:ring-0 text-[var(--color-text-primary)]"
          placeholder={"// INIT_STRATEGY: QUARTER_03\n# PRICING STRATEGY & COST LEADERSHIP\n- \n- "}
          spellCheck={false}
        />

        {/* Character Counter */}
        <div
          className={`absolute bottom-4 right-4 font-bold ${isMaxChars ? "text-red-500 animate-pulse" : isWarningChars ? "text-red-400" : "text-[var(--color-text-muted)]"}`}
        >
          {charCount} / {maxChars}
        </div>

        {/* Cooldown Overlay */}
        {activeCooldown && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-sm">
            <div className="border border-red-500/50 p-8 text-center bg-[var(--color-bg-darkest)] shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <div className="text-red-500 mb-4 text-[16px] tracking-widest font-bold">
                [ BOARD REVIEWING DIRECTIVE ]
              </div>
              <div className="text-red-500 text-[48px] font-bold tracking-widest mb-4">
                {formatTime(displayCooldown)}
              </div>
              <div className="text-red-400 text-[12px] tracking-widest animate-pulse">
                COOLDOWN ACTIVE
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-[30px] shrink-0 border-t border-[var(--color-outline)] bg-[var(--color-bg-darkest)] flex items-center px-4 justify-between text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider">
        <span>READY</span>
        <span>|</span>
        <span className="flex items-center gap-2">
          COMPLEXITY:
          <div className="w-[100px] h-[6px] bg-[var(--color-bg-dark)] border border-[var(--color-outline)] relative">
            <div className="absolute top-0 left-0 h-full bg-[var(--color-accent-blue)] transition-all duration-300" style={{ width: `${complexityScore}%` }}></div>
          </div>
          <span className="text-[var(--color-accent-blue)] font-bold">SECURE</span>
        </span>
        {activeCooldown && (
          <>
            <span>|</span>
            <span className="text-red-500 font-bold animate-pulse">COOLDOWN: {formatTime(displayCooldown)} REMAINING</span>
          </>
        )}
      </div>

      {/* Submit Area */}
      <div className="h-[60px] shrink-0 bg-[var(--color-bg-dark)] p-2 flex gap-2 border-t border-[var(--color-outline)]">
        <button
          onClick={handleSaveDraft}
          disabled={activeCooldown || isSubmitting}
          className="flex-1 border border-[var(--color-outline)] bg-[var(--color-bg-darkest)] text-[var(--color-text-primary)] font-bold uppercase tracking-widest hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          [ SAVE DRAFT ]
        </button>
        {activeCooldown ? (
          <button
            disabled
            className="flex-[2] bg-[var(--color-bg-darkest)] text-red-500 font-bold uppercase tracking-widest border border-red-500/50 opacity-50 cursor-not-allowed"
          >
            COOLDOWN ACTIVE
          </button>
        ) : isSubmitting ? (
          <button
            disabled
            className="flex-[2] bg-white text-black font-bold uppercase tracking-widest animate-pulse"
          >
            TRANSMITTING... ▓▒░
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!directive.trim()}
            className="flex-[2] bg-white text-black font-bold uppercase tracking-[0.1em] hover:bg-gray-200 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            SUBMIT TO BOARD
          </button>
        )}
      </div>
    </div>
  );
}
