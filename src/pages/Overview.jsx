import { useState, useMemo } from 'react';
import { getAccount, getPortfolioHistory, getPositions } from '../services/alpacaApi';
import { useApi, formatCurrency, formatPercent } from '../hooks/useApi';
import { PageLoader } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatCard } from '../components/StatCard';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const TIMEFRAMES = [
  { label: '1D', period: '1D', timeframe: '5Min' },
  { label: '1W', period: '1W', timeframe: '15Min' },
  { label: '1M', period: '1M', timeframe: '1D' },
  { label: '3M', period: '3M', timeframe: '1D' },
  { label: '1Y', period: '1A', timeframe: '1D' },
  { label: 'ALL', period: 'all', timeframe: '1D' },
];

const CustomTooltip = ({ active, payload, label }) => {
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

export const Overview = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[0]); // 1D default

  const { data: account, loading: accountLoading, error: accountError, execute: refetchAccount } = useApi(getAccount, []);
  const { data: positions, loading: positionsLoading } = useApi(getPositions, []);
  const {
    data: portfolioHistory,
    loading: historyLoading,
    error: historyError,
    execute: fetchHistory
  } = useApi(
    () => getPortfolioHistory({ period: selectedTimeframe.period, timeframe: selectedTimeframe.timeframe }),
    [selectedTimeframe]
  );

  // Fetch ALL history to get starting balance
  const { data: allTimeHistory } = useApi(
    () => getPortfolioHistory({ period: 'all', timeframe: '1D' }),
    []
  );

  // Calculate starting balance and all-time P/L
  const { startingBalance, allTimePL, allTimePLPercent } = useMemo(() => {
    if (!allTimeHistory?.equity || allTimeHistory.equity.length === 0) {
      return { startingBalance: 0, allTimePL: 0, allTimePLPercent: 0 };
    }

    const firstEquity = allTimeHistory.equity[0];
    const currentEquity = allTimeHistory.equity[allTimeHistory.equity.length - 1];
    const pl = currentEquity - firstEquity;
    const plPercent = firstEquity > 0 ? (pl / firstEquity) * 100 : 0;

    return { startingBalance: firstEquity, allTimePL: pl, allTimePLPercent: plPercent };
  }, [allTimeHistory]);

  const chartData = useMemo(() => {
    if (!portfolioHistory?.timestamp || !portfolioHistory?.equity) return [];

    return portfolioHistory.timestamp.map((ts, idx) => ({
      timestamp: ts * 1000,
      equity: portfolioHistory.equity[idx],
      date: format(new Date(ts * 1000), selectedTimeframe.period === '1D' ? 'h:mm a' : 'MMM d'),
    }));
  }, [portfolioHistory, selectedTimeframe]);

  const { totalUnrealizedPL, totalUnrealizedPLPercent } = useMemo(() => {
    if (!positions) return { totalUnrealizedPL: 0, totalUnrealizedPLPercent: 0 };

    const total = positions.reduce((sum, pos) => sum + parseFloat(pos.unrealized_pl || 0), 0);
    const totalCost = positions.reduce((sum, pos) => {
      const qty = parseFloat(pos.qty);
      const avgEntry = parseFloat(pos.avg_entry_price);
      return sum + (qty * avgEntry);
    }, 0);

    const percent = totalCost > 0 ? (total / totalCost) * 100 : 0;

    return { totalUnrealizedPL: total, totalUnrealizedPLPercent: percent };
  }, [positions]);

  const { startEquity, endEquity, periodChange, periodChangePercent } = useMemo(() => {
    if (!chartData.length) return { startEquity: 0, endEquity: 0, periodChange: 0, periodChangePercent: 0 };

    const start = chartData[0].equity;
    const end = chartData[chartData.length - 1].equity;
    const change = end - start;
    const changePercent = start > 0 ? (change / start) * 100 : 0;

    return { startEquity: start, endEquity: end, periodChange: change, periodChangePercent: changePercent };
  }, [chartData]);

  const chartColor = periodChange >= 0 ? '#22c55e' : '#ef4444';

  if (accountLoading && !account) return <PageLoader />;
  if (accountError) return <ErrorMessage message={accountError} onRetry={refetchAccount} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Account Overview</h1>
        <p className="text-gray-400">Your portfolio at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          label="Starting Balance"
          value={formatCurrency(startingBalance)}
          icon="🏦"
        />
        <StatCard
          label="Portfolio Value"
          value={formatCurrency(account?.equity)}
          icon="💰"
        />
        <StatCard
          label="All-Time P/L"
          value={formatCurrency(allTimePL)}
          subValue={formatPercent(allTimePLPercent)}
          trend={allTimePL}
          icon="📊"
        />
        <StatCard
          label="Cash"
          value={formatCurrency(account?.cash)}
          icon="💵"
        />
        <StatCard
          label="Buying Power"
          value={formatCurrency(account?.buying_power)}
          icon="⚡"
        />
      </div>

      {/* Portfolio Chart */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Portfolio Equity</h2>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-white">
                {formatCurrency(endEquity || account?.equity)}
              </span>
              <span className={periodChange >= 0 ? 'text-profit' : 'text-loss'}>
                {periodChange >= 0 ? '+' : ''}{formatCurrency(periodChange)} ({formatPercent(periodChangePercent)})
              </span>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex gap-1 bg-dark-700 p-1 rounded-lg">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.label}
                onClick={() => setSelectedTimeframe(tf)}
                className={`tab ${selectedTimeframe.label === tf.label ? 'active' : ''}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        {historyLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="loading-spinner" />
          </div>
        ) : historyError ? (
          <div className="h-[300px] flex items-center justify-center">
            <ErrorMessage message={historyError} onRetry={() => fetchHistory()} />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
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
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                domain={['dataMin - 1000', 'dataMax + 1000']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={chartColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEquity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No data available for this timeframe
          </div>
        )}
      </div>

      {/* Additional Account Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Account Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Account Status</span>
              <span className={`font-medium ${account?.status === 'ACTIVE' ? 'text-profit' : 'text-yellow-400'}`}>
                {account?.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pattern Day Trader</span>
              <span className="text-white">{account?.pattern_day_trader ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Day Trade Count</span>
              <span className="text-white">{account?.daytrade_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Long Market Value</span>
              <span className="text-white">{formatCurrency(account?.long_market_value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Short Market Value</span>
              <span className="text-white">{formatCurrency(account?.short_market_value)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Margin Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Multiplier</span>
              <span className="text-white">{account?.multiplier}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Initial Margin</span>
              <span className="text-white">{formatCurrency(account?.initial_margin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Maintenance Margin</span>
              <span className="text-white">{formatCurrency(account?.maintenance_margin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Regt Buying Power</span>
              <span className="text-white">{formatCurrency(account?.regt_buying_power)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Daytrading Buying Power</span>
              <span className="text-white">{formatCurrency(account?.daytrading_buying_power)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
