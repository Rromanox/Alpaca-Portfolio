const STORAGE_KEY = 'alpaca_credentials';
const PAPER_BASE_URL = 'https://paper-api.alpaca.markets';
const LIVE_BASE_URL = 'https://api.alpaca.markets';
const DATA_BASE_URL = 'https://data.alpaca.markets';

export const getCredentials = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const saveCredentials = (apiKey, apiSecret, isPaper = true) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, apiSecret, isPaper }));
};

export const clearCredentials = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const getBaseUrl = () => {
  const creds = getCredentials();
  return creds?.isPaper ? PAPER_BASE_URL : LIVE_BASE_URL;
};

const makeRequest = async (endpoint, options = {}) => {
  const creds = getCredentials();
  if (!creds) {
    throw new Error('Not authenticated');
  }

  const baseUrl = endpoint.startsWith('/v2/stocks') || endpoint.startsWith('/v1beta1')
    ? DATA_BASE_URL
    : getBaseUrl();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'APCA-API-KEY-ID': creds.apiKey,
      'APCA-API-SECRET-KEY': creds.apiSecret,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 429) {
    throw new Error('Rate limited. Please wait a moment and try again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
};

// Account endpoints
export const getAccount = () => makeRequest('/v2/account');

export const getPortfolioHistory = (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.period) searchParams.set('period', params.period);
  if (params.timeframe) searchParams.set('timeframe', params.timeframe);
  if (params.extended_hours !== undefined) searchParams.set('extended_hours', params.extended_hours);

  const query = searchParams.toString();
  return makeRequest(`/v2/account/portfolio/history${query ? `?${query}` : ''}`);
};

// Positions endpoints
export const getPositions = () => makeRequest('/v2/positions');

export const getPosition = (symbol) => makeRequest(`/v2/positions/${symbol}`);

// Orders endpoints
export const getOrders = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.after) searchParams.set('after', params.after);
  if (params.until) searchParams.set('until', params.until);
  if (params.direction) searchParams.set('direction', params.direction);
  if (params.nested !== undefined) searchParams.set('nested', params.nested);
  if (params.symbols) searchParams.set('symbols', params.symbols);

  const query = searchParams.toString();
  return makeRequest(`/v2/orders${query ? `?${query}` : ''}`);
};

// Fetch all closed orders with pagination
export const getAllClosedOrders = async (startDate = null, endDate = null) => {
  const allOrders = [];
  let after = startDate;
  const limit = 500;

  while (true) {
    const params = {
      status: 'closed',
      limit,
      direction: 'asc',
    };

    if (after) params.after = after;
    if (endDate) params.until = endDate;

    const orders = await getOrders(params);

    if (orders.length === 0) break;

    allOrders.push(...orders);

    if (orders.length < limit) break;

    // Get the last order's timestamp for pagination
    const lastOrder = orders[orders.length - 1];
    after = lastOrder.filled_at || lastOrder.created_at;
  }

  return allOrders;
};

// Validate credentials by making a test request
export const validateCredentials = async (apiKey, apiSecret, isPaper) => {
  const baseUrl = isPaper ? PAPER_BASE_URL : LIVE_BASE_URL;

  const response = await fetch(`${baseUrl}/v2/account`, {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Invalid credentials');
  }

  return response.json();
};

// Get latest quote for a symbol
export const getLatestQuote = (symbol) =>
  makeRequest(`/v2/stocks/${symbol}/quotes/latest`);

// Get bars for a symbol
export const getBars = (symbol, params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.timeframe) searchParams.set('timeframe', params.timeframe);
  if (params.start) searchParams.set('start', params.start);
  if (params.end) searchParams.set('end', params.end);
  if (params.limit) searchParams.set('limit', params.limit);

  const query = searchParams.toString();
  return makeRequest(`/v2/stocks/${symbol}/bars${query ? `?${query}` : ''}`);
};
