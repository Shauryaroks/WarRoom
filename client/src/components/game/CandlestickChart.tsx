"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { CandleData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CandlestickChartProps {
  data: CandleData[]; // From market store candles[selectedCompanyId]
  className?: string;
}

export function CandlestickChart({ data, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const prevDataLengthRef = useRef<number>(0);
  const prevFirstTimeRef = useRef<number | null>(null);

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0e0e0e" },
        textColor: "#89919d",
      },
      grid: {
        vertLines: { color: "rgba(33,150,243,0.03)" },
        horzLines: { color: "rgba(33,150,243,0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: "#2a2a2a",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#2a2a2a",
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#40e56c",
      downColor: "#FF1744",
      wickUpColor: "#40e56c",
      wickDownColor: "#FF1744",
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // ResizeObserver for responsive sizing
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);

    // Reset data tracking refs
    prevDataLengthRef.current = 0;
    prevFirstTimeRef.current = null;

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push real data into the series. Empty input clears the chart — no placeholder/random series.
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (!data || data.length === 0) {
      seriesRef.current.setData([]);
      prevDataLengthRef.current = 0;
      prevFirstTimeRef.current = null;
      return;
    }

    const formattedData = data.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const prevLength = prevDataLengthRef.current;
    const prevFirstTime = prevFirstTimeRef.current;
    const currentFirstTime = data[0].time;

    const isCompanySwitch =
      prevFirstTime !== null && currentFirstTime !== prevFirstTime;
    const isSingleUpdate =
      !isCompanySwitch &&
      prevLength > 0 &&
      (data.length === prevLength || data.length === prevLength + 1);

    if (isSingleUpdate) {
      // O(1) update: new candle appended or last candle updated
      const lastCandle = formattedData[formattedData.length - 1];
      seriesRef.current.update(lastCandle);
    } else {
      // Full data set (company switch or initial load or backfill)
      seriesRef.current.setData(formattedData);
      chartRef.current.timeScale().fitContent();
    }

    prevDataLengthRef.current = data.length;
    prevFirstTimeRef.current = currentFirstTime;
  }, [data]);

  const isEmpty = !data || data.length === 0;

  return (
    <div className={cn("relative w-full h-full min-h-[300px]", className)}>
      <div ref={containerRef} className="w-full h-full" />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs tracking-widest text-[#404752] uppercase">
            WAITING FOR PRICE TICKS...
          </span>
        </div>
      )}
    </div>
  );
}
