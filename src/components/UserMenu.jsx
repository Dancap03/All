import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, LogOut, ChevronDown } from 'lucide-react';

export default function UserMenu({ pageName }) {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  if (!user) return (
    <div>
      <h1 className="text-2xl font-grotesk font-bold text-foreground">{pageName}</h1>
    </div>
  );

  // En Firebase usaremos el email para sacar las iniciales
  const initials = (user.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-grotesk font-bold text-foreground">{pageName}</h1>
      <div className="relative">
        <button
          onClick={() => setShowMenu(m => !m)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
            {initials}
          </div>
          <span className="text-sm font-medium text-foreground hidden sm:block">{user.email}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-sm font-medium text-foreground">Usuario</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="border-t border-border">
                <button onClick={() => { setShowMenu(false); logout(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut className="w-4 h-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
