"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";

interface GameContextType {
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  isTradeModalOpen: boolean;
  setIsTradeModalOpen: (isOpen: boolean) => void;
  isFeedbackModalOpen: boolean;
  tradePreset: number | null;
  setTradePreset: (preset: number | null) => void;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  cooldownRemaining: number;
  setCooldownRemaining: (seconds: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [tradePreset, setTradePreset] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tick down cooldownRemaining every second
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (cooldownRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cooldownRemaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameContext.Provider
      value={{
        selectedTicker,
        setSelectedTicker,
        isTradeModalOpen,
        setIsTradeModalOpen,
        isFeedbackModalOpen,
        setIsFeedbackModalOpen,
        tradePreset,
        setTradePreset,
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
