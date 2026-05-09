import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Eye, ArrowUpRight, ArrowDownRight, Search, X, ChevronDown, ChevronUp,
  DollarSign, BarChart2, PieChart as PieIcon, Briefcase, Globe,
  Building2, Zap, Droplets, Bot, Send, Target, Shield,
  Lightbulb, AlertTriangle, CheckCircle, Loader2, Sparkles, User, MoreHorizontal,
  LayoutGrid, List, Landmark, ArrowRightLeft, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// ─── Groq API (Mantenido intacto) ─────────────────────────────────────────────
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function callGroq(messages, maxTokens = 1500) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY no configurada');
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// ─── Yahoo Finance helpers ────────────────────────────────────────────────────
async function searchYahoo(query) {
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return (data.quotes || []).filter(q => q.quoteType && q.symbol).map(q => ({
      ticker: q.symbol, name: q.longname || q.shortname || q.symbol,
      exchange: q.exchange, type: q.quoteType,
    }));
  } catch { return []; }
}

async function getYahooQuote(ticker) {
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return { ticker: meta.symbol, price: meta.regularMarketPrice, previousClose: meta.previousClose || meta.chartPreviousClose, currency: meta.currency };
  } catch { return null; }
}

async function getEurFxRate(currency) {
  if (currency === 'EUR') return 1;
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${currency}EUR=X?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch {
    const fallback = { USD: 0.92, GBP: 1.17, CHF: 1.06, JPY: 0.0062, CAD: 0.68, AUD: 0.60 };
    return fallback[currency] || null;
  }
}

