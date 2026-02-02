export const StatCard = ({ label, value, subValue, trend, icon }) => {
  const trendColor = trend > 0 ? 'text-profit' : trend < 0 ? 'text-loss' : 'text-gray-400';

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-2xl font-semibold text-white mb-1">{value}</div>
      {subValue && (
        <div className={`text-sm ${trendColor}`}>
          {subValue}
        </div>
      )}
    </div>
  );
};
