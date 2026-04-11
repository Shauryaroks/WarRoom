"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

/**
 * The GameContext encapsulates UI-level states relevant specifically to the player's 
 * session that are not directly dictated by the server payload but affect user flow, 
 * such as which ticker is currently selected for trading, or whether certain modal overlays are open.
 */
interface GameContextType {
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  isTradeModalOpen: boolean;
  setIsTradeModalOpen: (isOpen: boolean) => void;
  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  cooldownRemaining: number;
  setCooldownRemaining: (seconds: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

/**
 * Provides the GameContext state to its children.
 * 
 * @param {Object} props - React props.
 * @param {ReactNode} props.children - The children components to be wrapped.
 * @returns A context provider component.
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  return (
    <GameContext.Provider
      value={{
        selectedTicker,
        setSelectedTicker,
        isTradeModalOpen,
        setIsTradeModalOpen,
        isFeedbackModalOpen,
        setIsFeedbackModalOpen,
        cooldownRemaining,
        setCooldownRemaining,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
}
