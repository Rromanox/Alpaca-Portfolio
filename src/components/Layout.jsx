import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/positions', label: 'Positions', icon: '📈' },
  { path: '/history', label: 'History', icon: '📋' },
  { path: '/analytics', label: 'Analytics', icon: '🎯' },
];

export const Layout = () => {
  const { logout, credentials } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">🦙</span>
              <span className="text-base sm:text-xl font-semibold text-white hidden xs:inline">Alpaca</span>
              <span className="text-base sm:text-xl font-semibold text-white hidden sm:inline">Portfolio</span>
              {credentials?.isPaper && (
                <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded">
                  PAPER
                </span>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-accent text-white shadow-lg shadow-accent/25'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700'
                    }`
                  }
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Logout */}
            <button
              onClick={logout}
              className="px-3 sm:px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 z-50 safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-accent'
                    : 'text-gray-500 active:bg-dark-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-2xl mb-0.5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-accent' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 w-1 h-1 bg-accent rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Footer - Hidden on mobile */}
      <footer className="hidden md:block bg-dark-800 border-t border-dark-600 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          Data provided by Alpaca Markets
        </div>
      </footer>
    </div>
  );
};
