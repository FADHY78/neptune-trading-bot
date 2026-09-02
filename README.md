# 🚀 Neptune Trading Bot — Production React Dashboard

Neptune is an automated Deriv.com digit trading bot built with React, Vite, and WebSocket API integration.

## 🎯 Features

- **Deriv OAuth 2.0 & WebSocket Integration**: Modern OAuth 2.0 PKCE authentication (`auth.deriv.com`) and real-time streaming via `wss://ws.derivws.com/websockets/v3`.
- **Built-in Simulator Mode**: Test strategies, Martingale logic, and risk controls instantly without requiring an API token.
- **6 Built-in Strategy Presets**:
  - Differs 15 Combo Ultimate (Payout 9%)
  - Differs Contraction Connector (Payout 9%)
  - Differs 15 Combo Ultimate (Payout 5%)
  - Differs The Middle 5 Filter (Payout 9%)
  - Matches Sniper (Payout 76%)
  - Fold Max Over (Payout Rate 9% up to 70%)
- **Martingale Risk Engine**: Auto-multiplying stake progression on loss (`Stake × Factor`), capped at user-defined Max Stake.
- **Real-Time Digit Visualizer**: Dynamic bar chart visualizing digit frequency distribution (0–9) across the last 100 ticks.
- **Terminal Log Output**: Color-coded, auto-scrolling terminal logs with download session capability.
- **Web Audio Sound Cues**: Audio feedback for wins, losses, and system alerts.

## 🚀 Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local development server:
   ```bash
   npm run dev
   ```

3. Build production bundle:
   ```bash
   npm run build
   ```
