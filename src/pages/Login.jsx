import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Login = () => {
  const { login } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(apiKey.trim(), apiSecret.trim(), isPaper);
    } catch (err) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <span className="text-6xl mb-4 block">🦙</span>
          <h1 className="text-3xl font-bold text-white mb-2">Alpaca Portfolio</h1>
          <p className="text-gray-400">Connect your Alpaca account to get started</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* API Key */}
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                API Key ID
              </label>
              <input
                type="text"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="PKXXXXXXXXXXXXXXXX"
                className="input"
                required
                autoComplete="off"
              />
            </div>

            {/* API Secret */}
            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-300 mb-2">
                API Secret Key
              </label>
              <input
                type="password"
                id="apiSecret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="••••••••••••••••••••"
                className="input"
                required
                autoComplete="off"
              />
            </div>

            {/* Paper/Live Toggle */}
            <div className="flex items-center gap-4 p-4 bg-dark-700 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="accountType"
                  checked={isPaper}
                  onChange={() => setIsPaper(true)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm font-medium">Paper Trading</span>
                <span className="text-xs text-gray-500">(Simulated)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="accountType"
                  checked={!isPaper}
                  onChange={() => setIsPaper(false)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm font-medium">Live Trading</span>
                <span className="text-xs text-gray-500">(Real $)</span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !apiKey || !apiSecret}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Connecting...</span>
                </>
              ) : (
                'Connect Account'
              )}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don't have API keys?{' '}
            <a
              href="https://app.alpaca.markets/paper/dashboard/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              Get them from Alpaca →
            </a>
          </p>
        </div>

        {/* Security Note */}
        <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-dark-600">
          <p className="text-xs text-gray-500 text-center">
            🔒 Your API keys are stored locally in your browser and never sent to any server except Alpaca's.
          </p>
        </div>
      </div>
    </div>
  );
};
