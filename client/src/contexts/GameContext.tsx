"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

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
