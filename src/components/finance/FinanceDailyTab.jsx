import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const INCOME_CATEGORIES = ['Nómina', 'Intereses', 'Dividendos', 'Venta', 'Freelance', 'Otros ingresos'];
const EXPENSE_CATEGORIES = ['Comida', 'Transporte', 'Ocio', 'Salud', 'Ropa', 'Hogar', 'Suscripciones', 'Educación', 'Otros'];
const OTHER_CATEGORIES = ['Capricho', 'Matrícula', 'Vehículo', 'Reparación', 'Viaje', 'Otros gastos'];

const COLORS = { income: '#60a5fa', expense: '#f87171', budget: '#34d399', transfer_to_savings: '#a78bfa', transfer_to_investment: '#fbbf24', other: '#fb923c' };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-xl">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(2)}€</p>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-xl">
        <p style={{ color: payload[0].color }}>{payload[0].name}: {payload[0].value?.toFixed(2)}€ ({payload[0].payload.percent?.toFixed(1)}%)</p>
      </div>
    );
  }
  return null;
};

export default function FinanceDailyTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('income');
  const [editingTx, setEditingTx] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');

  const [form, setForm] = useState({ amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });

  const month = currentMonth.getMonth() + 1;
  const year = currentMonth.getFullYear();

  const fetchData = async () => {
    const [txs, buds] = await Promise.all([
      base44.entities.FinanceTransaction.filter({ month, year }),
      base44.entities.MonthlyBudget.filter({ month, year }),
    ]);
    setTransactions(txs);
    setBudgets(buds);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); fetchData(); }, [month, year]);

  const incomes = transactions.filter(t => t.type === 'income');
  const budgetExpenses = transactions.filter(t => t.type === 'expense');
  const otherExpenses = transactions.filter(t => t.type === 'other');
  const transferSavings = transactions.filter(t => t.type === 'transfer_to_savings');
  const transferInvest = transactions.filter(t => t.type === 'transfer_to_investment');
  const receivedFromSavings = transactions.filter(t => t.type === 'transfer_from_savings');
  const receivedFromInvest = transactions.filter(t => t.type === 'transfer_from_investment');

  const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
  const totalBudgetExpense = budgetExpenses.reduce((s, t) => s + (t.amount || 0), 0);
  const totalOther = otherExpenses.reduce((s, t) => s + (t.amount || 0), 0);
  const totalSavings = transferSavings.reduce((s, t) => s + (t.amount || 0), 0);
  const totalInvest = transferInvest.reduce((s, t) => s + (t.amount || 0), 0);
  const totalReceivedSavings = receivedFromSavings.reduce((s, t) => s + (t.amount || 0), 0);
  const totalReceivedInvest = receivedFromInvest.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = totalBudgetExpense + totalOther + totalSavings + totalInvest;
  const balance = totalIncome + totalReceivedSavings + totalReceivedInvest - totalExpenses;

  const budget = budgets[0];
  const budgetLeft = budget ? (budget.amount - totalBudgetExpense) : null;

  const pieData = [
    budget && totalBudgetExpense > 0 ? { name: 'Presupuesto gastado', value: totalBudgetExpense, color: COLORS.budget } : null,
    totalOther > 0 ? { name: 'Otros gastos', value: totalOther, color: COLORS.other } : null,
    totalSavings > 0 ? { name: 'Ahorro', value: totalSavings, color: COLORS.transfer_to_savings } : null,
    totalInvest > 0 ? { name: 'Inversión', value: totalInvest, color: COLORS.transfer_to_investment } : null,
  ].filter(Boolean).map(item => ({
    ...item,
    percent: totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0,
  }));

  const balancePieData = [
    { name: 'Ingresos', value: totalIncome, color: COLORS.income },
    { name: 'Gastos', value: totalExpenses, color: COLORS.expense },
  ];

  const openForm = (type, tx = null) => {
    setFormType(type);
    setEditingTx(tx);
    setForm(tx ? { amount: tx.amount, category: tx.category || '', description: tx.description || '', date: tx.date || format(new Date(), 'yyyy-MM-dd') }
      : { amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
    setShowForm(true);
  };

  const handleSave = async () => {
    const data = {
      type: formType,
      amount: parseFloat(form.amount),
      category: form.category,
      description: form.description,
      date: form.date,
      month,
      year,
    };
    if (editingTx) {
      await base44.entities.FinanceTransaction.update(editingTx.id, data);
    } else {
      await base44.entities.FinanceTransaction.create(data);
      // Sync to savings/invest accounts
      if (formType === 'transfer_to_savings') {
        await base44.entities.SavingTransaction.create({ type: 'income', amount: parseFloat(form.amount), description: form.description || 'Transferencia desde día a día', date: form.date, month, year });
      }
    }
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async () => {
    await base44.entities.FinanceTransaction.delete(deleteId);
    setDeleteId(null);
    fetchData();
  };

  const handleSaveBudget = async () => {
    const amt = parseFloat(budgetAmount);
    if (!amt) return;
    if (budget) {
      await base44.entities.MonthlyBudget.update(budget.id, { amount: amt });
    } else {
      await base44.entities.MonthlyBudget.create({ month, year, amount: amt });
    }
    setShowBudgetForm(false);
    setBudgetAmount('');
    fetchData();
  };

  const canGoForward = addMonths(currentMonth, 1) <= new Date();

  const TransactionRow = ({ tx }) => (
    <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-border group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{tx.category || '—'}</span>
          {tx.description && <span className="text-xs text-muted-foreground truncate">{tx.description}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), 'd MMM', { locale: es }) : ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-semibold text-sm ${['income', 'transfer_from_savings', 'transfer_from_investment'].includes(tx.type) ? 'text-gym' : 'text-destructive'}`}>
          {['income', 'transfer_from_savings', 'transfer_from_investment'].includes(tx.type) ? '+' : '-'}{tx.amount?.toFixed(2)}€
        </span>
        <div className="hidden group-hover:flex gap-1">
          <button onClick={() => openForm(tx.type, tx)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteId(tx.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-finance/30 border-t-finance rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-grotesk font-semibold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} disabled={!canGoForward} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card border-finance/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Balance</div>
            <div className={`text-xl font-grotesk font-bold ${balance >= 0 ? 'text-finance' : 'text-destructive'}`}>{balance.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Ingresos</div>
            <div className="text-xl font-grotesk font-bold text-gym">+{totalIncome.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Gastos</div>
            <div className="text-xl font-grotesk font-bold text-destructive">-{totalExpenses.toFixed(2)}€</div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution charts */}
      {totalExpenses > 0 || totalIncome > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm">Distribución de gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm">Ingresos vs Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={balancePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" nameKey="name">
                        {balancePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className={`text-sm font-bold ${balance >= 0 ? 'text-finance' : 'text-destructive'}`}>{balance >= 0 ? '+' : ''}{balance.toFixed(0)}€</span>
                    <span className="text-xs text-muted-foreground">balance</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {balancePieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-muted-foreground">{d.name}: {d.value.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget section */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm">Presupuesto mensual</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs border-border" onClick={() => { setBudgetAmount(budget?.amount || ''); setShowBudgetForm(true); }}>
                {budget ? 'Editar' : 'Añadir'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {budget ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Presupuesto: <span className="text-foreground font-medium">{budget.amount}€</span></span>
                  <span className={budgetLeft >= 0 ? 'text-gym' : 'text-destructive'}>Restante: {budgetLeft?.toFixed(2)}€</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all bg-gym" style={{ width: `${Math.min((totalBudgetExpense / budget.amount) * 100, 100)}%`, backgroundColor: totalBudgetExpense > budget.amount ? '#f87171' : '#34d399' }} />
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={[{ name: 'Presupuesto', Planificado: budget.amount, Gastado: totalBudgetExpense }]}>
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Planificado" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gastado" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : <p className="text-muted-foreground text-sm text-center py-4">Sin presupuesto asignado</p>}

            <div className="space-y-1">
              {budgetExpenses.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
            </div>
            <Button size="sm" onClick={() => openForm('expense')} className="w-full h-8 text-xs bg-muted/30 hover:bg-muted/50 text-foreground border border-dashed border-border">
              <Plus className="w-3.5 h-3.5 mr-1" /> Añadir gasto
            </Button>
          </CardContent>
        </Card>

        {/* Incomes section */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm">Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomes.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
            <Button size="sm" onClick={() => openForm('income')} className="w-full h-8 text-xs bg-muted/30 hover:bg-muted/50 text-foreground border border-dashed border-border">
              <Plus className="w-3.5 h-3.5 mr-1" /> Añadir ingreso
            </Button>
          </CardContent>
        </Card>

        {/* Other expenses */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm">Otros gastos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherExpenses.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
            <Button size="sm" onClick={() => openForm('other')} className="w-full h-8 text-xs bg-muted/30 hover:bg-muted/50 text-foreground border border-dashed border-border">
              <Plus className="w-3.5 h-3.5 mr-1" /> Añadir otro gasto
            </Button>
          </CardContent>
        </Card>

        {/* Transfers OUT - only to savings; investment is done from invest tab */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm">Transferencias enviadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
          <div className="space-y-1">
            {transferSavings.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-border group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">A ahorro</span>
                    {tx.description && <span className="text-xs text-muted-foreground truncate">{tx.description}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), 'd MMM', { locale: es }) : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-destructive">-{tx.amount?.toFixed(2)}€</span>
                  <div className="hidden group-hover:flex gap-1">
                    <button onClick={() => openForm(tx.type, tx)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(tx.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
            {transferInvest.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">A inversión</p>
                {transferInvest.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-border">
                    <div>
                      <span className="text-sm text-muted-foreground">{tx.description || 'Inversión'}</span>
                      <div className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), 'd MMM', { locale: es }) : ''}</div>
                    </div>
                    <span className="font-semibold text-sm text-destructive">-{tx.amount?.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" onClick={() => openForm('transfer_to_savings')} className="w-full h-7 text-xs bg-muted/30 hover:bg-muted/50 text-muted-foreground border border-dashed border-border mt-2">
              <Plus className="w-3 h-3 mr-1" /> Transferir a ahorro
            </Button>
          </div>
          </CardContent>
        </Card>

        {/* Received transfers - read only, managed from savings/invest tabs */}
        {(receivedFromSavings.length > 0 || receivedFromInvest.length > 0) && (
          <Card className="glass-card border-gym/20 lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-sm">Transferencias recibidas</CardTitle>
                <span className="text-xs text-muted-foreground">Solo lectura · Gestiona desde Ahorro o Inversión</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {receivedFromSavings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Desde ahorro</p>
                  {receivedFromSavings.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-border">
                      <div>
                        <span className="text-sm font-medium text-foreground">{tx.description || 'Desde ahorro'}</span>
                        <div className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), 'd MMM', { locale: es }) : ''}</div>
                      </div>
                      <span className="font-semibold text-sm text-gym">+{tx.amount?.toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
              {receivedFromInvest.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-xs text-muted-foreground">Desde inversión</p>
                  {receivedFromInvest.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-border">
                      <div>
                        <span className="text-sm font-medium text-foreground">{tx.description || 'Venta inversión'}</span>
                        <div className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), 'd MMM', { locale: es }) : ''}</div>
                      </div>
                      <span className="font-semibold text-sm text-gym">+{tx.amount?.toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingTx ? 'Editar' : 'Añadir'} {
                formType === 'income' ? 'ingreso' :
                formType === 'expense' ? 'gasto' :
                formType === 'other' ? 'otro gasto' :
                formType === 'transfer_to_savings' ? 'transferencia a ahorro' :
                'transferencia a inversión'
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Cantidad (€)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
            {!['transfer_to_savings', 'transfer_to_investment'].includes(formType) && (
              <div>
                <Label className="text-foreground">Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {(formType === 'income' ? INCOME_CATEGORIES : formType === 'other' ? OTHER_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-foreground">Descripción (opcional)</Label>
              <Input value={form.description || ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Nota..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Fecha</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.amount} className="bg-finance text-white hover:bg-finance/90">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget dialog */}
      <Dialog open={showBudgetForm} onOpenChange={setShowBudgetForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Presupuesto mensual</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-foreground">Cantidad (€)</Label>
            <Input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="Ej: 500" className="mt-1 bg-muted/30 border-border" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBudgetForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveBudget} className="bg-finance text-white hover:bg-finance/90">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar transacción?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}