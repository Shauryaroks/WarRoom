<!-- generated-by: gsd-doc-writer -->

# Client Application Overview

This document provides an overview of the frontend client application located in the `client/` directory.

## Overview

The `client` is a Next.js application using the App Router (`app/` directory). It provides the user interface for the Complex case competition platform, serving both competing teams and administrators. The application is designed for real-time reactivity, relying on WebSocket connections for live game state updates, stock market movements, and activity broadcasts.

## Directory Structure

The `client/src/` directory is organized as follows:

- **`app/`**: Contains the Next.js routes, layouts, and page components.
  - `admin/`: Admin dashboard and controls.
  - `auth/`: Login and registration pages.
  - `game/`: Main gameplay interface (market, portfolio, solutions).
  - `leaderboard/`: Public-facing leaderboard.
  - `lobby/`: Pre-game waiting area.
- **`components/`**: Reusable React components, organized by feature (`admin`, `game`, `lobby`, `ui`). Includes a robust set of `ui` components (likely based on shadcn/ui or base-ui).
- **`hooks/`**: Custom React hooks.
  - `use-websocket.ts`: Critical hook managing the persistent WebSocket connection, handling reconnection logic, and dispatching incoming messages to Zustand stores.
  - `use-live-elapsed.ts`: Utility hook for real-time timers.
- **`lib/`**: Core utilities, API clients, and type definitions.
  - `api.ts`: Centralized HTTP client for all REST endpoints.
  - `types.ts`: Shared TypeScript interfaces and types mapping to backend models.
  - `schemas.ts`: Zod schemas for validation.
  - `utils.ts`: Generic utility functions (e.g., `cn` for Tailwind class merging).
- **`stores/`**: Zustand state management stores.

## State Management

The application heavily utilizes [Zustand](https://github.com/pmndrs/zustand) for centralized, reactive global state. The state is divided into focused slices:

- **`auth-store.ts`**: Manages user authentication status and token storage.
- **`game-store.ts`**: Manages overarching game state (current phase, round, timing).
- **`market-store.ts`**: Manages real-time stock prices, historical price data for charts, and company information.
- **`portfolio-store.ts` / `trading-store.ts`**: Manages the user's current holdings and trade execution states.
- **`solutions-store.ts` / `decisions-store.ts`**: Manages the submission and evaluation status of business solutions.
- **`admin-store.ts`**: Manages data specific to the admin dashboard (e.g., pending evaluations, team management).

Zustand stores are frequently updated directly by the `use-websocket.ts` hook upon receiving server broadcasts, ensuring the UI remains perfectly synced with the backend without polling.

## Data Fetching & Real-time Updates

- **REST API (`lib/api.ts`)**: Used for transactional operations (login, submitting a trade, submitting a solution, fetching initial state).
- **WebSockets (`hooks/use-websocket.ts`)**: Used for all live updates. The backend broadcasts game state changes, price ticks, news events, and evaluation results. The client listens to these events and mutates the Zustand stores directly.

## UI and Styling

- **Tailwind CSS (v4)**: Used for all styling.
- **Components**: A mix of custom components and pre-built UI primitives.
- **Charting**: Uses `lightweight-charts` for rendering high-performance, Bloomberg-style candlestick and line charts for the stock market features.
- **Icons**: `lucide-react` is used for iconography.
