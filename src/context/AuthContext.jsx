import { createContext, useContext, useState, useEffect } from 'react';
import { getCredentials, saveCredentials, clearCredentials, validateCredentials } from '../services/alpacaApi';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    const creds = getCredentials();
    if (creds) {
      setCredentials(creds);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (apiKey, apiSecret, isPaper) => {
    await validateCredentials(apiKey, apiSecret, isPaper);
    saveCredentials(apiKey, apiSecret, isPaper);
    setCredentials({ apiKey, apiSecret, isPaper });
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearCredentials();
    setCredentials(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, credentials, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
