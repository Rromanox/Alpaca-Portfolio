import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPositions } from '../services/alpacaApi';
import { useApi, formatCurrency, formatPercent, formatNumber } from '../hooks/useApi';
import { PageLoader } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

const SORT_OPTIONS = {
  symbol: (a, b) => a.symbol.localeCompare(b.symbol),
  qty: (a, b) => parseFloat(a.qty) - parseFloat(b.qty),
  avg_entry_price: (a, b) => parseFloat(a.avg_entry_price) - parseFloat(b.avg_entry_price),
  current_price: (a, b) => parseFloat(a.current_price) - parseFloat(b.current_price),
  market_value: (a, b) => parseFloat(a.market_value) - parseFloat(b.market_value),
  cost_basis: (a, b) => {
    const costA = parseFloat(a.qty) * parseFloat(a.avg_entry_price);
    const costB = parseFloat(b.qty) * parseFloat(b.avg_entry_price);
    return costA - costB;
  },
  unrealized_pl: (a, b) => parseFloat(a.unrealized_pl) - parseFloat(b.unrealized_pl),
  unrealized_plpc: (a, b) => parseFloat(a.unrealized_plpc) - parseFloat(b.unrealized_plpc),
};

export const Positions = () => {
  const navigate = useNavigate();
  const { data: positions, loading, error, execute: refetch } = useApi(getPositions, []);
  const [sortBy, setSortBy] = useState('symbol');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedPositions = useMemo(() => {
    if (!positions) return [];

    const sorted = [...positions].sort(SORT_OPTIONS[sortBy] || SORT_OPTIONS.symbol);
    return sortAsc ? sorted : sorted.reverse();
  }, [positions, sortBy, sortAsc]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(true);
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return '↕';
    return sortAsc ? '↑' : '↓';
  };

  const totals = useMemo(() => {
    if (!positions) return { marketValue: 0, costBasis: 0, unrealizedPL: 0 };

    return positions.reduce((acc, pos) => {
      const qty = parseFloat(pos.qty);
      const avgEntry = parseFloat(pos.avg_entry_price);
      const costBasis = qty * avgEntry;

      return {
        marketValue: acc.marketValue + parseFloat(pos.market_value || 0),
        costBasis: acc.costBasis + costBasis,
        unrealizedPL: acc.unrealizedPL + parseFloat(pos.unrealized_pl || 0),
      };
    }, { marketValue: 0, costBasis: 0, unrealizedPL: 0 });
  }, [positions]);

  if (loading && !positions) return <PageLoader />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Current Positions</h1>
          <p className="text-gray-400">
            {positions?.length || 0} open position{positions?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-primary flex items-center gap-2"
        >
          <span>🔄</span>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Market Value</div>
          <div className="text-xl font-semibold text-white">{formatCurrency(totals.marketValue)}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Cost Basis</div>
          <div className="text-xl font-semibold text-white">{formatCurrency(totals.costBasis)}</div>
        </div>
        <div className="card">
          <div className="text-gray-400 text-sm mb-1">Total Unrealized P/L</div>
          <div className={`text-xl font-semibold ${totals.unrealizedPL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(totals.unrealizedPL)}
            <span className="text-sm ml-2">
              ({formatPercent(totals.costBasis > 0 ? (totals.unrealizedPL / totals.costBasis) * 100 : 0)})
            </span>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      {positions?.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('symbol')}>
                    Symbol {getSortIcon('symbol')}
                  </th>
                  <th onClick={() => handleSort('qty')} className="text-right">
                    Qty {getSortIcon('qty')}
                  </th>
                  <th onClick={() => handleSort('avg_entry_price')} className="text-right">
                    Avg Entry {getSortIcon('avg_entry_price')}
                  </th>
                  <th onClick={() => handleSort('current_price')} className="text-right">
                    Current {getSortIcon('current_price')}
                  </th>
                  <th onClick={() => handleSort('cost_basis')} className="text-right">
                    Cost Basis {getSortIcon('cost_basis')}
                  </th>
                  <th onClick={() => handleSort('market_value')} className="text-right">
                    Market Value {getSortIcon('market_value')}
                  </th>
                  <th onClick={() => handleSort('unrealized_pl')} className="text-right">
                    P/L ($) {getSortIcon('unrealized_pl')}
                  </th>
                  <th onClick={() => handleSort('unrealized_plpc')} className="text-right">
                    P/L (%) {getSortIcon('unrealized_plpc')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((position) => {
                  const qty = parseFloat(position.qty);
                  const avgEntry = parseFloat(position.avg_entry_price);
                  const costBasis = qty * avgEntry;
                  const unrealizedPL = parseFloat(position.unrealized_pl);
                  const unrealizedPLPC = parseFloat(position.unrealized_plpc) * 100;
                  const isProfit = unrealizedPL >= 0;

                  return (
                    <tr
                      key={position.asset_id}
                      onClick={() => navigate(`/history?symbol=${position.symbol}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{position.symbol}</span>
                          <span className="text-xs text-gray-500 uppercase">{position.side}</span>
                        </div>
                      </td>
                      <td className="text-right font-mono">{formatNumber(qty, qty % 1 === 0 ? 0 : 4)}</td>
                      <td className="text-right font-mono">{formatCurrency(avgEntry)}</td>
                      <td className="text-right font-mono">{formatCurrency(position.current_price)}</td>
                      <td className="text-right font-mono">{formatCurrency(costBasis)}</td>
                      <td className="text-right font-mono">{formatCurrency(position.market_value)}</td>
                      <td className={`text-right font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}{formatCurrency(unrealizedPL)}
                      </td>
                      <td className={`text-right font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {formatPercent(unrealizedPLPC)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <span className="text-4xl mb-4 block">📭</span>
          <h3 className="text-lg font-semibold text-white mb-2">No Open Positions</h3>
          <p className="text-gray-400">You don't have any open positions at the moment.</p>
        </div>
      )}

      {/* Help Text */}
      <p className="text-sm text-gray-500 text-center">
        Click on a position to view its trade history
      </p>
    </div>
  );
};
