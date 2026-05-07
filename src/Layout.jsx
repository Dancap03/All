import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';

import { LayoutDashboard, Dumbbell, Wallet, Calendar, Menu, X, ChevronRight } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-foreground', activeColor: 'text-primary', activeBg: 'bg-primary/10', dotColor: '#34d399' },
  { path: '/calendario', label: 'Calendario', icon: Calendar, color: 'text-muted-foreground', activeColor: 'text-gold', activeBg: 'bg-gold/10', dotColor: '#fbbf24' },
  { path: '/finanzas', label: 'Finanzas', icon: Wallet, color: 'text-muted-foreground', activeColor: 'text-finance', activeBg: 'bg-finance/10', dotColor: '#60a5fa' },
  { path: '/gym', label: 'Gym', icon: Dumbbell, color: 'text-muted-foreground', activeColor: 'text-gym', activeBg: 'bg-gym/10', dotColor: '#34d399' },
];

export default function Layout({ children: _children }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-6 py-6 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-sm font-bold">M</span>
          </div>
          <div>
            <div className="text-sm font-grotesk font-bold text-foreground">MyLife</div>
            <div className="text-xs text-muted-foreground">Personal Hub</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="px-3 space-y-1 flex-1">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${active ? `${item.activeBg} ${item.activeColor}` : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'}
              `}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ backgroundColor: item.dotColor }} />
              )}
              <Icon className={`w-4.5 h-4.5 ${active ? item.activeColor : 'text-muted-foreground group-hover:text-foreground'} transition-colors`} style={{ width: '18px', height: '18px' }} />
              <span className={`text-sm font-medium ${active ? item.activeColor : ''}`}>{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-6 py-4 border-t border-border mt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gym animate-pulse" />
          <span className="text-xs text-muted-foreground">En línea</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-border bg-sidebar shrink-0">
        <NavContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex flex-col w-56 border-r border-border bg-sidebar h-full">
            <div className="absolute top-4 right-4">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/50 backdrop-blur-sm sticky top-0 z-10">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-grotesk font-semibold text-foreground">
            {NAV_ITEMS.find(n => isActive(n.path))?.label || 'Dashboard'}
          </span>
          <div className="w-8" />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
