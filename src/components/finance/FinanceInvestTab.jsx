import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Pencil, Trash2, PiggyBank, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, subMonths, addMonths, getYear, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const POT_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#fb923c', '#f87171', '#e879f9', '#2dd4bf'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-xl">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(2)}€</p>)}
      </div>
    );
  }
  return null;
};

export default function FinanceSavingsTab() {
  const [pots, setPots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState('month'); // month | year | total
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [showPotForm, setShowPotForm] = useState(false);
  const [editingPot, setEditingPot] = useState(null);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [moveType, setMoveType] = useState('to_pot'); // to_pot | from_pot | to_daily
  const [moveAmount, setMoveAmount] = useState('');
  const [movePotId, setMovePotId] = useState('');
  const [moveDate, setMoveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteId, setDeleteId] = useState(null);
  const [deletePotId, setDeletePotId] = useState(null);
  const [potForm, setPotForm] = useState({ name: '', color: POT_COLORS[0], target_amount: '' });

  const fetchData = async () => {
    const [p, t] = await Promise.all([
      base44.entities.SavingPot.list('-created_date', 50),
      base44.entities.SavingTransaction.list('-date', 500),
    ]);
    setPots(p);
    setTransactions(t);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Compute available balance (income - moved to pots + moved from pots - moved to daily)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalToPots = transactions.filter(t => t.type === 'to_pot').reduce((s, t) => s + (t.amount || 0), 0);
  const totalFromPots = transactions.filter(t => t.type === 'from_pot').reduce((s, t) => s + (t.amount || 0), 0);
  const totalToDaily = transactions.filter(t => t.type === 'to_daily').reduce((s, t) => s + (t.amount || 0), 0);
  const availableBalance = totalIncome - totalToPots + totalFromPots - totalToDaily;
  const totalInPots = pots.reduce((s, p) => s + (p.current_amount || 0), 0);

  // Chart data — Disponible vs En huchas acumulado por periodo
  const getChartData = () => {
    const calcPeriodBar = (txs) => {
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
      const toPots = txs.filter(t => t.type === 'to_pot').reduce((s, t) => s + (t.amount || 0), 0);
      const fromPots = txs.filter(t => t.type === 'from_pot').reduce((s, t) => s + (t.amount || 0), 0);
      const toDaily = txs.filter(t => t.type === 'to_daily').reduce((s, t) => s + (t.amount || 0), 0);
      return {
        'Disponible': Math.max(0, income - toPots + fromPots - toDaily),
        'En huchas': toPots - fromPots,
      };
    };
    if (chartMode === 'month') {
      const mo = currentPeriod.getMonth() + 1;
      const yr = currentPeriod.getFullYear();
      const txs = transactions.filter(t => t.month === mo && t.year === yr);
      return [{ date: format(new Date(yr, mo - 1, 1), 'MMM yyyy', { locale: es }), ...calcPeriodBar(txs) }];
    }
    if (chartMode === 'year') {
      const yr = currentPeriod.getFullYear();
      return Array.from({ length: 12 }, (_, i) => {
        const mo = i + 1;
        const mTxs = transactions.filter(t => t.month === mo && t.year === yr);
        return { date: format(new Date(yr, i, 1), 'MMM', { locale: es }), ...calcPeriodBar(mTxs) };
      });
    }
    const years = [...new Set(transactions.map(t => t.year))].filter(Boolean).sort();
    return years.map(yr => {
      const yTxs = transactions.filter(t => t.year === yr);
      return { date: yr?.toString(), ...calcPeriodBar(yTxs) };
    });
  };

  const getFilteredHistory = () => {
    if (chartMode === 'month') {
      const m = currentPeriod.getMonth() + 1;
      const y = currentPeriod.getFullYear();
      return transactions.filter(t => t.month === m && t.year === y);
    }
    if (chartMode === 'year') {
      return transactions.filter(t => t.year === currentPeriod.getFullYear());
    }
    return transactions;
  };

  const canGoForward = () => {
    if (chartMode === 'month') return addMonths(currentPeriod, 1) <= new Date();
    if (chartMode === 'year') return currentPeriod.getFullYear() < new Date().getFullYear();
    return false;
  };

  const handlePrev = () => {
    if (chartMode === 'month') setCurrentPeriod(subMonths(currentPeriod, 1));
    else if (chartMode === 'year') setCurrentPeriod(new Date(currentPeriod.getFullYear() - 1, 0, 1));
  };

  const handleNext = () => {
    if (chartMode === 'month') setCurrentPeriod(addMonths(currentPeriod, 1));
    else if (chartMode === 'year') setCurrentPeriod(new Date(currentPeriod.getFullYear() + 1, 0, 1));
  };

  const handleSavePot = async () => {
    const data = { name: potForm.name, color: potForm.color, target_amount: parseFloat(potForm.target_amount) || null, current_amount: editingPot?.current_amount || 0 };
    if (editingPot) await base44.entities.SavingPot.update(editingPot.id, data);
    else await base44.entities.SavingPot.create(data);
    setShowPotForm(false); setEditingPot(null); fetchData();
  };

  const handleMove = async () => {
    const amount = parseFloat(moveAmount);
    if (!amount || amount <= 0) return;
    const m = new Date(moveDate).getMonth() + 1;
    const y = new Date(moveDate).getFullYear();
    const pot = pots.find(p => p.id === movePotId);

    if (moveType === 'to_pot' && pot) {
      if (amount > availableBalance) {
        alert(`No tienes suficiente saldo disponible. Disponible: ${availableBalance.toFixed(2)}€`);
        return;
      }
      await base44.entities.SavingTransaction.create({ type: 'to_pot', amount, pot_id: movePotId, pot_name: pot.name, date: moveDate, month: m, year: y });
      await base44.entities.SavingPot.update(movePotId, { current_amount: (pot.current_amount || 0) + amount });
    } else if (moveType === 'from_pot' && pot) {
      if (amount > (pot.current_amount || 0)) {
        alert(`La hucha solo tiene ${(pot.current_amount || 0).toFixed(2)}€`);
        return;
      }
      await base44.entities.SavingTransaction.create({ type: 'from_pot', amount, pot_id: movePotId, pot_name: pot.name, date: moveDate, month: m, year: y });
      await base44.entities.SavingPot.update(movePotId, { current_amount: (pot.current_amount || 0) - amount });
    } else if (moveType === 'to_daily') {
      if (amount > availableBalance) {
        alert(`No tienes suficiente saldo disponible. Disponible: ${availableBalance.toFixed(2)}€`);
        return;
      }
      await base44.entities.SavingTransaction.create({ type: 'to_daily', amount, date: moveDate, month: m, year: y });
      // Crear ingreso en día a día como transfer_from_savings
      await base44.entities.FinanceTransaction.create({ type: 'transfer_from_savings', amount, description: 'Desde ahorro', date: moveDate, month: m, year: y });
    }
    setShowMoveForm(false); setMoveAmount(''); setMovePotId('');
    fetchData();
  };

  const handleDeletePot = async () => {
    await base44.entities.SavingPot.delete(deletePotId);
    setDeletePotId(null); fetchData();
  };

  const chartData = getChartData();
  const historyTxs = getFilteredHistory().sort((a, b) => b.date?.localeCompare(a.date || '') || 0);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card border-primary/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Disponible</div>
            <div className="text-2xl font-grotesk font-bold text-primary">{availableBalance.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">En huchas</div>
            <div className="text-2xl font-grotesk font-bold text-foreground">{totalInPots.toFixed(2)}€</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => { setMoveType('to_pot'); setShowMoveForm(true); }} className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs gap-1">
          <ArrowDown className="w-3.5 h-3.5" /> Mover a hucha
        </Button>
        <Button size="sm" onClick={() => { setMoveType('from_pot'); setShowMoveForm(true); }} className="bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border text-xs gap-1">
          <ArrowUp className="w-3.5 h-3.5" /> Mover de hucha
        </Button>
        <Button size="sm" onClick={() => { setMoveType('to_daily'); setShowMoveForm(true); }} className="bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border text-xs gap-1">
          <ArrowUp className="w-3.5 h-3.5" /> Pasar a día a día
        </Button>
        <Button size="sm" onClick={() => { setEditingPot(null); setPotForm({ name: '', color: POT_COLORS[0], target_amount: '' }); setShowPotForm(true); }} variant="outline" className="border-border text-xs gap-1 ml-auto">
          <Plus className="w-3.5 h-3.5" /> Nueva hucha
        </Button>
      </div>

      {/* Chart mode selector */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {['month', 'year', 'total'].map(mode => (
                <button key={mode} onClick={() => setChartMode(mode)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chartMode === mode ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
                  {mode === 'month' ? 'Mes' : mode === 'year' ? 'Año' : 'Total'}
                </button>
              ))}
            </div>
            {chartMode !== 'total' && (
              <div className="flex items-center gap-2">
                <button onClick={handlePrev} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-medium text-foreground">
                  {chartMode === 'month' ? format(currentPeriod, 'MMM yyyy', { locale: es }) : currentPeriod.getFullYear()}
                </span>
                <button onClick={handleNext} disabled={!canGoForward()} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
              <Bar dataKey="Disponible" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="En huchas" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pots */}
      {pots.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pots.map(pot => {
            const pct = pot.target_amount ? Math.min((pot.current_amount / pot.target_amount) * 100, 100) : null;
            return (
              <Card key={pot.id} className="glass-card border-border">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pot.color || '#34d399' }} />
                      <span className="font-medium text-foreground text-sm">{pot.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingPot(pot); setPotForm({ name: pot.name, color: pot.color || POT_COLORS[0], target_amount: pot.target_amount || '' }); setShowPotForm(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeletePotId(pot.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="text-xl font-grotesk font-bold" style={{ color: pot.color || '#34d399' }}>{(pot.current_amount || 0).toFixed(2)}€</div>
                  {pot.target_amount && (
                    <>
                      <div className="text-xs text-muted-foreground">de {pot.target_amount}€</div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pot.color || '#34d399' }} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* History */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-sm">Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {historyTxs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">Sin movimientos en este periodo</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {historyTxs.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-border">
                  <div>
                    <div className="text-sm text-foreground">
                      {tx.type === 'income' ? '💰 Ingreso' : tx.type === 'to_pot' ? `→ ${tx.pot_name}` : tx.type === 'from_pot' ? `← ${tx.pot_name}` : '↑ A día a día'}
                    </div>
                    <div className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), "d MMM yyyy", { locale: es }) : ''}</div>
                  </div>
                  <span className={`font-semibold text-sm ${tx.type === 'income' || tx.type === 'from_pot' ? 'text-gym' : 'text-destructive'}`}>
                    {tx.type === 'income' || tx.type === 'from_pot' ? '+' : '-'}{tx.amount?.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={showPotForm} onOpenChange={setShowPotForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">{editingPot ? 'Editar hucha' : 'Nueva hucha'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Nombre</Label>
              <Input value={potForm.name} onChange={e => setPotForm(f => ({...f, name: e.target.value}))} placeholder="Ej: Imprevistos" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground mb-2 block">Color</Label>
              <div className="flex gap-2 flex-wrap">
                {POT_COLORS.map(c => (
                  <button key={c} onClick={() => setPotForm(f => ({...f, color: c}))} className={`w-7 h-7 rounded-full border-2 transition-transform ${potForm.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-foreground">Objetivo (€, opcional)</Label>
              <Input type="number" value={potForm.target_amount} onChange={e => setPotForm(f => ({...f, target_amount: e.target.value}))} placeholder="Sin objetivo" className="mt-1 bg-muted/30 border-border" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPotForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSavePot} disabled={!potForm.name} className="bg-primary text-primary-foreground">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveForm} onOpenChange={setShowMoveForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {moveType === 'to_pot' ? 'Mover a hucha' : moveType === 'from_pot' ? 'Mover de hucha' : 'Pasar a día a día'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(moveType === 'to_pot' || moveType === 'from_pot') && (
              <div>
                <Label className="text-foreground">Hucha</Label>
                <Select value={movePotId} onValueChange={setMovePotId}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue placeholder="Seleccionar hucha..." /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {pots.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({(p.current_amount || 0).toFixed(2)}€)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-foreground">Cantidad (€)</Label>
              <Input type="number" value={moveAmount} onChange={e => setMoveAmount(e.target.value)} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Fecha</Label>
              <Input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowMoveForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleMove} disabled={!moveAmount || ((moveType === 'to_pot' || moveType === 'from_pot') && !movePotId)} className="bg-primary text-primary-foreground">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePotId} onOpenChange={() => setDeletePotId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar hucha?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePot} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
