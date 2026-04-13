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

// #TODO: Replace fake data with real LLM-driven price history once the pricing
// worker populates PriceHistory rows. The fake data is only needed because
// new games start with no price history records in the DB.
//
// Actual logic to replace generateFakeHistory():
//
// const res = await api.getMarketHistory(ticker, "5m", 100);
// if (res.data_points && res.data_points.length > 0) {
//   return res.data_points.map((pt: any) => ({
//     time: Math.floor(new Date(pt.timestamp).getTime() / 1000) as Time,
//     open: pt.open,
//     high: pt.high,
//     low: pt.low,
//     close: pt.close,
//   }));
// }
// return []; // empty = no chart rendered
//
// When the periodic_price_sweep Celery task (runs every 30s) populates
// PriceHistory, the /market/history/{ticker} endpoint will return real OHLCV
// data bucketed by interval. At that point, remove generateFakeHistory()
// and use the real data directly. The live-update useEffect below already
// handles real-time candle updates from WebSocket price_update messages.

function generateFakeHistory(
  basePrice: number,
  points: number = 40,
): CandlestickData[] {
  const now = Math.floor(Date.now() / 1000);
  const interval = 5 * 60; // 5 minute candles
  const data: CandlestickData[] = [];
  let price = basePrice || 100;

  for (let i = points; i > 0; i--) {
    const time = (now - i * interval) as Time;
    const volatility = price * 0.02; // 2% volatility per candle
    const open = price;
    const change = (Math.random() - 0.48) * volatility; // slight upward bias
    const close = Math.max(1, open + change);
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low =
      Math.min(open, close) - Math.random() * volatility * 0.5;

    data.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(Math.max(1, low).toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });

    price = close;
  }

  return data;
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

  // Get current price for this ticker from WS state
  const currentTickerData = marketTickers.find((t) => t.ticker === ticker);
  const currentPrice = currentTickerData?.price || 100;

  // Initialize chart and fetch historical data
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
      },
      grid: {
        vertLines: { color: "rgba(0, 119, 182, 0.1)" },
        horzLines: { color: "rgba(0, 119, 182, 0.1)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(0, 119, 182, 0.3)",
      },
      rightPriceScale: {
        borderColor: "rgba(0, 119, 182, 0.3)",
      },
      crosshair: {
        mode: 0,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00c853",
      downColor: "#ff3333",
      borderVisible: false,
      wickUpColor: "#00c853",
      wickDownColor: "#ff3333",
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

    // Fetch data — try real history first, fall back to fake
    setIsLoading(true);
    setError(null);
    api
      .getMarketHistory(ticker, "5m", 100)
      .then((res) => {
        if (res.data_points && res.data_points.length > 0) {
          const formattedData: CandlestickData[] = res.data_points.map(
            (pt: any) => ({
              time: Math.floor(
                new Date(pt.timestamp).getTime() / 1000,
              ) as Time,
              open: pt.open,
              high: pt.high,
              low: pt.low,
              close: pt.close,
            }),
          );
          series.setData(formattedData);
        } else {
          // #TODO: Remove this fake data branch once pricing worker is active
          series.setData(generateFakeHistory(currentPrice));
        }
      })
      .catch(() => {
        // #TODO: Remove this fake data fallback once pricing worker is active
        series.setData(generateFakeHistory(currentPrice));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // Handle live updates — track OHLC within each 5-minute bucket
  useEffect(() => {
    if (!seriesRef.current || !marketTickers || marketTickers.length === 0)
      return;

    const updatedTicker = marketTickers.find((t) => t.ticker === ticker);
    if (!updatedTicker) return;

    const price = updatedTicker.price;
    const BUCKET_SECONDS = 5 * 60;
    const bucketTime = (Math.floor(Date.now() / 1000 / BUCKET_SECONDS) *
      BUCKET_SECONDS) as Time;

    const current = currentCandleRef.current;
    if (current && current.time === bucketTime) {
      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.close = price;
    } else {
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
    <div className="relative w-full h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-accent-blue)] z-10 bg-[var(--color-bg-darkest)]/80 text-[11px]">
          Loading...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-accent-rose)] z-10 bg-[var(--color-bg-darkest)]/80 text-[11px]">
          {error}
        </div>
      )}
      <div ref={chartContainerRef} className="flex-1 w-full h-full" />
    </div>
  );
}
