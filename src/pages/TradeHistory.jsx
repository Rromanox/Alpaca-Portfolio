import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllClosedOrders } from '../services/alpacaApi';
import { useApi, formatCurrency, formatDateTime, formatNumber } from '../hooks/useApi';
import { PageLoader } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { format, subMonths, parseISO } from 'date-fns';

export const TradeHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || '';

  const [symbolFilter, setSymbolFilter] = useState(initialSymbol);
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [sideFilter, setSideFilter] = useState('all');

  const { data: orders, loading, error, execute: fetchOrders } = useApi(
    () => getAllClosedOrders(
      dateRange.start ? new Date(dateRange.start).toISOString() : null,
      dateRange.end ? new Date(dateRange.end + 'T23:59:59').toISOString() : null
    ),
    [],
    false
  );

  useEffect(() => {
    fetchOrders();
  }, []);

  // Get unique symbols for filter dropdown
  const uniqueSymbols = useMemo(() => {
    if (!orders) return [];
    const symbols = [...new Set(orders.map(o => o.symbol))].sort();
    return symbols;
  }, [orders]);

  // Filter and process orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter(order => {
      // Only show filled orders
      if (order.status !== 'filled') return false;

      // Symbol filter
      if (symbolFilter && order.symbol !== symbolFilter) return false;

      // Side filter
      if (sideFilter !== 'all' && order.side !== sideFilter) return false;

      return true;
    }).sort((a, b) => new Date(b.filled_at) - new Date(a.filled_at));
  }, [orders, symbolFilter, sideFilter]);

  // Calculate round trips and realized P/L using FIFO
  const { roundTrips, symbolStats } = useMemo(() => {
    if (!orders) return { roundTrips: [], symbolStats: {} };

    // Group orders by symbol
    const ordersBySymbol = {};
    orders.filter(o => o.status === 'filled').forEach(order => {
      if (!ordersBySymbol[order.symbol]) {
        ordersBySymbol[order.symbol] = [];
      }
      ordersBySymbol[order.symbol].push(order);
    });

    const allRoundTrips = [];
    const stats = {};

    Object.entries(ordersBySymbol).forEach(([symbol, symbolOrders]) => {
      // Sort by filled date
      const sorted = symbolOrders.sort((a, b) => new Date(a.filled_at) - new Date(b.filled_at));

      const buyQueue = []; // FIFO queue for buys
      let realizedPL = 0;
      let winCount = 0;
      let lossCount = 0;

      sorted.forEach(order => {
        const qty = parseFloat(order.filled_qty);
        const price = parseFloat(order.filled_avg_price);
        const side = order.side;

        if (side === 'buy') {
          // Add to buy queue
          buyQueue.push({ qty, price, date: order.filled_at, order });
        } else if (side === 'sell' && buyQueue.length > 0) {
          // Match with buys FIFO
          let sellQty = qty;

          while (sellQty > 0 && buyQueue.length > 0) {
            const buy = buyQueue[0];
            const matchQty = Math.min(sellQty, buy.qty);

            const pl = (price - buy.price) * matchQty;
            realizedPL += pl;

            if (pl >= 0) winCount++;
            else lossCount++;

            allRoundTrips.push({
              symbol,
              buyPrice: buy.price,
              sellPrice: price,
              qty: matchQty,
              pl,
              plPercent: ((price - buy.price) / buy.price) * 100,
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

      stats[symbol] = {
        realizedPL,
        trades: winCount + lossCount,
        winCount,
        lossCount,
        winRate: winCount + lossCount > 0 ? (winCount / (winCount + lossCount)) * 100 : 0,
      };
    });

    return { roundTrips: allRoundTrips, symbolStats: stats };
  }, [orders]);

  // Filter round trips
  const filteredRoundTrips = useMemo(() => {
    if (!symbolFilter) return roundTrips;
    return roundTrips.filter(rt => rt.symbol === symbolFilter);
  }, [roundTrips, symbolFilter]);

  // Total stats for filtered symbol
  const totalStats = useMemo(() => {
    if (symbolFilter && symbolStats[symbolFilter]) {
      return symbolStats[symbolFilter];
    }

    // Sum all symbols
    return Object.values(symbolStats).reduce((acc, s) => ({
      realizedPL: acc.realizedPL + s.realizedPL,
      trades: acc.trades + s.trades,
      winCount: acc.winCount + s.winCount,
      lossCount: acc.lossCount + s.lossCount,
      winRate: 0, // Calculate after
    }), { realizedPL: 0, trades: 0, winCount: 0, lossCount: 0, winRate: 0 });
  }, [symbolStats, symbolFilter]);

  const handleSearch = () => {
    fetchOrders();
  };

  const handleSymbolChange = (symbol) => {
    setSymbolFilter(symbol);
    if (symbol) {
      setSearchParams({ symbol });
    } else {
      setSearchParams({});
    }
  };

  if (loading && !orders) return <PageLoader />;
  if (error) return <ErrorMessage message={error} onRetry={fetchOrders} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Trade History</h1>
        <p className="text-gray-400">View your closed orders and realized P/L</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Symbol Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Symbol</label>
            <select
              value={symbolFilter}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="input"
            >
              <option value="">All Symbols</option>
              {uniqueSymbols.map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>

          {/* Side Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Side</label>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value)}
              className="input"
            >
              <option value="all">All</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">From Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="input"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">To Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="input"
            />
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button onClick={handleSearch} className="btn-primary w-full">
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Orders</div>
          <div className="text-xl font-semibold text-white">{filteredOrders.length}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Round Trips</div>
          <div className="text-xl font-semibold text-white">{filteredRoundTrips.length}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Win Rate</div>
          <div className="text-xl font-semibold text-white">
            {totalStats.trades > 0
              ? `${((totalStats.winCount / totalStats.trades) * 100).toFixed(1)}%`
              : '-'}
          </div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Realized P/L</div>
          <div className={`text-xl font-semibold ${totalStats.realizedPL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(totalStats.realizedPL)}
          </div>
        </div>
      </div>

      {/* Symbol P/L Summary */}
      {!symbolFilter && Object.keys(symbolStats).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">P/L by Symbol</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {Object.entries(symbolStats)
              .sort((a, b) => b[1].realizedPL - a[1].realizedPL)
              .map(([symbol, stats]) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolChange(symbol)}
                  className="p-3 bg-dark-700 hover:bg-dark-600 rounded-lg text-left transition-colors"
                >
                  <div className="font-semibold text-white">{symbol}</div>
                  <div className={`text-sm ${stats.realizedPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(stats.realizedPL)}
                  </div>
                  <div className="text-xs text-gray-500">{stats.trades} trades</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Orders Table */}
      {filteredOrders.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-dark-600">
            <h3 className="font-semibold text-white">Order History</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Filled Price</th>
                  <th className="text-right">Total</th>
                  <th>Filled At</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 100).map((order) => {
                  const qty = parseFloat(order.filled_qty);
                  const price = parseFloat(order.filled_avg_price);
                  const total = qty * price;
                  const isBuy = order.side === 'buy';

                  return (
                    <tr key={order.id}>
                      <td className="font-semibold text-white">{order.symbol}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isBuy ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                        }`}>
                          {order.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-gray-400 text-sm">{order.type}</td>
                      <td className="text-right font-mono">{formatNumber(qty, qty % 1 === 0 ? 0 : 4)}</td>
                      <td className="text-right font-mono">{formatCurrency(price)}</td>
                      <td className="text-right font-mono">{formatCurrency(total)}</td>
                      <td className="text-gray-400 text-sm">{formatDateTime(order.filled_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length > 100 && (
            <div className="p-4 text-center text-gray-500 text-sm border-t border-dark-600">
              Showing first 100 of {filteredOrders.length} orders
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <span className="text-4xl mb-4 block">📭</span>
          <h3 className="text-lg font-semibold text-white mb-2">No Orders Found</h3>
          <p className="text-gray-400">Try adjusting your filters or date range.</p>
        </div>
      )}

      {/* Round Trips Table */}
      {filteredRoundTrips.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-dark-600">
            <h3 className="font-semibold text-white">Round Trip Analysis (FIFO)</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Buy Price</th>
                  <th className="text-right">Sell Price</th>
                  <th className="text-right">P/L</th>
                  <th className="text-right">P/L %</th>
                  <th>Buy Date</th>
                  <th>Sell Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoundTrips.slice(0, 50).map((rt, idx) => {
                  const isProfit = rt.pl >= 0;
                  return (
                    <tr key={`${rt.symbol}-${idx}`}>
                      <td className="font-semibold text-white">{rt.symbol}</td>
                      <td className="text-right font-mono">{formatNumber(rt.qty, rt.qty % 1 === 0 ? 0 : 4)}</td>
                      <td className="text-right font-mono">{formatCurrency(rt.buyPrice)}</td>
                      <td className="text-right font-mono">{formatCurrency(rt.sellPrice)}</td>
                      <td className={`text-right font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}{formatCurrency(rt.pl)}
                      </td>
                      <td className={`text-right font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}{rt.plPercent.toFixed(2)}%
                      </td>
                      <td className="text-gray-400 text-sm">{formatDateTime(rt.buyDate)}</td>
                      <td className="text-gray-400 text-sm">{formatDateTime(rt.sellDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredRoundTrips.length > 50 && (
            <div className="p-4 text-center text-gray-500 text-sm border-t border-dark-600">
              Showing first 50 of {filteredRoundTrips.length} round trips
            </div>
          )}
        </div>
      )}
    </div>
  );
};