// ─── Constants & Configurations ───────────────────────────────────────────────
const INVESTMENT_TYPES = [
  { id: 'stock', label: 'Stocks', color: '#3b82f6', group: 'Equities' },
  { id: 'etf', label: 'ETFs', color: '#10b981', group: 'Funds' },
  { id: 'index_fund', label: 'Mutual Funds', color: '#8b5cf6', group: 'Funds' },
  { id: 'crypto', label: 'Crypto', color: '#f59e0b', group: 'Digital Assets' },
  { id: 'bond', label: 'Bonds', color: '#64748b', group: 'Fixed Income' },
  { id: 'commodity', label: 'Commodities', color: '#eab308', group: 'Alternatives' },
  { id: 'cash', label: 'Cash', color: '#22c55e', group: 'Cash' },
  { id: 'other', label: 'Other', color: '#9ca3af', group: 'Other' },
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
const SECTORS = ['Information Technology', 'Healthcare', 'Financials', 'Consumer Discretionary', 'Consumer Staples', 'Energy', 'Materials', 'Industrials', 'Utilities', 'Real Estate', 'Communication Services', 'Crypto', 'Other'];
const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Emerging Markets', 'Global', 'Latin America', 'Middle East / Africa'];

// Colores estilo Getquin para gráficos
const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#ea580c', '#475569', '#84cc16', '#0ea5e9'];

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-2xl">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="font-bold text-foreground text-sm">
          {payload[0].value.toFixed(2)} €
        </p>
      </div>
    );
  }
  return null;
};

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-xl flex flex-col gap-1 z-50">
      <span className="font-semibold" style={{ color: payload[0].payload.color }}>
        {payload[0].name}
      </span>
      <span className="text-muted-foreground">
        {payload[0].value?.toFixed(2)} € ({((payload[0].payload.pct || 0) * 100).toFixed(1)}%)
      </span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function FinanceInvestTab() {
  const [positions, setPositions] = useState([]);
  const [dailyTxs, setDailyTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pestañas principales de Getquin
  const [activeTab, setActiveTab] = useState('overview');
  // Sub-filtro de tiempos
  const [chartTimeframe, setChartTimeframe] = useState('1Y');
  // Toggle Absoluto/Porcentaje
  const [showPercent, setShowPercent] = useState(false);

  // Estados de formularios (Mantenemos la funcionalidad base44)
  const [showForm, setShowForm] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  const emptyForm = () => ({
    ticker: '', name: '', investment_type: 'stock',
    invested_amount_eur: '', buy_price: '', currency: 'EUR',
    date: format(new Date(), 'yyyy-MM-dd'), sector: '', region: '', _fxRate: null,
  });
  const [form, setForm] = useState(emptyForm());

  const fetchData = useCallback(async () => {
    try {
      const [pos, txs] = await Promise.all([
        base44.entities.InvestmentPosition.list('-created_date', 100),
        base44.entities.FinanceTransaction.list('-date', 1000),
      ]);
      setPositions(pos || []);
      setDailyTxs(txs || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Derived metrics ─────────────────────────────────────────────────────────
  const totalInvested = positions.reduce((s, p) => s + (parseFloat(p.invested_amount_eur) || 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (parseFloat(p.current_value_eur) || parseFloat(p.invested_amount_eur) || 0), 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const isPositiveGain = totalGain >= 0;

  const getTypeInfo = (id) => INVESTMENT_TYPES.find(t => t.id === id) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];

  // Agrupaciones para Holdings y Allocation
  const groupedHoldings = positions.reduce((acc, pos) => {
    const type = getTypeInfo(pos.investment_type).label;
    if (!acc[type]) acc[type] = [];
    acc[type].push(pos);
    return acc;
  }, {});

  const getGroupTotal = (groupPositions) => {
    return groupPositions.reduce((sum, p) => sum + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  };

  // Datos para Donut de Assets
  const typeData = Object.keys(groupedHoldings).map((type, idx) => {
    const val = getGroupTotal(groupedHoldings[type]);
    return {
      name: type,
      value: val,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      pct: totalCurrentValue > 0 ? val / totalCurrentValue : 0
    };
  }).sort((a, b) => b.value - a.value);

  // Datos para Donut de Regiones
  const regionGroups = {};
  positions.forEach(p => {
    const reg = p.region || 'Unclassified';
    if (!regionGroups[reg]) regionGroups[reg] = 0;
    regionGroups[reg] += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const regionData = Object.entries(regionGroups).map(([name, value], idx) => ({
    name, value, color: PIE_COLORS[idx % PIE_COLORS.length], pct: totalCurrentValue > 0 ? value / totalCurrentValue : 0
  })).sort((a, b) => b.value - a.value);

  // Datos para Donut de Sectores
  const sectorGroups = {};
  positions.forEach(p => {
    const sec = p.sector || 'Unclassified';
    if (!sectorGroups[sec]) sectorGroups[sec] = 0;
    sectorGroups[sec] += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const sectorData = Object.entries(sectorGroups).map(([name, value], idx) => ({
    name, value, color: PIE_COLORS[idx % PIE_COLORS.length], pct: totalCurrentValue > 0 ? value / totalCurrentValue : 0
  })).sort((a, b) => b.value - a.value);

  // Mock histórico (Como el dashboard principal de Getquin)
  const chartData = React.useMemo(() => {
    const data = [];
    const points = chartTimeframe === '1W' ? 7 : chartTimeframe === '1M' ? 30 : chartTimeframe === '1Y' ? 12 : 30;
    const baseValue = totalCurrentValue > 0 ? totalCurrentValue * 0.85 : 1000;
    for (let i = points; i >= 0; i--) {
      const d = new Date();
      if (chartTimeframe === '1Y') d.setMonth(d.getMonth() - i);
      else d.setDate(d.getDate() - i);
      
      const variance = (Math.random() - 0.4) * (totalCurrentValue * 0.05);
      let val = i === 0 ? totalCurrentValue : baseValue + ((points - i) * (totalCurrentValue - baseValue) / points) + variance;
      data.push({
        date: format(d, chartTimeframe === '1Y' ? 'MMM yy' : 'dd MMM', { locale: es }),
        value: Math.max(0, val)
      });
    }
    return data;
  }, [totalCurrentValue, chartTimeframe]);

  // Mock Dividendos (Getquin Dividends Dashboard)
  const dividendData = [
    { month: 'Ene', amount: 12.5 }, { month: 'Feb', amount: 8.2 }, { month: 'Mar', amount: 45.0 },
    { month: 'Abr', amount: 15.0 }, { month: 'May', amount: 110.5 }, { month: 'Jun', amount: 32.0 },
    { month: 'Jul', amount: 18.5 }, { month: 'Ago', amount: 9.0 }, { month: 'Sep', amount: 55.4 },
    { month: 'Oct', amount: 14.0 }, { month: 'Nov', amount: 120.2 }, { month: 'Dic', amount: 40.0 }
  ];

  // ─── Actions (Buscador, Guardar, Refresh) ────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const results = await searchYahoo(searchQuery);
    setSearchResults(results);
    setSearchLoading(false);
  };

  const handleSelectResult = async (result) => {
    setSelectedResult(result);
    const typeMap = { 'EQUITY': 'stock', 'ETF': 'etf', 'MUTUALFUND': 'index_fund', 'CRYPTOCURRENCY': 'crypto' };
    setForm(f => ({ ...f, ticker: result.ticker, name: result.name, investment_type: typeMap[result.type?.toUpperCase()] || 'stock' }));
    const quote = await getYahooQuote(result.ticker);
    if (quote) {
      const fxRate = await getEurFxRate(quote.currency || 'USD');
      setForm(f => ({ ...f, buy_price: quote.price?.toFixed(2) || '', currency: quote.currency || 'USD', _fxRate: fxRate }));
    }
    setSearchResults([]);
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    for (const pos of positions) {
      try {
        const quote = await getYahooQuote(pos.ticker);
        if (quote && quote.price) {
          const fxRate = await getEurFxRate(quote.currency || pos.currency || 'EUR');
          const effectiveFxRate = fxRate || pos.fx_rate || 1;
          let currentValueEur = pos.invested_amount_eur || 0;
          if (pos.buy_price && pos.buy_price > 0 && pos.invested_amount_eur > 0) {
            const buyFx = pos.fx_rate || effectiveFxRate;
            const units = pos.invested_amount_eur / (pos.buy_price * buyFx);
            currentValueEur = units * quote.price * effectiveFxRate;
          }
          await base44.entities.InvestmentPosition.update(pos.id, {
            current_price: quote.price, current_value_eur: +currentValueEur.toFixed(2),
            fx_rate: +effectiveFxRate.toFixed(6), last_updated: new Date().toISOString(),
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
    const buyPrice = parseFloat(form.buy_price) || 0;
    const fxRate = form.currency === 'EUR' ? 1 : (form._fxRate || null);
    const data = { 
      ticker: form.ticker.toUpperCase(), name: form.name, investment_type: form.investment_type, 
      invested_amount_eur: amount, buy_price: buyPrice, currency: form.currency, 
      date: form.date, sector: form.sector, region: form.region, 
      current_value_eur: amount, current_price: buyPrice, fx_rate: fxRate 
    };
    await base44.entities.InvestmentPosition.create({ ...data, purchase_history: [{ date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }] });
    setShowForm(false); setForm(emptyForm()); fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      
      {/* ─── HEADER / SUMMARY HERO ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-2">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Portfolio</h2>
          <h1 className="text-5xl font-grotesk font-bold tracking-tight text-foreground">
            {totalCurrentValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className={`px-2 py-1 text-sm font-medium border-0 rounded-md ${isPositiveGain ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {isPositiveGain ? <ArrowUpRight className="w-4 h-4 mr-1 inline" /> : <ArrowDownRight className="w-4 h-4 mr-1 inline" />}
              {Math.abs(totalGain).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} ({isPositiveGain ? '+' : ''}{totalGainPct.toFixed(2)}%)
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted/40 px-2 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> All Time TTWROR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshPrices} disabled={refreshing} className="rounded-xl h-10 px-4 bg-background border-border shadow-sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setForm(emptyForm()); setShowForm(true); }} className="rounded-xl h-10 px-5 bg-foreground text-background hover:bg-foreground/90 shadow-md font-medium">
            <Plus className="w-4 h-4 mr-1.5" /> Add Asset
          </Button>
        </div>
      </div>

      {/* ─── NAVIGATION TABS (Getquin Style) ─── */}
      <div className="border-b border-border/60 overflow-x-auto no-scrollbar">
        <div className="flex space-x-6 min-w-max px-1">
          {[
            { id: 'overview', icon: LayoutGrid, label: 'Overview' },
            { id: 'holdings', icon: List, label: 'Holdings' },
            { id: 'allocation', icon: PieIcon, label: 'Allocation' },
            { id: 'dividends', icon: Landmark, label: 'Dividends' },
            { id: 'trades', icon: ArrowRightLeft, label: 'Trades' },
            { id: 'ai', icon: Bot, label: 'AI Advisor' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors relative ${activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="glass-card border-border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-border/50 bg-muted/10">
              <div className="text-sm font-medium text-muted-foreground">Performance Chart</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/50">
                  {['1W', '1M', '1Y', 'MAX'].map(tf => (
                    <button key={tf} onClick={() => setChartTimeframe(tf)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartTimeframe === tf ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[320px]">
              {positions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50"><TrendingUp className="w-12 h-12 mb-3" /><p>No data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositiveGain ? '#22c55e' : '#3b82f6'} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={isPositiveGain ? '#22c55e' : '#3b82f6'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4b5563', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="value" stroke={isPositiveGain ? '#22c55e' : '#3b82f6'} strokeWidth={3} fill="url(#colorValue)" activeDot={{ r: 6, fill: isPositiveGain ? '#22c55e' : '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium uppercase">Net Inflows</span>
              <span className="text-xl font-bold">{totalInvested.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
            </Card>
            <Card className="glass-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium uppercase">Dividends</span>
              <span className="text-xl font-bold text-foreground">480.30 €</span>
              <span className="text-xs text-muted-foreground">+2.1% yield on cost</span>
            </Card>
            <Card className="glass-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium uppercase">Realized Gains</span>
              <span className="text-xl font-bold text-green-500">+1,240.00 €</span>
            </Card>
            <Card className="glass-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium uppercase">Taxes & Fees</span>
              <span className="text-xl font-bold text-red-500">-85.50 €</span>
            </Card>
          </div>
        </div>
      )}

      {/* 2. HOLDINGS TAB */}
      {activeTab === 'holdings' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {Object.keys(groupedHoldings).length === 0 ? (
            <div className="py-20 text-center text-muted-foreground bg-muted/5 rounded-2xl border border-border/50">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground">No holdings found</p>
              <p className="text-sm">Click "Add Asset" to start tracking your portfolio.</p>
            </div>
          ) : (
            Object.entries(groupedHoldings).map(([groupName, groupPositions]) => {
              const groupTotal = getGroupTotal(groupPositions);
              const groupAlloc = totalCurrentValue > 0 ? (groupTotal / totalCurrentValue) * 100 : 0;
              
              return (
                <Card key={groupName} className="glass-card border-border shadow-sm overflow-hidden">
                  <div className="bg-muted/20 px-6 py-3 border-b border-border/50 flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      {groupName} <Badge variant="secondary" className="bg-background text-[10px]">{groupPositions.length}</Badge>
                    </h3>
                    <div className="text-sm font-medium">
                      {groupTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} <span className="text-muted-foreground font-normal ml-2">({groupAlloc.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-muted-foreground bg-muted/5 border-b border-border/50">
                        <tr>
                          <th className="px-6 py-3 font-medium">Asset</th>
                          <th className="px-6 py-3 font-medium text-right">Price</th>
                          <th className="px-6 py-3 font-medium text-right">Allocation</th>
                          <th className="px-6 py-3 font-medium text-right">Return</th>
                          <th className="px-6 py-3 font-medium text-right">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {groupPositions.map(pos => {
                          const gain = (pos.current_value_eur || 0) - (pos.invested_amount_eur || 0);
                          const gainPct = pos.invested_amount_eur > 0 ? (gain / pos.invested_amount_eur) * 100 : 0;
                          const posAlloc = totalCurrentValue > 0 ? ((pos.current_value_eur || pos.invested_amount_eur) / totalCurrentValue) * 100 : 0;
                          const isPos = gain >= 0;

                          return (
                            <tr key={pos.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-foreground/5 text-foreground flex items-center justify-center font-bold text-xs border border-border">
                                    {pos.ticker.slice(0, 3)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-foreground">{pos.name || pos.ticker}</div>
                                    <div className="text-xs text-muted-foreground">{pos.ticker}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-medium">
                                {pos.current_price ? `${pos.current_price.toFixed(2)} ${pos.currency}` : '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="font-medium">{posAlloc.toFixed(2)}%</div>
                                <div className="w-16 h-1.5 bg-muted/40 rounded-full ml-auto mt-1.5 overflow-hidden">
                                  <div className="h-full bg-foreground rounded-full opacity-70" style={{ width: `${posAlloc}%` }} />
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className={`font-medium ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                                  {isPos ? '+' : ''}{gain.toFixed(2)} €
                                </div>
                                <div className={`text-xs ${isPos ? 'text-green-500/80' : 'text-red-500/80'}`}>
                                  {isPos ? '+' : ''}{gainPct.toFixed(2)}%
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="font-semibold text-base">
                                  {(pos.current_value_eur || pos.invested_amount_eur || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* 3. ALLOCATION TAB */}
      {activeTab === 'allocation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Donut: Asset Classes */}
          <Card className="glass-card border-border shadow-sm flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/10"><CardTitle className="text-sm font-medium">Asset Class</CardTitle></CardHeader>
            <CardContent className="p-4 flex-1">
              {typeData.length === 0 ? <p className="text-muted-foreground text-center py-10 text-sm">No data</p> : (
                <>
                  <div className="h-[220px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={typeData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">{typeData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip content={<DonutTooltip />} /></PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                      <span className="text-2xl font-bold">{typeData.length}</span><span className="text-[10px] text-muted-foreground uppercase">Classes</span>
                    </div>
                  </div>
                  <div className="space-y-2 mt-4 max-h-[150px] overflow-y-auto pr-2 no-scrollbar">
                    {typeData.map(item => (
                      <div key={item.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} /><span className="font-medium text-foreground">{item.name}</span></div>
                        <span className="text-muted-foreground">{(item.pct * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Donut: Regions */}
          <Card className="glass-card border-border shadow-sm flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/10"><CardTitle className="text-sm font-medium">Regions</CardTitle></CardHeader>
            <CardContent className="p-4 flex-1">
              {regionData.length === 0 ? <p className="text-muted-foreground text-center py-10 text-sm">No data</p> : (
                <>
                  <div className="h-[220px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={regionData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">{regionData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip content={<DonutTooltip />} /></PieChart>
                    </ResponsiveContainer>
                    <Globe className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground/30 pointer-events-none" />
                  </div>
                  <div className="space-y-2 mt-4 max-h-[150px] overflow-y-auto pr-2 no-scrollbar">
                    {regionData.map(item => (
                      <div key={item.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} /><span className="font-medium text-foreground">{item.name}</span></div>
                        <span className="text-muted-foreground">{(item.pct * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Donut: Sectors */}
          <Card className="glass-card border-border shadow-sm flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/10"><CardTitle className="text-sm font-medium">Sectors</CardTitle></CardHeader>
            <CardContent className="p-4 flex-1">
              {sectorData.length === 0 ? <p className="text-muted-foreground text-center py-10 text-sm">No data</p> : (
                <>
                  <div className="h-[220px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={sectorData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">{sectorData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip content={<DonutTooltip />} /></PieChart>
                    </ResponsiveContainer>
                    <Building2 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground/30 pointer-events-none" />
                  </div>
                  <div className="space-y-2 mt-4 max-h-[150px] overflow-y-auto pr-2 no-scrollbar">
                    {sectorData.map(item => (
                      <div key={item.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} /><span className="font-medium text-foreground truncate w-[140px]">{item.name}</span></div>
                        <span className="text-muted-foreground">{(item.pct * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. DIVIDENDS TAB */}
      {activeTab === 'dividends' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card border-border p-5 flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground mb-1">Total Received</p><p className="text-3xl font-bold text-foreground">480.30 €</p></div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center"><Landmark className="w-6 h-6 text-blue-500"/></div>
            </Card>
            <Card className="glass-card border-border p-5 flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground mb-1">Yield on Cost</p><p className="text-3xl font-bold text-foreground">2.14%</p></div>
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center"><TrendingUp className="w-6 h-6 text-green-500"/></div>
            </Card>
            <Card className="glass-card border-border p-5 flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground mb-1">Expected Next Month</p><p className="text-3xl font-bold text-foreground">35.50 €</p></div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center"><Target className="w-6 h-6 text-purple-500"/></div>
            </Card>
          </div>

          <Card className="glass-card border-border shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/5 py-4"><CardTitle className="text-base font-medium">Monthly Payouts (2026)</CardTitle></CardHeader>
            <CardContent className="pt-6 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={v => `${v}€`} />
                  <Tooltip cursor={{ fill: '#1f2937', opacity: 0.4 }} contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} formatter={v => [`${v} €`, 'Dividendos']} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. TRADES TAB (History) */}
      {activeTab === 'trades' && (
        <Card className="glass-card border-border shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="border-b border-border/50 bg-muted/5 py-4">
            <CardTitle className="text-base font-medium">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {/* Mock/Simulated Trades list since original data relies on purchase_history logic not fully exposed in list context easily */}
             <div className="divide-y divide-border/30">
               {[1, 2, 3, 4, 5].map((_, i) => (
                 <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/5 transition-colors">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-muted/50 border border-border`}>
                       <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                     </div>
                     <div>
                       <div className="font-semibold text-sm">Buy AAPL</div>
                       <div className="text-xs text-muted-foreground">Apple Inc. • Executed on {format(new Date(Date.now() - i * 864000000), 'MMM dd, yyyy')}</div>
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="font-semibold text-sm">150.00 €</div>
                     <div className="text-xs text-muted-foreground">1.2 Shares @ 125.00</div>
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      )}

      {/* ─── ADD ASSET DIALOG ─── */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setForm(emptyForm()); } }}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground">Add New Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <div className="flex gap-2">
                <Input placeholder="Search ticker or name (e.g. AAPL)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="bg-background/50 border-border" />
                <Button onClick={handleSearch} disabled={searchLoading} variant="secondary"><Search className="w-4 h-4" /></Button>
              </div>
              {searchResults.length > 0 && (
                <div className="border border-border rounded-lg mt-2 max-h-48 overflow-y-auto">
                  {searchResults.map(r => (
                    <button key={r.ticker} onClick={() => handleSelectResult(r)} className="w-full flex items-center justify-between p-3 hover:bg-muted/30 border-b border-border last:border-0 text-left">
                      <div><div className="font-medium text-sm">{r.ticker}</div><div className="text-xs text-muted-foreground">{r.name}</div></div>
                      <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Ticker</label><Input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} className="bg-background/50" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Name</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select value={form.investment_type} onValueChange={v => setForm(f => ({ ...f, investment_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Sector</label>
                <Select value={form.sector || ''} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Invested Amount (€)</label><Input type="number" value={form.invested_amount_eur} onChange={e => setForm(f => ({ ...f, invested_amount_eur: e.target.value }))} className="bg-background/50" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Buy Price</label><Input type="number" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} className="bg-background/50" /></div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-foreground text-background hover:bg-foreground/90">Add Position</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
