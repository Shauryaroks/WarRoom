"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  CandlestickSeries,
} from "lightweight-charts";
import { api } from "@/lib/api";
import { useWebSocket } from "@/contexts/WebSocketContext";

interface CandlestickChartProps {
  ticker: string;
}

export function CandlestickChart({ ticker }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { marketTickers } = useWebSocket();

  // Initialize chart and fetch historical data
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#0077b6",
      },
      grid: {
        vertLines: { color: "rgba(0, 119, 182, 0.2)" },
        horzLines: { color: "rgba(0, 119, 182, 0.2)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(0, 119, 182, 0.4)",
      },
      rightPriceScale: {
        borderColor: "rgba(0, 119, 182, 0.4)",
      },
      crosshair: {
        mode: 0,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Fetch data
    setIsLoading(true);
    setError(null);
    api
      .getMarketHistory(ticker, "5m", 100)
      .then((res) => {
        if (res.data_points) {
          const formattedData: CandlestickData[] = res.data_points.map(
            (pt: any) => {
              // Lightweight charts requires time in seconds (UNIX timestamp)
              const time = Math.floor(
                new Date(pt.timestamp).getTime() / 1000
              ) as Time;
              return {
                time,
                open: pt.open,
                high: pt.high,
                low: pt.low,
                close: pt.close,
              };
            }
          );
          series.setData(formattedData);
        }
      })
      .catch((err) => {
        console.error("Failed to load historical data", err);
        setError("Failed to load market history.");
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker]);

  // Handle live updates
  useEffect(() => {
    if (!seriesRef.current || !marketTickers || marketTickers.length === 0) return;

    // Find the latest price for this ticker from marketTickers
    const updatedTicker = marketTickers.find(
      (t: any) => t.ticker === ticker
    );
    if (!updatedTicker) return;

    // We only have the current price, not the full OHLC for the current candle.
    // For a real app, the WS might broadcast candle updates or we'd manage the candle locally.
    // Here we'll just update the last candle's close if we have data.
    const price = updatedTicker.price;
    const now = new Date();
    now.setSeconds(0, 0); // floor to minute or whatever interval
    const time = Math.floor(now.getTime() / 1000) as Time;

    // Workaround: lightweight charts data.update() requires open, high, low, close.
    // We can't easily retrieve the *last* candle data synchronously without keeping track of it.
    // A simplified update:
    seriesRef.current.update({
      time, // This might just append or overwrite if time matches
      open: price, // Ideal would be the actual open
      high: price,
      low: price,
      close: price,
    });
  }, [marketTickers, ticker]);

  return (
    <div className="relative w-full h-full flex flex-col min-h-[300px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-[#0077b6] z-10 bg-[#0a0a0a]/80">
          Loading Data...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 z-10 bg-[#0a0a0a]/80">
          {error}
        </div>
      )}
      <div ref={chartContainerRef} className="flex-1 w-full h-full" />
    </div>
  );
}
