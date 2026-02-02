export const ErrorMessage = ({ message, onRetry }) => (
  <div className="card bg-red-500/10 border-red-500/30">
    <div className="flex items-start gap-3">
      <span className="text-2xl">⚠️</span>
      <div className="flex-1">
        <h3 className="font-semibold text-red-400 mb-1">Error</h3>
        <p className="text-gray-300">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  </div>
);
