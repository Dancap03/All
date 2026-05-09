import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Globe, Building2, Users, DollarSign, BarChart2, Newspaper,
  Calendar, ExternalLink, RefreshCw, BookOpen, Activity,
  ChevronUp, ChevronDown, Info
} from 'lucide-react';

// ─── Yahoo Finance helpers ────────────────────────────────────────────────────

const YH = 'https://corsproxy.io/?url=https://query1.finance.yahoo.com';

async function yfSearch(q) {
  try {
    const r = await fetch(`${YH}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const d = await r.json();
    return (d.quotes || []).filter(q => q.symbol).map(q => ({
      ticker: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      exchange: q.exchange,
      type: q.quoteType,
    }));
  } catch { return []; }
}

async function yfQuote(ticker) {
  try {
    const r = await fetch(`${YH}/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const d = await r.json();
    const m = d?.chart?.result?.[0]?.meta;
    if (!m) return null;
    const prev = m.previousClose || m.chartPreviousClose;
    const change = m.regularMarketPrice - prev;
    const changePct = prev ? (change / prev) * 100 : 0;
    return {
      price: m.regularMarketPrice,
      prev,
      change: +change.toFixed(2),
      changePct: +changePct.toFixed(2),
      currency: m.currency,
      exchange: m.exchangeName,
      high: m.regularMarketDayHigh,
      low: m.regularMarketDayLow,
      volume: m.regularMarketVolume,
      marketCap: m.marketCap,
    };
  } catch { return null; }
}

async function yfHistory(ticker, range = '1y') {
  const intervals = { '1m': '5m', '3m': '1d', '6m': '1d', '1y': '1wk', '5y': '1mo' };
  try {
    const r = await fetch(
      `${YH}/v8/finance/chart/${ticker}?interval=${intervals[range]}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const d = await r.json();
    const res = d?.chart?.result?.[0];
    if (!res) return [];
    const ts = res.timestamp || [];
    const closes = res.indicators?.quote?.[0]?.close || [];
    const volumes = res.indicators?.quote?.[0]?.volume || [];
    return ts.map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      price: closes[i] ? +closes[i].toFixed(2) : null,
      volume: volumes[i] || 0,
    })).filter(d => d.price !== null);
  } catch { return []; }
}

function fmt(n, decimals = 2) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toFixed(decimals);
}
function fmtPct(n) { return n == null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanceSearchTab() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [selected, setSelected] = useState(null);   // { ticker, name, type, exchange }
  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [range, setRange] = useState('1y');
  const [loadingMain, setLoadingMain] = useState(false);
  const [aiData, setAiData] = useState(null);   // datos fundamentales via Claude API
  const [aiLoading, setAiLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const debounceRef = useRef(null);

  // ── Search suggestions ──────────────────────────────────────────────────────
  const handleQueryChange = (v) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      const res = await yfSearch(v);
      setSuggestions(res);
      setSugLoading(false);
    }, 350);
  };

  // ── Select asset ────────────────────────────────────────────────────────────
  const handleSelect = async (asset) => {
    setSelected(asset);
    setSuggestions([]);
    setQuery(asset.ticker);
    setLoadingMain(true);
    setAiData(null);
    setNews([]);

    const [q, h] = await Promise.all([
      yfQuote(asset.ticker),
      yfHistory(asset.ticker, '1y'),
    ]);
    setQuote(q);
    setHistory(h);
    setLoadingMain(false);

    // Cargar datos fundamentales y noticias via Claude
    fetchAIData(asset);
    fetchNews(asset.ticker);
  };

  const handleRangeChange = async (r) => {
    setRange(r);
    if (!selected) return;
    const h = await yfHistory(selected.ticker, r);
    setHistory(h);
  };

  // ── Datos fundamentales vía Claude API ─────────────────────────────────────
  const fetchAIData = async (asset) => {
    setAiLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = `Proporciona datos fundamentales sobre ${asset.ticker} (${asset.name}).
Responde SOLO con JSON válido, sin texto adicional ni bloques de código markdown.
Formato exacto:
{
  "description": "descripción breve de la empresa en 2 frases",
  "sector": "sector",
  "industry": "industria",
  "country": "país",
  "employees": número o null,
  "website": "url o null",
  "pe_ratio": número o null,
  "forward_pe": número o null,
  "eps": número o null,
  "revenue_ttm": número en USD o null,
  "profit_margin": número entre 0 y 1 o null,
  "debt_to_equity": número o null,
  "roe": número entre 0 y 1 o null,
  "dividend_yield": número entre 0 y 1 o null,
  "52w_high": número o null,
  "52w_low": número o null,
  "beta": número o null,
  "analyst_rating": "Buy" | "Hold" | "Sell" | null,
  "price_target": número o null,
  "earnings": [
    {"quarter": "Q1 2024", "eps_actual": número, "eps_estimate": número, "revenue": número},
    {"quarter": "Q2 2024", "eps_actual": número, "eps_estimate": número, "revenue": número},
    {"quarter": "Q3 2024", "eps_actual": número, "eps_estimate": número, "revenue": número},
    {"quarter": "Q4 2024", "eps_actual": número, "eps_estimate": número, "revenue": número}
  ],
  "key_risks": ["riesgo1", "riesgo2", "riesgo3"],
  "catalysts": ["catalizador1", "catalizador2"]
}`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.3 },
        }),
      });
      const d = await res.json();
      const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setAiData(parsed);
    } catch { setAiData(null); }
    setAiLoading(false);
  };

  // ── Noticias vía Claude API ─────────────────────────────────────────────────
  const fetchNews = async (ticker) => {
    setNewsLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = `Lista las 5 noticias más recientes e importantes sobre ${ticker} de los últimos 30 días.
Responde SOLO con JSON válido, sin texto adicional ni bloques de código markdown.
Formato exacto:
[
  {
    "title": "título de la noticia",
    "summary": "resumen en 1-2 frases",
    "date": "hace X días / semanas",
    "sentiment": "positive" | "negative" | "neutral",
    "source": "nombre del medio"
  }
]`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.5 },
        }),
      });
      const d = await res.json();
      const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setNews(Array.isArray(parsed) ? parsed : []);
    } catch { setNews([]); }
    setNewsLoading(false);
  };

  const RANGES = ['1m', '3m', '6m', '1y', '5y'];

  const priceColor = quote?.change >= 0 ? 'text-gym' : 'text-destructive';
  const priceUp = quote?.change >= 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Search bar ── */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && suggestions[0] && handleSelect(suggestions[0])}
              placeholder="Buscar acción, ETF, cripto... (AAPL, MSCI, BTC-EUR)"
              className="pl-9 bg-muted/30 border-border"
            />
            {sugLoading && (
              <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full border border-border rounded-xl bg-card shadow-2xl overflow-hidden">
            {suggestions.map(s => (
              <button key={s.ticker} onClick={() => handleSelect(s)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 text-left border-b border-border/50 last:border-0 transition-colors">
                <div>
                  <span className="text-sm font-semibold text-foreground">{s.ticker}</span>
                  <span className="text-xs text-muted-foreground ml-2 truncate">{s.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">{s.exchange}</div>
                  <div className="text-[10px] text-muted-foreground/60">{s.type}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!selected && (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">Busca cualquier activo financiero</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Acciones, ETFs, fondos, crypto, índices...</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['AAPL', 'NVDA', 'MSFT', 'BTC-USD', 'VWCE.DE', 'SPY'].map(t => (
                <button key={t} onClick={() => { setQuery(t); handleQueryChange(t); }}
                  className="px-3 py-1 text-xs bg-muted/30 border border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Loading ── */}
      {loadingMain && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-finance/30 border-t-finance rounded-full animate-spin" />
        </div>
      )}

      {/* ── Asset detail ── */}
      {selected && !loadingMain && quote && (
        <div className="space-y-4">

          {/* Header */}
          <Card className="glass-card border-gold/10">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-grotesk font-bold text-foreground">{selected.ticker}</h2>
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs">{selected.exchange}</Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs">{selected.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{selected.name}</p>
                  {aiData?.sector && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {aiData.sector} · {aiData.industry} · {aiData.country}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-grotesk font-bold text-foreground">
                    {quote.price?.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{quote.currency}</span>
                  </div>
                  <div className={`flex items-center justify-end gap-1 text-sm font-medium ${priceColor}`}>
                    {priceUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {quote.change > 0 ? '+' : ''}{quote.change} ({quote.changePct > 0 ? '+' : ''}{quote.changePct}%)
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Apertura', value: quote.prev?.toFixed(2) },
                  { label: 'Max día', value: quote.high?.toFixed(2) },
                  { label: 'Min día', value: quote.low?.toFixed(2) },
                  { label: 'Volumen', value: fmt(quote.volume, 0) },
                ].map(s => (
                  <div key={s.label} className="bg-muted/20 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    <div className="text-sm font-medium text-foreground">{s.value || '—'}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fuentes de datos */}
          <Card className="glass-card border-border/30">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Fuentes:</span>
                <a href={`https://finance.yahoo.com/quote/${selected.ticker}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Yahoo Finance
                </a>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <a href={`https://finance.yahoo.com/quote/${selected.ticker}/financials/`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Financials
                </a>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <a href={`https://finance.yahoo.com/quote/${selected.ticker}/news/`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Noticias YF
                </a>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <a href={`https://stockanalysis.com/stocks/${selected.ticker.toLowerCase()}/`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Stock Analysis
                </a>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <a href={`https://www.macrotrends.net/stocks/charts/${selected.ticker}/${selected.name?.toLowerCase().replace(/\s+/g, '-')}/revenue`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  Macrotrends
                </a>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <a href={`https://www.wsj.com/market-data/quotes/${selected.ticker}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  WSJ
                </a>
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                Precio/gráfico: Yahoo Finance API v8 (tiempo real) · Fundamentales y noticias: Claude AI (conocimiento hasta ago 2025)
              </p>
            </CardContent>
          </Card>

          {/* Main tabs */}
          <Tabs defaultValue="chart">
            <TabsList className="bg-muted/30 w-full grid grid-cols-4">
              <TabsTrigger value="chart" className="text-xs data-[state=active]:bg-finance/20 data-[state=active]:text-finance">
                <Activity className="w-3.5 h-3.5 mr-1" />Gráfico
              </TabsTrigger>
              <TabsTrigger value="fundamentals" className="text-xs data-[state=active]:bg-finance/20 data-[state=active]:text-finance">
                <BarChart2 className="w-3.5 h-3.5 mr-1" />Datos
              </TabsTrigger>
              <TabsTrigger value="earnings" className="text-xs data-[state=active]:bg-finance/20 data-[state=active]:text-finance">
                <Calendar className="w-3.5 h-3.5 mr-1" />Resultados
              </TabsTrigger>
              <TabsTrigger value="news" className="text-xs data-[state=active]:bg-finance/20 data-[state=active]:text-finance">
                <Newspaper className="w-3.5 h-3.5 mr-1" />Noticias
              </TabsTrigger>
            </TabsList>

            {/* ── Chart tab ── */}
            <TabsContent value="chart" className="mt-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-foreground text-sm">Precio histórico</CardTitle>
                    <div className="flex gap-1">
                      {RANGES.map(r => (
                        <button key={r} onClick={() => handleRangeChange(r)}
                          className={`px-2 py-1 text-xs rounded-lg border transition-all ${range === r ? 'bg-finance/20 text-finance border-finance/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {history.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={priceUp ? '#34d399' : '#f87171'} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={priceUp ? '#34d399' : '#f87171'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} width={50} domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Area type="monotone" dataKey="price" stroke={priceUp ? '#34d399' : '#f87171'} strokeWidth={2} fill="url(#sg)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Fundamentals tab ── */}
            <TabsContent value="fundamentals" className="mt-4 space-y-4">
              {aiLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-finance/30 border-t-finance rounded-full animate-spin" />
                </div>
              ) : aiData ? (
                <>
                  {/* Description */}
                  {aiData.description && (
                    <Card className="glass-card">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Info className="w-4 h-4 text-finance shrink-0 mt-0.5" />
                          <p>{aiData.description}</p>
                        </div>
                        {aiData.website && (
                          <a href={aiData.website} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-finance mt-2 hover:underline">
                            <ExternalLink className="w-3 h-3" /> {aiData.website}
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* KPIs */}
                  <Card className="glass-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-foreground text-sm flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-finance" /> Métricas clave
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Market Cap', value: fmt(quote.marketCap) },
                          { label: 'P/E Ratio', value: aiData.pe_ratio?.toFixed(1) || '—' },
                          { label: 'P/E Futuro', value: aiData.forward_pe?.toFixed(1) || '—' },
                          { label: 'EPS', value: aiData.eps ? `$${aiData.eps.toFixed(2)}` : '—' },
                          { label: 'Ingresos TTM', value: fmt(aiData.revenue_ttm) },
                          { label: 'Margen neto', value: fmtPct(aiData.profit_margin) },
                          { label: 'ROE', value: fmtPct(aiData.roe) },
                          { label: 'Deuda/Capital', value: aiData.debt_to_equity?.toFixed(2) || '—' },
                          { label: 'Dividendo', value: fmtPct(aiData.dividend_yield) },
                          { label: 'Beta', value: aiData.beta?.toFixed(2) || '—' },
                          { label: 'Máx 52s', value: aiData['52w_high']?.toFixed(2) || '—' },
                          { label: 'Mín 52s', value: aiData['52w_low']?.toFixed(2) || '—' },
                        ].map(k => (
                          <div key={k.label} className="bg-muted/20 rounded-lg px-3 py-2">
                            <div className="text-[10px] text-muted-foreground">{k.label}</div>
                            <div className="text-sm font-medium text-foreground">{k.value}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Analyst rating */}
                  {aiData.analyst_rating && (
                    <Card className="glass-card">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Rating analistas</div>
                            <Badge className={`text-sm px-3 py-1 ${
                              aiData.analyst_rating === 'Buy' ? 'bg-gym/20 text-gym border-gym/30' :
                              aiData.analyst_rating === 'Sell' ? 'bg-destructive/20 text-destructive border-destructive/30' :
                              'bg-muted/30 text-muted-foreground border-border'
                            }`} variant="outline">
                              {aiData.analyst_rating === 'Buy' ? '▲ Comprar' : aiData.analyst_rating === 'Sell' ? '▼ Vender' : '◆ Mantener'}
                            </Badge>
                          </div>
                          {aiData.price_target && (
                            <div>
                              <div className="text-xs text-muted-foreground">Precio objetivo</div>
                              <div className="text-lg font-grotesk font-bold text-foreground">
                                {aiData.price_target.toFixed(2)} {quote.currency}
                                <span className={`text-xs ml-1 ${aiData.price_target > quote.price ? 'text-gym' : 'text-destructive'}`}>
                                  ({((aiData.price_target - quote.price) / quote.price * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Risks & Catalysts */}
                  {(aiData.key_risks?.length > 0 || aiData.catalysts?.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {aiData.key_risks?.length > 0 && (
                        <Card className="glass-card border-destructive/10">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-destructive text-sm flex items-center gap-1.5">
                              <ChevronDown className="w-4 h-4" /> Riesgos clave
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1.5">
                            {aiData.key_risks.map((r, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-destructive/60 mt-1 shrink-0" />
                                {r}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                      {aiData.catalysts?.length > 0 && (
                        <Card className="glass-card border-gym/10">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-gym text-sm flex items-center gap-1.5">
                              <ChevronUp className="w-4 h-4" /> Catalizadores
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1.5">
                            {aiData.catalysts.map((c, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-gym/60 mt-1 shrink-0" />
                                {c}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <Card className="glass-card">
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    No se pudieron cargar los datos fundamentales.
                    <br /><span className="text-xs opacity-60">Requiere VITE_GEMINI_API_KEY en GitHub Secrets.</span>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Earnings tab ── */}
            <TabsContent value="earnings" className="mt-4 space-y-4">
              {aiLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-finance/30 border-t-finance rounded-full animate-spin" />
                </div>
              ) : aiData?.earnings?.length > 0 ? (
                <>
                  <Card className="glass-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-foreground text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-finance" /> Resultados trimestrales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={aiData.earnings} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                          <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} width={35} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                          <Bar dataKey="eps_actual" name="EPS Real" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="eps_estimate" name="EPS Estimado" fill="#6b7280" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="glass-card overflow-x-auto">
                    <CardContent className="pt-4">
                      <table className="w-full text-xs min-w-[400px]">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left pb-2">Trimestre</th>
                            <th className="text-right pb-2">EPS Real</th>
                            <th className="text-right pb-2">EPS Est.</th>
                            <th className="text-right pb-2">Sorpresa</th>
                            <th className="text-right pb-2">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiData.earnings.map((e, i) => {
                            const beat = e.eps_actual != null && e.eps_estimate != null ? e.eps_actual - e.eps_estimate : null;
                            const beatPct = beat != null && e.eps_estimate ? (beat / Math.abs(e.eps_estimate)) * 100 : null;
                            return (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-2 text-foreground font-medium">{e.quarter}</td>
                                <td className="text-right py-2 text-foreground">{e.eps_actual != null ? `$${e.eps_actual.toFixed(2)}` : '—'}</td>
                                <td className="text-right py-2 text-muted-foreground">{e.eps_estimate != null ? `$${e.eps_estimate.toFixed(2)}` : '—'}</td>
                                <td className={`text-right py-2 font-medium ${beat != null ? (beat >= 0 ? 'text-gym' : 'text-destructive') : 'text-muted-foreground'}`}>
                                  {beatPct != null ? `${beat >= 0 ? '+' : ''}${beatPct.toFixed(1)}%` : '—'}
                                </td>
                                <td className="text-right py-2 text-muted-foreground">{e.revenue ? fmt(e.revenue) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="glass-card">
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    Sin datos de resultados disponibles.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── News tab ── */}
            <TabsContent value="news" className="mt-4">
              {newsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-finance/30 border-t-finance rounded-full animate-spin" />
                </div>
              ) : news.length > 0 ? (
                <div className="space-y-3">
                  {news.map((n, i) => (
                    <Card key={i} className={`glass-card border-l-2 ${
                      n.sentiment === 'positive' ? 'border-l-gym' :
                      n.sentiment === 'negative' ? 'border-l-destructive' :
                      'border-l-muted-foreground/30'
                    }`}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{n.summary}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] text-muted-foreground/60">{n.source}</span>
                              <span className="text-[10px] text-muted-foreground/40">·</span>
                              <span className="text-[10px] text-muted-foreground/60">{n.date}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${
                            n.sentiment === 'positive' ? 'text-gym border-gym/30' :
                            n.sentiment === 'negative' ? 'text-destructive border-destructive/30' :
                            'text-muted-foreground border-border'
                          }`}>
                            {n.sentiment === 'positive' ? '▲' : n.sentiment === 'negative' ? '▼' : '◆'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <p className="text-[10px] text-muted-foreground/50 text-center">
                    Noticias generadas por IA a partir de conocimiento hasta agosto 2025. Verifica siempre en fuentes oficiales.
                  </p>
                </div>
              ) : (
                <Card className="glass-card">
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    No hay noticias disponibles.
                    <br /><span className="text-xs opacity-60">Requiere VITE_GEMINI_API_KEY en GitHub Secrets.</span>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
