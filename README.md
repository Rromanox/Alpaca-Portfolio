# Alpaca Portfolio Dashboard

A modern, responsive portfolio dashboard for Alpaca Trading API. Track your positions, analyze trade history, and view performance metrics.

## Features

- **Account Overview** - View equity, buying power, cash, and portfolio value with interactive equity charts
- **Positions** - Real-time view of all open positions with sortable columns and P/L tracking
- **Trade History** - Complete history of closed orders with FIFO-based realized P/L calculations
- **Performance Analytics** - Win rate, profit factor, daily P/L charts, and cumulative performance

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- Recharts for data visualization
- React Router with HashRouter (GitHub Pages compatible)

## Getting Started

### Prerequisites

- Node.js 18+
- Alpaca API keys ([Get them here](https://app.alpaca.markets))

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

## Usage

1. Open the app
2. Enter your Alpaca API Key ID and Secret Key
3. Select Paper or Live trading mode
4. Click "Connect Account"

Your API keys are stored locally in your browser's localStorage and are never sent anywhere except directly to Alpaca's API.

## Security

- All API calls are made directly from your browser to Alpaca's servers
- No backend server - your credentials never touch a third-party server
- Keys are stored in localStorage (clear browser data to remove)

## License

MIT
