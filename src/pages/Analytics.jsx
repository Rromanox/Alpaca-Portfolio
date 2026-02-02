import { useState, useMemo, useEffect } from 'react';
import { getAllClosedOrders } from '../services/alpacaApi';
import { useApi, formatCurrency, formatPercent } from '../hooks/useApi';
import { PageLoader } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatCard } from '../components/StatCard';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { format, parseISO, startOfDay, eachDayOfInterval, subMonths } from 'date-fns';

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-dark-700 border border-dark-500 rounded-lg p-3 shadow-xl">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className={`font-semibold ${value >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatCurrency(value)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomLineTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dark-700 border border-dark-500 rounded-lg p-3 shadow-xl">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="text-white font-semibold">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export const Analytics = () => {
  const startDate = format(subMonths(new Date(), 6), 'yyyy-MM-dd');

  const { data: orders, loading, error, execute: fetchOrders } = useApi(
    () => getAllClosedOrders(new Date(startDate).toISOString(), null),
    [],
    true
  );

  // Calculate round trips using FIFO
  const roundTrips = useMemo(() => {
    if (!orders) return [];

    const ordersBySymbol = {};
    orders.filter(o => o.status === 'filled').forEach(order => {
      if (!ordersBySymbol[order.symbol]) {
        ordersBySymbol[order.symbol] = [];
      }
      ordersBySymbol[order.symbol].push(order);
    });

    const allRoundTrips = [];

    Object.entries(ordersBySymbol).forEach(([symbol, symbolOrders]) => {
      const sorted = symbolOrders.sort((a, b) => new Date(a.filled_at) - new Date(b.filled_at));
      const buyQueue = [];

      sorted.forEach(order => {
        const qty = parseFloat(order.filled_qty);
        const price = parseFloat(order.filled_avg_price);

        if (order.side === 'buy') {
          buyQueue.push({ qty, price, date: order.filled_at });
        } else if (order.side === 'sell' && buyQueue.length > 0) {
          let sellQty = qty;

          while (sellQty > 0 && buyQueue.length > 0) {
            const buy = buyQueue[0];
            const matchQty = Math.min(sellQty, buy.qty);

            const pl = (price - buy.price) * matchQty;
            const cost = buy.price * matchQty;

            allRoundTrips.push({
              symbol,
              buyPrice: buy.price,
              sellPrice: price,
              qty: matchQty,
              pl,
              plPercent: ((price - buy.price) / buy.price) * 100,
              cost,
              revenue: price * matchQty,
              buyDate: buy.date,
              sellDate: order.filled_at,
            });

            buy.qty -= matchQty;
            sellQty -= matchQty;

            if (buy.qty <= 0) {
              buyQueue.shift();
            }
          }
        }
      });
    });

    return allRoundTrips.sort((a, b) => new Date(a.sellDate) - new Date(b.sellDate));
  }, [orders]);

  // Performance metrics
  const metrics = useMemo(() => {
    if (roundTrips.length === 0) {
      return {
        totalTrades: 0,
        winners: 0,
        losers: 0,
        winRate: 0,
        totalPL: 0,
        avgWin: 0,
        avgLoss: 0,
        avgWinPercent: 0,
        avgLossPercent: 0,
        profitFactor: 0,
        largestWin: null,
        largestLoss: null,
        expectancy: 0,
      };
    }

    const winners = roundTrips.filter(rt => rt.pl >= 0);
    const losers = roundTrips.filter(rt => rt.pl < 0);

    const totalWins = winners.reduce((sum, rt) => sum + rt.pl, 0);
    const totalLosses = Math.abs(losers.reduce((sum, rt) => sum + rt.pl, 0));

    const avgWin = winners.length > 0 ? totalWins / winners.length : 0;
    const avgLoss = losers.length > 0 ? totalLosses / losers.length : 0;

    const avgWinPercent = winners.length > 0
      ? winners.reduce((sum, rt) => sum + rt.plPercent, 0) / winners.length
      : 0;
    const avgLossPercent = losers.length > 0
      ? Math.abs(losers.reduce((sum, rt) => sum + rt.plPercent, 0) / losers.length)
      : 0;

    const sortedByPL = [...roundTrips].sort((a, b) => b.pl - a.pl);
    const largestWin = sortedByPL[0];
    const largestLoss = sortedByPL[sortedByPL.length - 1];

    const winRate = roundTrips.length > 0 ? (winners.length / roundTrips.length) * 100 : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const expectancy = roundTrips.length > 0
      ? (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss)
      : 0;

    return {
      totalTrades: roundTrips.length,
      winners: winners.length,
      losers: losers.length,
      winRate,
      totalPL: roundTrips.reduce((sum, rt) => sum + rt.pl, 0),
      avgWin,
      avgLoss,
      avgWinPercent,
      avgLossPercent,
      profitFactor,
      largestWin,
      largestLoss,
      expectancy,
    };
  }, [roundTrips]);

  // Daily P/L data for bar chart
  const dailyPL = useMemo(() => {
    if (roundTrips.length === 0) return [];

    const dailyMap = new Map();

    roundTrips.forEach(rt => {
      const dateKey = format(parseISO(rt.sellDate), 'yyyy-MM-dd');
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + rt.pl);
    });

    // Fill in missing days
    const dates = Array.from(dailyMap.keys()).sort();
    if (dates.length === 0) return [];

    const startDate = parseISO(dates[0]);
    const endDate = parseISO(dates[dates.length - 1]);

    return eachDayOfInterval({ start: startDate, end: endDate }).map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        date: format(date, 'MMM d'),
        pl: dailyMap.get(dateKey) || 0,
      };
    });
  }, [roundTrips]);

  // Cumulative P/L data for line chart
  const cumulativePL = useMemo(() => {
    if (dailyPL.length === 0) return [];

    let cumulative = 0;
    return dailyPL.map(day => {
      cumulative += day.pl;
      return {
        date: day.date,
        cumulative,
      };
    });
  }, [dailyPL]);

  // Top performing and worst performing symbols
  const symbolPerformance = useMemo(() => {
    if (roundTrips.length === 0) return { best: [], worst: [] };

    const symbolMap = new Map();

    roundTrips.forEach(rt => {
      const current = symbolMap.get(rt.symbol) || { pl: 0, trades: 0 };
      symbolMap.set(rt.symbol, {
        pl: current.pl + rt.pl,
        trades: current.trades + 1,
      });
    });

    const sorted = Array.from(symbolMap.entries())
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.pl - a.pl);

    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse(),
    };
  }, [roundTrips]);

  if (loading && !orders) return <PageLoader />;
  if (error) return <ErrorMessage message={error} onRetry={fetchOrders} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Performance Analytics</h1>
        <p className="text-gray-400">Last 6 months of trading performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          subValue={`${metrics.winners}W / ${metrics.losers}L`}
          icon="🎯"
        />
        <StatCard
          label="Total P/L"
          value={formatCurrency(metrics.totalPL)}
          trend={metrics.totalPL}
          icon="💰"
        />
        <StatCard
          label="Profit Factor"
          value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          subValue="Wins / Losses ratio"
          icon="📊"
        />
        <StatCard
          label="Expectancy"
          value={formatCurrency(metrics.expectancy)}
          subValue="Per trade average"
          trend={metrics.expectancy}
          icon="📈"
        />
      </div>

      {/* Win/Loss Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Average Win</h3>
          <div className="text-3xl font-bold text-profit mb-2">
            {formatCurrency(metrics.avgWin)}
          </div>
          <div className="text-gray-400 text-sm">
            {formatPercent(metrics.avgWinPercent)} average return
          </div>
          {metrics.largestWin && (
            <div className="mt-4 p-3 bg-profit/10 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Best Trade</div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">{metrics.largestWin.symbol}</span>
                <span className="text-profit">{formatCurrency(metrics.largestWin.pl)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Average Loss</h3>
          <div className="text-3xl font-bold text-loss mb-2">
            -{formatCurrency(metrics.avgLoss)}
          </div>
          <div className="text-gray-400 text-sm">
            -{formatPercent(metrics.avgLossPercent)} average return
          </div>
          {metrics.largestLoss && metrics.largestLoss.pl < 0 && (
            <div className="mt-4 p-3 bg-loss/10 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Worst Trade</div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">{metrics.largestLoss.symbol}</span>
                <span className="text-loss">{formatCurrency(metrics.largestLoss.pl)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily P/L Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Daily P/L</h3>
        {dailyPL.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyPL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3a" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#2e2e3a' }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#2e2e3a' }}
                tickFormatter={(value) => `$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value.toFixed(0)}`}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                {dailyPL.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No trading data available
          </div>
        )}
      </div>

      {/* Cumulative P/L Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Cumulative P/L</h3>
        {cumulativePL.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumulativePL}>
              <defs>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3a" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#2e2e3a' }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#2e2e3a' }}
                tickFormatter={(value) => `$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value.toFixed(0)}`}
              />
              <Tooltip content={<CustomLineTooltip />} />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                fill="url(#colorCumulative)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No trading data available
          </div>
        )}
      </div>

      {/* Symbol Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performers</h3>
          {symbolPerformance.best.length > 0 ? (
            <div className="space-y-3">
              {symbolPerformance.best.map((item, idx) => (
                <div key={item.symbol} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm">#{idx + 1}</span>
                    <span className="font-semibold text-white">{item.symbol}</span>
                    <span className="text-xs text-gray-500">{item.trades} trades</span>
                  </div>
                  <span className="text-profit font-mono">{formatCurrency(item.pl)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Worst Performers</h3>
          {symbolPerformance.worst.filter(s => s.pl < 0).length > 0 ? (
            <div className="space-y-3">
              {symbolPerformance.worst.filter(s => s.pl < 0).map((item, idx) => (
                <div key={item.symbol} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm">#{idx + 1}</span>
                    <span className="font-semibold text-white">{item.symbol}</span>
                    <span className="text-xs text-gray-500">{item.trades} trades</span>
                  </div>
                  <span className="text-loss font-mono">{formatCurrency(item.pl)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No losing symbols!</p>
          )}
        </div>
      </div>

      {/* Trade Stats Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Trade Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-gray-400 text-sm mb-1">Total Trades</div>
            <div className="text-xl font-semibold text-white">{metrics.totalTrades}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Winning Trades</div>
            <div className="text-xl font-semibold text-profit">{metrics.winners}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Losing Trades</div>
            <div className="text-xl font-semibold text-loss">{metrics.losers}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Win/Loss Ratio</div>
            <div className="text-xl font-semibold text-white">
              {metrics.losers > 0 ? (metrics.winners / metrics.losers).toFixed(2) : '∞'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
