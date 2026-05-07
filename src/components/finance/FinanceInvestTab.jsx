import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw, Eye, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const INVESTMENT_TYPES = [
  { id: 'stock', label: 'Acción', color: '#60a5fa' },
  { id: 'etf', label: 'ETF', color: '#34d399' },
  { id: 'index_fund', label: 'Fondo indexado', color: '#a78bfa' },
  { id: 'crypto', label: 'Crypto', color: '#f59e0b' },
  { id: 'bond', label: 'Bono', color: '#6ee7b7' },
  { id: 'commodity', label: 'Materia prima', color: '#fbbf24' },
  { id: 'other', label: 'Otro', color: '#9ca3af' },
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-xl">
        <p style={{ color: payload[0].color }}>{payload[0].name}: {payload[0].value?.toFixed(2)}€ ({((payload[0].payload.percent || 0) * 100).toFixed(1)}%)</p>
      </div>
    );
  }
  return null;
};

export default function FinanceInvestTab() {
  const [positions, setPositions] = useState([]);
  const [dailyTxs, setDailyTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [viewingPos, setViewingPos] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellPos, setSellPos] = useState(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellDate, setSellDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [editPricePos, setEditPricePos] = useState(null);
  const [editPriceForm, setEditPriceForm] = useState({ current_price: '', current_value_eur: '' });
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  const [form, setForm] = useState({
    ticker: '', name: '', investment_type: 'stock', invested_amount_eur: '',
    buy_price: '', currency: 'EUR', description: '', date: format(new Date(), 'yyyy-MM-dd'),
  });

  const fetchData = async () => {
    const [pos, txs] = await Promise.all([
      base44.entities.InvestmentPosition.list('-created_date', 100),
      base44.entities.FinanceTransaction.list('-date', 1000),
    ]);
    setPositions(pos);
    setDailyTxs(txs);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Balance disponible en día a día
  const dailyIncome = dailyTxs.filter(t => ['income', 'transfer_from_savings', 'transfer_from_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyOut = dailyTxs.filter(t => ['expense', 'other', 'transfer_to_savings', 'transfer_to_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyAvailable = dailyIncome - dailyOut;

  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? ((totalGain / totalInvested) * 100) : 0;

  // Group by type for pie chart
  const typeGroups = {};
  positions.forEach(p => {
    const type = INVESTMENT_TYPES.find(t => t.id === p.investment_type) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];
    if (!typeGroups[p.investment_type]) typeGroups[p.investment_type] = { name: type.label, value: 0, color: type.color };
    typeGroups[p.investment_type].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const typeData = Object.values(typeGroups);

  // Group by name for position pie
  const positionData = positions.map(p => ({
    name: p.ticker,
    value: p.current_value_eur || p.invested_amount_eur || 0,
    color: INVESTMENT_TYPES.find(t => t.id === p.investment_type)?.color || '#9ca3af',
  }));

  const handleSearchTicker = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Search for the financial instrument with ticker or name: "${searchQuery}". Return the ticker symbol, full name, and current price in USD. If it's crypto, use USD. If European, use EUR.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
            name: { type: 'string' },
            price_usd: { type: 'number' },
            price_eur: { type: 'number' },
            currency: { type: 'string' },
          },
        },
      });
      setSearchResult(result);
      if (result.ticker) setForm(f => ({ ...f, ticker: result.ticker, name: result.name || f.name, buy_price: result.price_eur || result.price_usd || '', currency: result.currency || 'USD' }));
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    for (const pos of positions) {
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Get the current market price for ${pos.ticker} (${pos.name}). Return current price in the original currency (${pos.currency}) and in EUR.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              current_price: { type: 'number' },
              current_price_eur: { type: 'number' },
            },
          },
        });
        if (result.current_price) {
          const ratio = pos.invested_amount_eur / (pos.buy_price || result.current_price);
          const currentValueEur = result.current_price_eur ? ratio * result.current_price_eur : pos.invested_amount_eur;
          await base44.entities.InvestmentPosition.update(pos.id, {
            current_price: result.current_price,
            current_value_eur: currentValueEur || result.current_price_eur || pos.invested_amount_eur,
            last_updated: new Date().toISOString(),
          });
        }
      } catch (e) { console.error(e); }
    }
    await fetchData();
    setRefreshing(false);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.invested_amount_eur);
    if (!amount || amount <= 0) return;

    // Validar que haya saldo disponible en día a día
    if (amount > dailyAvailable) {
      alert(`No tienes suficiente saldo en día a día. Disponible: ${dailyAvailable.toFixed(2)}€`);
      return;
    }

    const data = {
      ticker: form.ticker.toUpperCase(),
      name: form.name,
      investment_type: form.investment_type,
      invested_amount_eur: amount,
      buy_price: parseFloat(form.buy_price) || 0,
      currency: form.currency,
      description: form.description,
      date: form.date,
      current_value_eur: amount,
      current_price: parseFloat(form.buy_price) || 0,
    };

    // Descontar de día a día
    const m = new Date(form.date).getMonth() + 1;
    const yr = new Date(form.date).getFullYear();
    await base44.entities.FinanceTransaction.create({
      type: 'transfer_to_investment',
      amount,
      description: `Inversión en ${form.ticker.toUpperCase()}`,
      date: form.date,
      month: m,
      year: yr,
    });

    if (editingPos) {
      const newHistory = [...(editingPos.purchase_history || []), {
        date: form.date, amount_eur: amount, buy_price: parseFloat(form.buy_price), currency: form.currency,
      }];
      await base44.entities.InvestmentPosition.update(editingPos.id, {
        ...data,
        invested_amount_eur: (editingPos.invested_amount_eur || 0) + amount,
        current_value_eur: (editingPos.current_value_eur || editingPos.invested_amount_eur || 0) + amount,
        purchase_history: newHistory,
      });
    } else {
      await base44.entities.InvestmentPosition.create({ ...data, purchase_history: [{ date: form.date, amount_eur: amount, buy_price: parseFloat(form.buy_price), currency: form.currency }] });
    }
    setShowForm(false);
    setEditingPos(null);
    setSearchQuery('');
    setSearchResult(null);
    fetchData();
  };

  const handleSell = async () => {
    if (!sellPos || !sellAmount) return;
    const amount = parseFloat(sellAmount);
    const currentValue = sellPos.current_value_eur || sellPos.invested_amount_eur || 0;
    if (amount > currentValue) {
      alert(`Solo puedes vender hasta ${currentValue.toFixed(2)}€`);
      return;
    }

    const ratio = amount / currentValue;
    const newValue = currentValue - amount;
    const newInvested = (sellPos.invested_amount_eur || 0) * (1 - ratio);

    await base44.entities.InvestmentPosition.update(sellPos.id, {
      current_value_eur: newValue,
      invested_amount_eur: newInvested,
    });

    // Add to daily finance
    const m = new Date(sellDate).getMonth() + 1;
    const yr = new Date(sellDate).getFullYear();
    await base44.entities.FinanceTransaction.create({
      type: 'transfer_from_investment',
      amount,
      category: 'Desde inversión',
      description: `Venta de ${sellPos.ticker}`,
      date: sellDate,
      month: m,
      year: yr,
    });

    setShowSellForm(false);
    setSellPos(null);
    setSellAmount('');
    fetchData();
  };

  const handleDelete = async () => {
    await base44.entities.InvestmentPosition.delete(deleteId);
    setDeleteId(null);
    fetchData();
  };

  const handleSavePrice = async () => {
    const price = parseFloat(editPriceForm.current_price);
    const valueEur = parseFloat(editPriceForm.current_value_eur);
    const updates = {};
    if (!isNaN(price)) updates.current_price = price;
    if (!isNaN(valueEur)) updates.current_value_eur = valueEur;
    if (Object.keys(updates).length > 0) {
      updates.last_updated = new Date().toISOString();
      await base44.entities.InvestmentPosition.update(editPricePos.id, updates);
    }
    setShowPriceEdit(false);
    setEditPricePos(null);
    fetchData();
  };

  const getGain = (pos) => {
    const current = pos.current_value_eur || pos.invested_amount_eur || 0;
    const invested = pos.invested_amount_eur || 0;
    return current - invested;
  };
  const getGainPct = (pos) => {
    const invested = pos.invested_amount_eur || 0;
    if (invested === 0) return 0;
    return ((getGain(pos) / invested) * 100);
  };

  const getTypeInfo = (typeId) => INVESTMENT_TYPES.find(t => t.id === typeId) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gold/30 border-t-gold rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-card border-gold/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Valor total</div>
            <div className="text-xl font-grotesk font-bold text-gold">{totalCurrentValue.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Total invertido</div>
            <div className="text-xl font-grotesk font-bold text-foreground">{totalInvested.toFixed(2)}€</div>
          </CardContent>
        </Card>
        <Card className={`glass-card border-${totalGain >= 0 ? 'gym' : 'destructive'}/20`}>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Ganancia / Pérdida</div>
            <div className={`text-xl font-grotesk font-bold ${totalGain >= 0 ? 'text-gym' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGain.toFixed(2)}€
            </div>
            <div className={`text-xs flex items-center gap-0.5 ${totalGain >= 0 ? 'text-gym' : 'text-destructive'}`}>
              {totalGain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {totalGain >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Posiciones</div>
            <div className="text-xl font-grotesk font-bold text-foreground">{positions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { setEditingPos(null); setForm({ ticker: '', name: '', investment_type: 'stock', invested_amount_eur: '', buy_price: '', currency: 'EUR', description: '', date: format(new Date(), 'yyyy-MM-dd') }); setSearchQuery(''); setSearchResult(null); setShowForm(true); }} className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Nueva posición
        </Button>
        <Button size="sm" onClick={handleRefreshPrices} disabled={refreshing || positions.length === 0} variant="outline" className="border-border text-xs gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar precios'}
        </Button>
      </div>

      {positions.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
          💡 Los precios se actualizan usando IA con datos de internet. Puede haber un pequeño retraso respecto al mercado real.
        </div>
      )}

      {/* Pie charts */}
      {positions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm">Por tipo de inversión</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                    {typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm">Por posición</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={positionData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                    {positionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Positions list */}
      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-foreground text-sm">Mis posiciones</CardTitle></CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sin posiciones aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map(pos => {
                const gain = getGain(pos);
                const gainPct = getGainPct(pos);
                const typeInfo = getTypeInfo(pos.investment_type);
                const currentValue = pos.current_value_eur || pos.invested_amount_eur || 0;
                return (
                  <div key={pos.id} className="p-3 bg-muted/20 rounded-xl border border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${typeInfo.color}20`, color: typeInfo.color }}>
                          {pos.ticker?.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{pos.ticker}
                            {pos.current_price ? <span className="text-xs font-normal text-muted-foreground ml-1">@ {pos.current_price} {pos.currency || ''}</span> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{pos.name}</div>
                          <Badge variant="outline" className="text-xs mt-0.5 border-border" style={{ color: typeInfo.color, borderColor: `${typeInfo.color}40` }}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{currentValue.toFixed(2)}€</div>
                        <div className={`text-xs flex items-center justify-end gap-0.5 ${gain >= 0 ? 'text-gym' : 'text-destructive'}`}>
                          {gain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {gain >= 0 ? '+' : ''}{gain.toFixed(2)}€ ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                        </div>
                        <div className="text-xs text-muted-foreground">invertido: {(pos.invested_amount_eur || 0).toFixed(2)}€</div>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 justify-end">
                      <button onClick={() => setViewingPos(pos)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Ver detalle"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditPricePos(pos); setEditPriceForm({ current_price: pos.current_price || '', current_value_eur: pos.current_value_eur || '' }); setShowPriceEdit(true); }} className="p-1.5 text-muted-foreground hover:text-gold transition-colors" title="Editar precio"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditingPos(pos); setForm({ ticker: pos.ticker, name: pos.name, investment_type: pos.investment_type, invested_amount_eur: '', buy_price: '', currency: pos.currency || 'EUR', description: pos.description || '', date: format(new Date(), 'yyyy-MM-dd') }); setShowForm(true); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Añadir compra"><Plus className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setSellPos(pos); setSellAmount(''); setShowSellForm(true); }} className="p-1.5 text-muted-foreground hover:text-gym transition-colors" title="Vender"><ArrowUpRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(pos.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingPos ? `Añadir a ${editingPos.ticker}` : 'Nueva posición'}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/20 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            💰 Saldo disponible en día a día: <span className={`font-semibold ${dailyAvailable >= 0 ? 'text-gym' : 'text-destructive'}`}>{dailyAvailable.toFixed(2)}€</span>
          </div>
          <div className="space-y-3">
            {!editingPos && (
              <div>
                <Label className="text-foreground">Buscar por ticker o nombre</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ej: AAPL, Bitcoin, S&P500..." className="bg-muted/30 border-border" onKeyDown={e => e.key === 'Enter' && handleSearchTicker()} />
                  <Button onClick={handleSearchTicker} disabled={searching} size="sm" variant="outline" className="border-border">{searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : '🔍'}</Button>
                </div>
                {searchResult && <p className="text-xs text-gym mt-1">Encontrado: {searchResult.name} ({searchResult.ticker}) - {searchResult.price_eur || searchResult.price_usd}€</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Ticker</Label>
                <Input value={form.ticker} onChange={e => setForm(f => ({...f, ticker: e.target.value.toUpperCase()}))} placeholder="AAPL" className="mt-1 bg-muted/30 border-border" disabled={!!editingPos} />
              </div>
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Apple Inc." className="mt-1 bg-muted/30 border-border" disabled={!!editingPos} />
              </div>
            </div>
            {!editingPos && (
              <div>
                <Label className="text-foreground">Tipo</Label>
                <Select value={form.investment_type} onValueChange={v => setForm(f => ({...f, investment_type: v}))}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {INVESTMENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Dinero invertido (€)</Label>
                <Input type="number" value={form.invested_amount_eur} onChange={e => setForm(f => ({...f, invested_amount_eur: e.target.value}))} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
              </div>
              <div>
                <Label className="text-foreground">Precio compra</Label>
                <Input type="number" value={form.buy_price} onChange={e => setForm(f => ({...f, buy_price: e.target.value}))} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({...f, currency: v}))}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Descripción (opcional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Notas adicionales..." className="mt-1 bg-muted/30 border-border" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.ticker || !form.invested_amount_eur} className="bg-gold text-black hover:bg-gold/90">
              {editingPos ? 'Añadir compra' : 'Crear posición'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View position details */}
      <Dialog open={!!viewingPos} onOpenChange={() => setViewingPos(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">{viewingPos?.ticker} - {viewingPos?.name}</DialogTitle></DialogHeader>
          {viewingPos && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/20 rounded-lg p-2"><div className="text-xs text-muted-foreground">Invertido</div><div className="font-bold text-foreground">{(viewingPos.invested_amount_eur || 0).toFixed(2)}€</div></div>
                <div className="bg-muted/20 rounded-lg p-2"><div className="text-xs text-muted-foreground">Valor actual</div><div className="font-bold text-gold">{(viewingPos.current_value_eur || viewingPos.invested_amount_eur || 0).toFixed(2)}€</div></div>
              </div>
              {viewingPos.purchase_history && viewingPos.purchase_history.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Historial de compras</p>
                  <div className="space-y-1">
                    {viewingPos.purchase_history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                        <span className="text-muted-foreground">{h.date ? format(new Date(h.date), 'd MMM yyyy', { locale: es }) : '—'}</span>
                        <span className="text-foreground">{h.amount_eur}€</span>
                        <span className="text-muted-foreground">@ {h.buy_price} {h.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewingPos.last_updated && <p className="text-xs text-muted-foreground">Actualizado: {format(new Date(viewingPos.last_updated), "d MMM yyyy HH:mm", { locale: es })}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sell form */}
      <Dialog open={showSellForm} onOpenChange={setShowSellForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Vender {sellPos?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Valor disponible: <span className="text-foreground font-medium">{(sellPos?.current_value_eur || 0).toFixed(2)}€</span></p>
            <div>
              <Label className="text-foreground">Cantidad a vender (€)</Label>
              <Input type="number" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Fecha</Label>
              <Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
            <p className="text-xs text-muted-foreground">El dinero se transferirá a tu cuenta de día a día como ingreso.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSellForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSell} disabled={!sellAmount} className="bg-gym text-primary-foreground hover:bg-gym/90">Vender</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar posición?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit current price dialog */}
      <Dialog open={showPriceEdit} onOpenChange={setShowPriceEdit}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar precio — {editPricePos?.ticker}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Actualiza manualmente el precio actual y el valor en euros de tu posición.</p>
            <div>
              <Label className="text-foreground">Precio actual ({editPricePos?.currency || 'USD'})</Label>
              <Input type="number" value={editPriceForm.current_price} onChange={e => setEditPriceForm(f => ({...f, current_price: e.target.value}))} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Valor actual en EUR</Label>
              <Input type="number" value={editPriceForm.current_value_eur} onChange={e => setEditPriceForm(f => ({...f, current_value_eur: e.target.value}))} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPriceEdit(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSavePrice} className="bg-gold text-black hover:bg-gold/90">Actualizar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}