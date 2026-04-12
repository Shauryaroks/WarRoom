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
  const currentCandleRef = useRef<{
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

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

  // Handle live updates — track OHLC within each 5-minute bucket
  useEffect(() => {
    if (!seriesRef.current || !marketTickers || marketTickers.length === 0) return;

    const updatedTicker = marketTickers.find(
      (t: any) => t.ticker === ticker
    );
    if (!updatedTicker) return;

    const price = updatedTicker.price;
    const BUCKET_SECONDS = 5 * 60; // 5-minute buckets
    const bucketTime = (Math.floor(Date.now() / 1000 / BUCKET_SECONDS) * BUCKET_SECONDS) as Time;

    const current = currentCandleRef.current;
    if (current && current.time === bucketTime) {
      // Same bucket — update OHLC
      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.close = price;
    } else {
      // New bucket — start fresh candle
      currentCandleRef.current = {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    }

    seriesRef.current.update(currentCandleRef.current!);
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
