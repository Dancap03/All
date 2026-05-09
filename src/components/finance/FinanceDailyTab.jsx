import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, PiggyBank, ChevronDown } from 'lucide-react';

import { format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

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

export default function FinanceSummaryTab() {
  const [transactions, setTransactions] = useState([]);
  const [savingTxs, setInvTxs] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState('month');
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.FinanceTransaction.list('-date', 1000),
      base44.entities.SavingTransaction.list('-date', 1000),
      base44.entities.InvestmentPosition.list('-created_date', 100),
    ]).then(([txs, stxs, pos]) => {
      setTransactions(txs);
      setInvTxs(stxs);
      setPositions(pos);
      setLoading(false);
    });
  }, []);

  const m = currentPeriod.getMonth() + 1;
  const y = currentPeriod.getFullYear();

  const getPeriodTxs = () => {
    if (chartMode === 'month') return transactions.filter(t => t.month === m && t.year === y);
    if (chartMode === 'year') return transactions.filter(t => t.year === y);
    return transactions;
  };

  const periodTxs = getPeriodTxs();
  // Balance igual que día a día: ingresos + recibido - gastado - enviado
  const periodIncome = periodTxs.filter(t => ['income', 'transfer_from_savings', 'transfer_from_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const periodExpense = periodTxs.filter(t => ['expense', 'other', 'transfer_to_savings', 'transfer_to_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const periodBalance = periodIncome - periodExpense;

  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  const investGain = totalCurrentValue - totalInvested;

  const totalSavings = 0; // Would compute from saving transactions

  // Chart data
  const getChartData = () => {
    const calcBar = (txs, investVal) => {
      const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
      const exp = txs.filter(t => ['expense', 'other'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
      const sav = txs.filter(t => t.type === 'transfer_to_savings').reduce((s, t) => s + (t.amount || 0), 0);
      const inv = txs.filter(t => t.type === 'transfer_to_investment').reduce((s, t) => s + (t.amount || 0), 0);
      return { Balance: Math.max(0, inc - exp - sav - inv), Gastos: exp, Ahorro: sav, Inversión: inv };
    };
    if (chartMode === 'month') {
      const txs = transactions.filter(t => t.month === m && t.year === y);
      const bar = calcBar(txs, totalCurrentValue);
      return [{ date: format(new Date(y, m - 1, 1), 'MMM yyyy', { locale: es }), ...bar }];
    }
    if (chartMode === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const mo = i + 1;
        const mTxs = transactions.filter(t => t.month === mo && t.year === y);
        return { date: format(new Date(y, i, 1), 'MMM', { locale: es }), ...calcBar(mTxs, 0) };
      });
    }
    const years = [...new Set(transactions.map(t => t.year))].filter(Boolean).sort();
    return years.map(yr => {
      const yTxs = transactions.filter(t => t.year === yr);
      return { date: yr?.toString(), ...calcBar(yTxs, 0) };
    });
  };

  // History months for year/total modes
  const getHistoryMonths = () => {
    let txsToUse = chartMode === 'year' ? transactions.filter(t => t.year === y) : transactions;
    const monthGroups = {};
    txsToUse.forEach(t => {
      const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
      if (!monthGroups[key]) monthGroups[key] = { key, year: t.year, month: t.month, txs: [] };
      monthGroups[key].txs.push(t);
    });
    return Object.values(monthGroups).sort((a, b) => b.key.localeCompare(a.key));
  };

  const canGoForward = () => {
    if (chartMode === 'month') return addMonths(currentPeriod, 1) <= new Date();
    if (chartMode === 'year') return y < new Date().getFullYear();
    return false;
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-finance/30 border-t-finance rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-card border-gym/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3 text-gym" /> Balance</div>
            <div className={`text-xl font-grotesk font-bold text-gym`}>{periodBalance >= 0 ? '+' : ''}{periodBalance.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-destructive/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3 text-destructive" /> Gastos</div>
            <div className="text-xl font-grotesk font-bold text-destructive">-{periodExpense.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-finance/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><PiggyBank className="w-3 h-3 text-finance" /> Ahorro</div>
            <div className="text-xl font-grotesk font-bold text-finance">{periodIncome.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-gold/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3 text-gold" /> Inversión</div>
            <div className="text-xl font-grotesk font-bold text-gold">{totalCurrentValue.toFixed(2)}€</div>
            <div className={`text-xs ${investGain >= 0 ? 'text-gym' : 'text-destructive'} flex items-center gap-1`}>
              {investGain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {investGain >= 0 ? '+' : ''}{investGain.toFixed(2)}€
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {['month', 'year', 'total'].map(mode => (
                <button key={mode} onClick={() => setChartMode(mode)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chartMode === mode ? 'bg-finance/20 text-finance border border-finance/30' : 'text-muted-foreground hover:text-foreground'}`}>
                  {mode === 'month' ? 'Mes' : mode === 'year' ? 'Año' : 'Total'}
                </button>
              ))}
            </div>
            {chartMode !== 'total' && (
              <div className="flex items-center gap-2">
                <button onClick={() => chartMode === 'month' ? setCurrentPeriod(subMonths(currentPeriod, 1)) : setCurrentPeriod(new Date(y - 1, 0, 1))} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-medium text-foreground">
                  {chartMode === 'month' ? format(currentPeriod, 'MMM yyyy', { locale: es }) : y}
                </span>
                <button onClick={() => chartMode === 'month' ? setCurrentPeriod(addMonths(currentPeriod, 1)) : setCurrentPeriod(new Date(y + 1, 0, 1))} disabled={!canGoForward()} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={getChartData()}>
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
              <Bar dataKey="Balance" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ahorro" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Inversión" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly history accordion (only for year/total) */}
      {(chartMode === 'year' || chartMode === 'total') && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm">Historial por mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {getHistoryMonths().map(({ key, year: yr, month: mo, txs }) => {
              const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
              const exp = txs.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0);
              const isExpanded = expandedMonth === key;
              return (
                <div key={key} className="border border-border rounded-xl overflow-hidden">
                  <button className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors" onClick={() => setExpandedMonth(isExpanded ? null : key)}>
                    <span className="font-medium text-foreground capitalize text-sm">{format(new Date(yr, mo - 1, 1), 'MMMM yyyy', { locale: es })}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gym">+{inc.toFixed(2)}€</span>
                      <span className="text-xs text-destructive">-{exp.toFixed(2)}€</span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border p-3 space-y-1">
                      {txs.sort((a, b) => b.date?.localeCompare(a.date || '') || 0).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-muted/20">
                          <div>
                            <span className="text-foreground">{tx.category || tx.type}</span>
                            {tx.description && <span className="text-muted-foreground text-xs ml-2">{tx.description}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{tx.date ? format(new Date(tx.date), 'd MMM', { locale: es }) : ''}</span>
                            <span className={`font-semibold ${tx.type === 'income' ? 'text-gym' : 'text-destructive'}`}>
                              {tx.type === 'income' ? '+' : '-'}{tx.amount?.toFixed(2)}€
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {getHistoryMonths().length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Sin movimientos</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
