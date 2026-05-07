import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, LogOut, Mail, Key, ChevronDown } from 'lucide-react';

export default function UserMenu({ pageName }) {
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwSending, setPwSending] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setFullName(u?.full_name || ''); }).catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    await base44.auth.updateMe({ full_name: fullName });
    const u = await base44.auth.me();
    setUser(u);
    setSaving(false);
    setShowProfile(false);
  };

  const handleSendPasswordEmail = async () => {
    if (!user?.email) return;
    setPwSending(true);
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: 'Cambio de contraseña - MyLife',
      body: `Hola ${user.full_name || ''},\n\nHas solicitado un cambio de contraseña. Por favor contacta con el administrador de la aplicación o usa el sistema de recuperación de contraseña en la pantalla de inicio de sesión.\n\nSi no solicitaste esto, ignora este email.`,
    });
    setPwSending(false);
    setPwSent(true);
    setTimeout(() => setPwSent(false), 4000);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!user) return (
    <div>
      <h1 className="text-2xl font-grotesk font-bold text-foreground">{pageName}</h1>
    </div>
  );

  const initials = (user.full_name || user.email || '?').slice(0, 2).toUpperCase();

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
          <span className="text-sm font-medium text-foreground hidden sm:block">{user.full_name || user.email}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-sm font-medium text-foreground">{user.full_name || 'Sin nombre'}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <button onClick={() => { setShowMenu(false); setShowProfile(true); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                <User className="w-4 h-4 text-muted-foreground" /> Editar perfil
              </button>
              <button onClick={() => { setShowMenu(false); handleSendPasswordEmail(); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                <Key className="w-4 h-4 text-muted-foreground" /> Cambiar contraseña
              </button>
              <div className="border-t border-border">
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut className="w-4 h-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Feedback for password email */}
      {pwSent && (
        <div className="fixed bottom-4 right-4 bg-gym/20 text-gym border border-gym/30 rounded-xl px-4 py-2 text-sm z-50">
          Email enviado a {user.email}
        </div>
      )}
      {pwSending && (
        <div className="fixed bottom-4 right-4 bg-muted/50 text-muted-foreground border border-border rounded-xl px-4 py-2 text-sm z-50">
          Enviando email...
        </div>
      )}

      {/* Profile dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Nombre completo</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <Input value={user.email || ''} disabled className="mt-1 bg-muted/20 border-border opacity-60" />
              <p className="text-xs text-muted-foreground mt-1">El email no se puede cambiar.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowProfile(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveProfile} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}