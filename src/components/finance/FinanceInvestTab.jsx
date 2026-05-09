import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart, Area, PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw,
  Eye, ArrowUpRight, ArrowDownRight, Search, X, ChevronDown,
  ChevronUp, Calendar, DollarSign, BarChart2, PieChart as PieIcon,
  Briefcase, Globe, Building2, Cpu, Zap, Droplets, ShoppingBag
} from 'lucide-react';
import { format, subMonths, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// ─── Constants ────────────────────────────────────────────────────────────────

const INVESTMENT_TYPES = [
  { id: 'stock', label: 'Acción', color: '#60a5fa', icon: TrendingUp },
  { id: 'etf', label: 'ETF', color: '#34d399', icon: BarChart2 },
  { id: 'index_fund', label: 'Fondo indexado', color: '#a78bfa', icon: Globe },
  { id: 'crypto', label: 'Crypto', color: '#f59e0b', icon: Zap },
  { id: 'bond', label: 'Bono', color: '#6ee7b7', icon: Building2 },
  { id: 'commodity', label: 'Materia prima', color: '#fbbf24', icon: Droplets },
  { id: 'reit', label: 'REIT', color: '#fb923c', icon: Building2 },
  { id: 'other', label: 'Otro', color: '#9ca3af', icon: Briefcase },
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

// Sectores inspirados en getquin
const SECTORS = [
  'Tecnología', 'Salud', 'Finanzas', 'Consumo discrecional',
  'Consumo básico', 'Energía', 'Materiales', 'Industria',
  'Servicios públicos', 'Inmobiliario', 'Comunicaciones', 'Criptomonedas', 'Otro',
];

// Regiones
const REGIONS = [
  'América del Norte', 'Europa', 'Asia Pacífico', 'Emergentes',
  'Global', 'América Latina', 'África/Oriente Medio',
];

// ─── Yahoo Finance helpers ────────────────────────────────────────────────────

/**
 * Busca un ticker en Yahoo Finance usando el endpoint de búsqueda.
 * Usamos un proxy CORS público para evitar bloqueos del navegador.
 */
async function searchYahoo(query) {
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&listsCount=0`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error('Yahoo search failed');
    const data = await res.json();
    return (data.quotes || []).filter(q => q.quoteType && q.symbol).map(q => ({
      ticker: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      exchange: q.exchange,
      type: q.quoteType,
    }));
  } catch {
    return [];
  }
}

/**
 * Obtiene precio actual y datos básicos de un ticker via Yahoo Finance v8.
 */
async function getYahooQuote(ticker) {
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error('Yahoo quote failed');
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    return {
      ticker: meta.symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.previousClose || meta.chartPreviousClose,
      currency: meta.currency,
      exchange: meta.exchangeName,
      marketCap: meta.marketCap,
    };
  } catch {
    return null;
  }
}

/**
 * Obtiene historial de precios de los últimos N meses.
 */
async function getYahooHistory(ticker, months = 12) {
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=${months}mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    return timestamps.map((ts, i) => ({
      date: format(new Date(ts * 1000), 'MMM yy', { locale: es }),
      price: closes[i] ? +closes[i].toFixed(2) : null,
    })).filter(d => d.price !== null);
  } catch {
    return [];
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-xl">
      <p style={{ color: payload[0].payload.color }}>
        {payload[0].name}: {payload[0].value?.toFixed(2)}€
        {' '}({((payload[0].payload.pct || 0) * 100).toFixed(1)}%)
      </p>
    </div>
  );
};

const StatCard = ({ label, value, sub, color, icon: Icon }) => (
  <Card className="glass-card">
    <CardContent className="pt-4 pb-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className={`text-xl font-grotesk font-bold ${color || 'text-foreground'}`}>{value}</div>
          {sub && <div className={`text-xs mt-0.5 flex items-center gap-0.5 ${color || 'text-muted-foreground'}`}>{sub}</div>}
        </div>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground/50 mt-1" />}
      </div>
    </CardContent>
  </Card>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinanceInvestTab() {
  const [positions, setPositions] = useState([]);
  const [dailyTxs, setDailyTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [viewingPos, setViewingPos] = useState(null);
  const [viewHistory, setViewHistory] = useState([]);
  const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellPos, setSellPos] = useState(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellDate, setSellDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [editPricePos, setEditPricePos] = useState(null);
  const [editPriceForm, setEditPriceForm] = useState({ current_price: '', current_value_eur: '' });

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  const emptyForm = () => ({
    ticker: '', name: '', investment_type: 'stock',
    invested_amount_eur: '', buy_price: '', currency: 'EUR',
    description: '', date: format(new Date(), 'yyyy-MM-dd'),
    sector: '', region: '',
  });
  const [form, setForm] = useState(emptyForm());

  // ─── Data fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const [pos, txs] = await Promise.all([
      base44.entities.InvestmentPosition.list('-created_date', 100),
      base44.entities.FinanceTransaction.list('-date', 1000),
    ]);
    setPositions(pos);
    setDailyTxs(txs);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Derived metrics ─────────────────────────────────────────────────────────

  const dailyIncome = dailyTxs.filter(t => ['income', 'transfer_from_savings', 'transfer_from_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyOut = dailyTxs.filter(t => ['expense', 'other', 'transfer_to_savings', 'transfer_to_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyAvailable = dailyIncome - dailyOut;

  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const getGain = (pos) => (pos.current_value_eur || pos.invested_amount_eur || 0) - (pos.invested_amount_eur || 0);
  const getGainPct = (pos) => {
    const inv = pos.invested_amount_eur || 0;
    return inv === 0 ? 0 : (getGain(pos) / inv) * 100;
  };
  const getTypeInfo = (id) => INVESTMENT_TYPES.find(t => t.id === id) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];

  // Chart data
  const totalVal = totalCurrentValue || 1;
  const typeGroups = {};
  positions.forEach(p => {
    const t = getTypeInfo(p.investment_type);
    if (!typeGroups[p.investment_type]) typeGroups[p.investment_type] = { name: t.label, value: 0, color: t.color, pct: 0 };
    typeGroups[p.investment_type].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  Object.values(typeGroups).forEach(g => { g.pct = g.value / totalVal; });
  const typeData = Object.values(typeGroups);

  const positionData = positions.map(p => ({
    name: p.ticker,
    value: +(p.current_value_eur || p.invested_amount_eur || 0).toFixed(2),
    color: getTypeInfo(p.investment_type).color,
    pct: (p.current_value_eur || p.invested_amount_eur || 0) / totalVal,
  }));

  // Sector breakdown
  const sectorGroups = {};
  positions.forEach(p => {
    const sec = p.sector || 'Sin sector';
    if (!sectorGroups[sec]) sectorGroups[sec] = { name: sec, value: 0 };
    sectorGroups[sec].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const sectorData = Object.values(sectorGroups).sort((a, b) => b.value - a.value);

  // Region breakdown
  const regionGroups = {};
  positions.forEach(p => {
    const reg = p.region || 'Sin región';
    if (!regionGroups[reg]) regionGroups[reg] = { name: reg, value: 0 };
    regionGroups[reg].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const regionData = Object.values(regionGroups).sort((a, b) => b.value - a.value);

  // Best/worst performers
  const sorted = [...positions].sort((a, b) => getGainPct(b) - getGainPct(a));
  const topPerformers = sorted.slice(0, 3);
  const worstPerformers = sorted.slice(-3).reverse();

  // ─── Yahoo Finance actions ────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    const results = await searchYahoo(searchQuery);
    setSearchResults(results);
    setSearchLoading(false);
  };

  const handleSelectResult = async (result) => {
    setSelectedResult(result);
    setForm(f => ({ ...f, ticker: result.ticker, name: result.name }));
    // Fetch price
    const quote = await getYahooQuote(result.ticker);
    if (quote) {
      setForm(f => ({
        ...f,
        buy_price: quote.price?.toFixed(2) || '',
        currency: quote.currency || 'USD',
      }));
    }
    setSearchResults([]);
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    for (const pos of positions) {
      try {
        const quote = await getYahooQuote(pos.ticker);
        if (quote && quote.price) {
          // Calcular nuevo valor en EUR
          let currentValueEur = pos.invested_amount_eur || 0;
          if (pos.buy_price && pos.buy_price > 0) {
            const units = pos.invested_amount_eur / (pos.buy_price * (pos.fx_rate || 1));
            let priceEur = quote.price;
            // Si la moneda no es EUR, usar tipo de cambio guardado o estimar
            if (quote.currency !== 'EUR' && pos.fx_rate) {
              priceEur = quote.price * pos.fx_rate;
            }
            currentValueEur = units * priceEur;
          }
          await base44.entities.InvestmentPosition.update(pos.id, {
            current_price: quote.price,
            current_value_eur: +currentValueEur.toFixed(2),
            last_updated: new Date().toISOString(),
          });
        }
      } catch (e) { console.error(e); }
    }
    await fetchData();
    setRefreshing(false);
  };

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const amount = parseFloat(form.invested_amount_eur);
    if (!amount || amount <= 0) return;
    if (!editingPos && amount > dailyAvailable) {
      alert(`No tienes suficiente saldo. Disponible: ${dailyAvailable.toFixed(2)}€`);
      return;
    }

    const buyPrice = parseFloat(form.buy_price) || 0;
    // Tipo de cambio EUR si la moneda no es EUR (simplificado: guardar el precio en EUR/moneda)
    const fxRate = form.currency !== 'EUR' && buyPrice > 0 ? (amount / buyPrice) : 1;

    const data = {
      ticker: form.ticker.toUpperCase(),
      name: form.name,
      investment_type: form.investment_type,
      invested_amount_eur: amount,
      buy_price: buyPrice,
      currency: form.currency,
      description: form.description,
      date: form.date,
      sector: form.sector,
      region: form.region,
      current_value_eur: amount,
      current_price: buyPrice,
      fx_rate: fxRate,
    };

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
        date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency,
      }];
      await base44.entities.InvestmentPosition.update(editingPos.id, {
        ...data,
        invested_amount_eur: (editingPos.invested_amount_eur || 0) + amount,
        current_value_eur: (editingPos.current_value_eur || editingPos.invested_amount_eur || 0) + amount,
        purchase_history: newHistory,
      });
    } else {
      await base44.entities.InvestmentPosition.create({
        ...data,
        purchase_history: [{ date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }],
      });
    }
    setShowForm(false);
    setEditingPos(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResult(null);
    setForm(emptyForm());
    fetchData();
  };

  const handleSell = async () => {
    if (!sellPos || !sellAmount) return;
    const amount = parseFloat(sellAmount);
    const currentValue = sellPos.current_value_eur || sellPos.invested_amount_eur || 0;
    if (amount > currentValue) { alert(`Solo puedes vender hasta ${currentValue.toFixed(2)}€`); return; }
    const ratio = amount / currentValue;
    await base44.entities.InvestmentPosition.update(sellPos.id, {
      current_value_eur: +(currentValue - amount).toFixed(2),
      invested_amount_eur: +((sellPos.invested_amount_eur || 0) * (1 - ratio)).toFixed(2),
    });
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
    if (Object.keys(updates).length) {
      updates.last_updated = new Date().toISOString();
      await base44.entities.InvestmentPosition.update(editPricePos.id, updates);
    }
    setShowPriceEdit(false);
    setEditPricePos(null);
    fetchData();
  };

  const openViewPos = async (pos) => {
    setViewingPos(pos);
    setViewHistoryLoading(true);
    const hist = await getYahooHistory(pos.ticker, 12);
    setViewHistory(hist);
    setViewHistoryLoading(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  );

  const SECTOR_COLORS = ['#60a5fa','#34d399','#a78bfa','#f59e0b','#fb923c','#f87171','#6ee7b7','#c4b5fd','#fbbf24','#4ade80','#38bdf8','#e879f9'];
  const REGION_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16'];

  return (
    <div className="space-y-4">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Valor total" value={`${totalCurrentValue.toFixed(2)}€`} color="text-gold" icon={TrendingUp} />
        <StatCard label="Total invertido" value={`${totalInvested.toFixed(2)}€`} icon={DollarSign} />
        <StatCard
          label="Ganancia / Pérdida"
          value={`${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)}€`}
          sub={<>{totalGain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{totalGain >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%</>}
          color={totalGain >= 0 ? 'text-gym' : 'text-destructive'}
          icon={totalGain >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard label="Posiciones" value={positions.length.toString()} icon={Briefcase} />
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" onClick={() => { setEditingPos(null); setForm(emptyForm()); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setShowForm(true); }}
          className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Nueva posición
        </Button>
        <Button size="sm" onClick={handleRefreshPrices} disabled={refreshing || positions.length === 0}
          variant="outline" className="border-border text-xs gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar precios'}
        </Button>
        {positions.length > 0 && (
          <span className="text-xs text-muted-foreground">
            💡 Precios vía Yahoo Finance en tiempo real
          </span>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/30 w-full">
          <TabsTrigger value="overview" className="flex-1 text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold">
            <PieIcon className="w-3.5 h-3.5 mr-1" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="positions" className="flex-1 text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold">
            <Briefcase className="w-3.5 h-3.5 mr-1" /> Posiciones
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex-1 text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold">
            <BarChart2 className="w-3.5 h-3.5 mr-1" /> Análisis
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {positions.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Sin posiciones aún</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Añade tu primera inversión para empezar a trackear</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Pie charts como getquin */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-foreground text-sm flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-gold" /> Por tipo de activo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={typeData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" nameKey="name" paddingAngle={2}>
                          {typeData.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-foreground text-sm flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-gold" /> Por posición
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={positionData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" nameKey="name" paddingAngle={2}>
                          {positionData.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top/Worst performers como getquin */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="glass-card border-gym/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-gym text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Mejores performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topPerformers.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-3">Sin datos</p>
                      : topPerformers.map(pos => (
                        <div key={pos.id} className="flex items-center justify-between p-2 bg-gym/5 rounded-lg border border-gym/10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-gym/10 text-gym">{pos.ticker?.slice(0, 3)}</div>
                            <div>
                              <div className="text-xs font-medium text-foreground">{pos.ticker}</div>
                              <div className="text-[10px] text-muted-foreground">{pos.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-gym">+{getGainPct(pos).toFixed(2)}%</div>
                            <div className="text-[10px] text-gym">+{getGain(pos).toFixed(2)}€</div>
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                <Card className="glass-card border-destructive/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-destructive text-sm flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" /> Peores performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {worstPerformers.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-3">Sin datos</p>
                      : worstPerformers.map(pos => (
                        <div key={pos.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg border border-destructive/10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-destructive/10 text-destructive">{pos.ticker?.slice(0, 3)}</div>
                            <div>
                              <div className="text-xs font-medium text-foreground">{pos.ticker}</div>
                              <div className="text-[10px] text-muted-foreground">{pos.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-bold ${getGainPct(pos) >= 0 ? 'text-gym' : 'text-destructive'}`}>{getGainPct(pos) >= 0 ? '+' : ''}{getGainPct(pos).toFixed(2)}%</div>
                            <div className={`text-[10px] ${getGain(pos) >= 0 ? 'text-gym' : 'text-destructive'}`}>{getGain(pos) >= 0 ? '+' : ''}{getGain(pos).toFixed(2)}€</div>
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Positions tab ── */}
        <TabsContent value="positions" className="space-y-3 mt-4">
          {positions.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <Briefcase className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Sin posiciones</p>
              </CardContent>
            </Card>
          ) : (
            positions.map(pos => {
              const gain = getGain(pos);
              const gainPct = getGainPct(pos);
              const typeInfo = getTypeInfo(pos.investment_type);
              const currentValue = pos.current_value_eur || pos.invested_amount_eur || 0;
              const alloc = totalCurrentValue > 0 ? (currentValue / totalCurrentValue) * 100 : 0;

              return (
                <Card key={pos.id} className="glass-card hover:border-gold/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color, border: `1px solid ${typeInfo.color}30` }}>
                          {pos.ticker?.slice(0, 4)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                            {pos.ticker}
                            {pos.current_price ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                {pos.current_price} {pos.currency}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{pos.name}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ color: typeInfo.color, borderColor: `${typeInfo.color}40` }}>
                              {typeInfo.label}
                            </Badge>
                            {pos.sector && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">{pos.sector}</Badge>}
                            {pos.region && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground"><Globe className="w-2.5 h-2.5 mr-0.5" />{pos.region}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground text-base">{currentValue.toFixed(2)}€</div>
                        <div className={`text-xs flex items-center justify-end gap-0.5 font-medium ${gain >= 0 ? 'text-gym' : 'text-destructive'}`}>
                          {gain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {gain >= 0 ? '+' : ''}{gain.toFixed(2)}€ ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {alloc.toFixed(1)}% del portafolio
                        </div>
                      </div>
                    </div>

                    {/* Allocation bar */}
                    <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(alloc, 100)}%`, backgroundColor: typeInfo.color }} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                      <span>Invertido: {(pos.invested_amount_eur || 0).toFixed(2)}€</span>
                      {pos.last_updated && <span>Act: {format(new Date(pos.last_updated), 'd MMM HH:mm', { locale: es })}</span>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openViewPos(pos)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors" title="Ver gráfico">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditPricePos(pos); setEditPriceForm({ current_price: pos.current_price || '', current_value_eur: pos.current_value_eur || '' }); setShowPriceEdit(true); }}
                        className="p-1.5 text-muted-foreground hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" title="Editar precio">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingPos(pos); setForm({ ...emptyForm(), ticker: pos.ticker, name: pos.name, investment_type: pos.investment_type, currency: pos.currency || 'EUR', sector: pos.sector || '', region: pos.region || '' }); setShowForm(true); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors" title="Añadir compra">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setSellPos(pos); setSellAmount(''); setShowSellForm(true); }}
                        className="p-1.5 text-muted-foreground hover:text-gym hover:bg-gym/10 rounded-lg transition-colors" title="Vender">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(pos.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Analysis tab ── */}
        <TabsContent value="analysis" className="space-y-4 mt-4">
          {positions.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Sin datos para analizar</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Por sector */}
              {sectorData.some(s => s.name !== 'Sin sector') && (
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-foreground text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gold" /> Distribución por sector
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sectorData.map((s, i) => {
                        const pct = totalCurrentValue > 0 ? (s.value / totalCurrentValue) * 100 : 0;
                        return (
                          <div key={s.name} className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground w-28 truncate">{s.name}</div>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                            </div>
                            <div className="text-xs text-foreground font-medium w-10 text-right">{pct.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground w-16 text-right">{s.value.toFixed(0)}€</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Por región */}
              {regionData.some(r => r.name !== 'Sin región') && (
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-foreground text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gold" /> Distribución geográfica
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {regionData.map((r, i) => {
                        const pct = totalCurrentValue > 0 ? (r.value / totalCurrentValue) * 100 : 0;
                        return (
                          <div key={r.name} className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground w-28 truncate">{r.name}</div>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: REGION_COLORS[i % REGION_COLORS.length] }} />
                            </div>
                            <div className="text-xs text-foreground font-medium w-10 text-right">{pct.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground w-16 text-right">{r.value.toFixed(0)}€</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabla de posiciones detallada como getquin */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground text-sm">Detalle de posiciones</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left pb-2 font-medium">Activo</th>
                        <th className="text-right pb-2 font-medium">Invertido</th>
                        <th className="text-right pb-2 font-medium">Valor</th>
                        <th className="text-right pb-2 font-medium">Ganancia</th>
                        <th className="text-right pb-2 font-medium">%</th>
                        <th className="text-right pb-2 font-medium">Peso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(pos => {
                        const gain = getGain(pos);
                        const gainPct = getGainPct(pos);
                        const current = pos.current_value_eur || pos.invested_amount_eur || 0;
                        const weight = totalCurrentValue > 0 ? (current / totalCurrentValue) * 100 : 0;
                        return (
                          <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="py-2">
                              <div className="font-medium text-foreground">{pos.ticker}</div>
                              <div className="text-muted-foreground text-[10px]">{pos.name}</div>
                            </td>
                            <td className="text-right py-2 text-muted-foreground">{(pos.invested_amount_eur || 0).toFixed(2)}€</td>
                            <td className="text-right py-2 font-medium text-foreground">{current.toFixed(2)}€</td>
                            <td className={`text-right py-2 font-medium ${gain >= 0 ? 'text-gym' : 'text-destructive'}`}>{gain >= 0 ? '+' : ''}{gain.toFixed(2)}€</td>
                            <td className={`text-right py-2 font-medium ${gainPct >= 0 ? 'text-gym' : 'text-destructive'}`}>{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%</td>
                            <td className="text-right py-2 text-muted-foreground">{weight.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td className="pt-2 font-semibold text-foreground">Total</td>
                        <td className="text-right pt-2 font-semibold text-foreground">{totalInvested.toFixed(2)}€</td>
                        <td className="text-right pt-2 font-semibold text-foreground">{totalCurrentValue.toFixed(2)}€</td>
                        <td className={`text-right pt-2 font-semibold ${totalGain >= 0 ? 'text-gym' : 'text-destructive'}`}>{totalGain >= 0 ? '+' : ''}{totalGain.toFixed(2)}€</td>
                        <td className={`text-right pt-2 font-semibold ${totalGainPct >= 0 ? 'text-gym' : 'text-destructive'}`}>{totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%</td>
                        <td className="text-right pt-2 text-muted-foreground">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Add/Edit form dialog ─── */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setSearchResults([]); setSelectedResult(null); } }}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingPos ? `Añadir a ${editingPos.ticker}` : 'Nueva posición'}</DialogTitle>
          </DialogHeader>

          <div className="bg-muted/20 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            💰 Saldo disponible: <span className={`font-semibold ${dailyAvailable >= 0 ? 'text-gym' : 'text-destructive'}`}>{dailyAvailable.toFixed(2)}€</span>
          </div>

          {/* Search with real Yahoo Finance */}
          {!editingPos && (
            <div className="space-y-2">
              <Label className="text-foreground">Buscar por ticker o nombre</Label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Ej: AAPL, Bitcoin, MSCI World..."
                  className="bg-muted/30 border-border"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchLoading} size="sm" variant="outline" className="border-border shrink-0">
                  {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="border border-border rounded-xl bg-card shadow-xl overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.ticker} onClick={() => handleSelectResult(r)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 text-left border-b border-border/50 last:border-0 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-foreground">{r.ticker}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{r.exchange}</div>
                        <div className="text-xs text-muted-foreground">{r.type}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedResult && (
                <div className="flex items-center gap-2 text-xs text-gym bg-gym/10 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-gym" />
                  Seleccionado: <span className="font-medium">{selectedResult.ticker}</span> — {selectedResult.name}
                  <button onClick={() => { setSelectedResult(null); setForm(f => ({ ...f, ticker: '', name: '' })); }} className="ml-auto">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Ticker</Label>
                <Input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="AAPL" className="mt-1 bg-muted/30 border-border" disabled={!!editingPos} />
              </div>
              <div>
                <Label className="text-foreground">Nombre</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Apple Inc." className="mt-1 bg-muted/30 border-border" disabled={!!editingPos} />
              </div>
            </div>

            {!editingPos && (
              <>
                <div>
                  <Label className="text-foreground">Tipo</Label>
                  <Select value={form.investment_type} onValueChange={v => setForm(f => ({ ...f, investment_type: v }))}>
                    <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {INVESTMENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-foreground">Sector</Label>
                    <Select value={form.sector} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                      <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Región</Label>
                    <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                      <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Dinero invertido (€)</Label>
                <Input type="number" value={form.invested_amount_eur} onChange={e => setForm(f => ({ ...f, invested_amount_eur: e.target.value }))}
                  placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
              </div>
              <div>
                <Label className="text-foreground">Precio compra</Label>
                <Input type="number" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                  placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
              </div>
            </div>

            <div>
              <Label className="text-foreground">Descripción (opcional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Notas adicionales..." className="mt-1 bg-muted/30 border-border" />
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

      {/* ─── View position + chart ─── */}
      <Dialog open={!!viewingPos} onOpenChange={() => { setViewingPos(null); setViewHistory([]); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: `${getTypeInfo(viewingPos?.investment_type).color}20`, color: getTypeInfo(viewingPos?.investment_type).color }}>
                {viewingPos?.ticker?.slice(0, 3)}
              </div>
              {viewingPos?.ticker} — {viewingPos?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingPos && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <div className="text-xs text-muted-foreground">Invertido</div>
                  <div className="font-bold text-foreground">{(viewingPos.invested_amount_eur || 0).toFixed(2)}€</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <div className="text-xs text-muted-foreground">Valor actual</div>
                  <div className="font-bold text-gold">{(viewingPos.current_value_eur || viewingPos.invested_amount_eur || 0).toFixed(2)}€</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <div className="text-xs text-muted-foreground">Ganancia</div>
                  <div className={`font-bold ${getGain(viewingPos) >= 0 ? 'text-gym' : 'text-destructive'}`}>
                    {getGain(viewingPos) >= 0 ? '+' : ''}{getGain(viewingPos).toFixed(2)}€
                  </div>
                </div>
              </div>

              {/* Gráfico histórico de Yahoo Finance */}
              <div>
                <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                  <BarChart2 className="w-3.5 h-3.5 text-gold" /> Precio histórico (12 meses)
                </div>
                {viewHistoryLoading ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /></div>
                ) : viewHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={viewHistory}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} width={45} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Area type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} fill="url(#priceGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs">No hay datos históricos disponibles para {viewingPos.ticker}</div>
                )}
              </div>

              {/* Historial de compras */}
              {viewingPos.purchase_history?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Historial de compras</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {viewingPos.purchase_history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                        <span className="text-muted-foreground">{h.date ? format(new Date(h.date), 'd MMM yyyy', { locale: es }) : '—'}</span>
                        <span className="text-foreground font-medium">{h.amount_eur}€</span>
                        <span className="text-muted-foreground">@ {h.buy_price} {h.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Sell dialog ─── */}
      <Dialog open={showSellForm} onOpenChange={setShowSellForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Vender {sellPos?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Disponible: <span className="text-foreground font-medium">{(sellPos?.current_value_eur || 0).toFixed(2)}€</span></p>
            <div>
              <Label className="text-foreground">Cantidad a vender (€)</Label>
              <Input type="number" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Fecha</Label>
              <Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
            <p className="text-xs text-muted-foreground">El dinero se transferirá a tu cuenta de día a día.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSellForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSell} disabled={!sellAmount} className="bg-gym text-primary-foreground hover:bg-gym/90">Vender</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit price dialog ─── */}
      <Dialog open={showPriceEdit} onOpenChange={setShowPriceEdit}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar precio — {editPricePos?.ticker}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Actualiza manualmente el precio y valor actual de la posición.</p>
            <div>
              <Label className="text-foreground">Precio actual ({editPricePos?.currency || 'USD'})</Label>
              <Input type="number" value={editPriceForm.current_price} onChange={e => setEditPriceForm(f => ({ ...f, current_price: e.target.value }))}
                placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Valor actual en EUR</Label>
              <Input type="number" value={editPriceForm.current_value_eur} onChange={e => setEditPriceForm(f => ({ ...f, current_value_eur: e.target.value }))}
                placeholder="0.00" className="mt-1 bg-muted/30 border-border" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPriceEdit(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSavePrice} className="bg-gold text-black hover:bg-gold/90">Actualizar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation ─── */}
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
    </div>
  );
}
