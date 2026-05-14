import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, RefreshCw, TrendingUp, TrendingDown, Search, X, ChevronRight, ChevronDown, Globe, Building2, Zap, Droplets, Briefcase, Loader2, Bot, Send, User, Sparkles, AlertTriangle, CheckCircle, Lightbulb, Settings, Download, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Groq ─────────────────────────────────────────────────────────────────────
async function callGroq(messages, maxTokens = 1500) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY no configurada');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// ─── Yahoo Finance ─────────────────────────────────────────────────────────────
async function searchYahoo(q) {
  try {
    const r = await fetch(`https://corsproxy.io/?url=https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    return (d.quotes || []).filter(x => x.quoteType && x.symbol).map(x => ({ ticker: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchange, type: x.quoteType }));
  } catch { return []; }
}
async function getYahooQuote(ticker) {
  try {
    const r = await fetch(`https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return { ticker: meta.symbol, price: meta.regularMarketPrice, previousClose: meta.previousClose || meta.chartPreviousClose, currency: meta.currency, exchange: meta.exchangeName };
  } catch { return null; }
}
async function getYahooHistory(ticker, range = '1y', interval = '1mo') {
  try {
    const r = await fetch(`https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const result = d?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    return timestamps.map((ts, i) => ({ date: format(new Date(ts * 1000), 'MMM yy', { locale: es }), price: closes[i] ? +closes[i].toFixed(2) : null })).filter(x => x.price !== null);
  } catch { return []; }
}
async function getEurFxRate(currency) {
  if (currency === 'EUR') return 1;
  try {
    const r = await fetch(`https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${currency}EUR=X?interval=1d&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch { return { USD: 0.92, GBP: 1.17, CHF: 1.06 }[currency] || null; }
}

// ─── ETF composition ──────────────────────────────────────────────────────────
const ETF_COMPOSITIONS = {
  'IWDA': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 4.2, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 3.8, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 3.1, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', pct: 2.4, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. A', pct: 2.1, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
  ],
  'VUSA': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 7.2, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 6.5, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 5.3, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
  ],
};

const STOCK_SECTOR_MAP = {
  AAPL: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  MSFT: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  NVDA: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  AMZN: { sector: 'Consumo discrecional', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  GOOGL: { sector: 'Comunicaciones', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  META: { sector: 'Comunicaciones', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  TSLA: { sector: 'Consumo discrecional', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  'BTC-USD': { sector: 'Criptomonedas', region: 'Global', country: 'Global', currency: 'USD' },
  'ETH-USD': { sector: 'Criptomonedas', region: 'Global', country: 'Global', currency: 'USD' },
};

function getEtfComposition(ticker) {
  const base = ticker.split('.')[0].split('-')[0];
  return ETF_COMPOSITIONS[ticker] || ETF_COMPOSITIONS[base] || null;
}

function getStockInfo(ticker) {
  const base = ticker.split('.')[0];
  return STOCK_SECTOR_MAP[ticker] || STOCK_SECTOR_MAP[base] || null;
}

function buildDeepDive(positions, totalCurrentValue) {
  const holdings = {};
  positions.forEach(pos => {
    const posValue = pos.current_value_eur || pos.invested_amount_eur || 0;
    const isEtf = ['etf', 'index_fund'].includes(pos.investment_type);
    const composition = isEtf ? getEtfComposition(pos.ticker) : null;
    if (composition && composition.length > 0) {
      composition.forEach(holding => {
        const holdingValue = posValue * (holding.pct / 100);
        if (!holdings[holding.ticker]) {
          holdings[holding.ticker] = { name: holding.name, value: 0, region: holding.region, sector: holding.sector, country: holding.country, currency: holding.currency };
        }
        holdings[holding.ticker].value += holdingValue;
      });
      const coveredPct = composition.reduce((s, h) => s + h.pct, 0);
      if (coveredPct < 100) {
        const otherKey = `OTHER_${pos.ticker}`;
        holdings[otherKey] = { name: `Otros (${pos.ticker})`, value: posValue * ((100 - coveredPct) / 100), region: pos.region || 'Global', sector: 'Diversificado', country: 'Global', currency: 'EUR' };
      }
    } else {
      const info = getStockInfo(pos.ticker);
      if (!holdings[pos.ticker]) {
        holdings[pos.ticker] = { name: pos.name, value: 0, region: pos.region || info?.region || 'Global', sector: pos.sector || info?.sector || 'Otro', country: info?.country || 'Global', currency: pos.currency || info?.currency || 'EUR' };
      }
      holdings[pos.ticker].value += posValue;
    }
  });
  return Object.entries(holdings).map(([ticker, data], i) => ({
    ticker, ...data,
    pct: totalCurrentValue > 0 ? (data.value / totalCurrentValue) * 100 : 0,
    color: PAL[i % PAL.length],
  })).sort((a, b) => b.value - a.value);
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TYPES = [
  { id: 'stock', label: 'Acción', color: '#3b82f6' },
  { id: 'etf', label: 'ETF', color: '#0ea5e9' },
  { id: 'index_fund', label: 'Fondo indexado', color: '#6366f1' },
  { id: 'crypto', label: 'Crypto', color: '#f59e0b' },
  { id: 'bond', label: 'Bono', color: '#10b981' },
  { id: 'commodity', label: 'Materia prima', color: '#84cc16' },
  { id: 'other', label: 'Otro', color: '#6b7280' },
];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
const SECTORS = ['Tecnología', 'Salud', 'Finanzas', 'Consumo discrecional', 'Consumo básico', 'Energía', 'Materiales', 'Industria', 'Servicios públicos', 'Inmobiliario', 'Comunicaciones', 'Criptomonedas', 'Otro'];
const REGIONS = ['América del Norte', 'Europa', 'Asia Pacífico', 'Emergentes', 'Global', 'América Latina', 'África/Oriente Medio'];
const PAL = ['#3b82f6','#0ea5e9','#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#f59e0b','#84cc16','#10b981','#14b8a6','#06b6d4'];
const getType = (id) => TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1];
const fmtEur = (v) => `${(+v || 0).toFixed(2)}€`;

const GQ = {
  bg: '#0a0a0f',
  card: '#111118',
  cardBorder: '#1e1e2e',
  cardHover: '#16161f',
  text: '#e8e8f0',
  textMuted: '#6b6b80',
  textDim: '#3a3a4a',
  green: '#22c55e',
  greenDim: '#14532d',
  red: '#ef4444',
  redDim: '#450a0a',
  blue: '#3b82f6',
  blueDim: '#1e3a5f',
  amber: '#f59e0b',
  border: '#1e1e2e',
  borderHover: '#2e2e3e',
};

// Known dividend yields
const DIV_YIELDS = { AAPL: 0.005, MSFT: 0.007, INTC: 0.025, JNJ: 0.03, KO: 0.03, PG: 0.025, VHYG: 0.04, VIG: 0.018, O: 0.055, ABT: 0.018, MCD: 0.024, MMM: 0.065, VUAG: 0.016, IWDA: 0.015, XDWD: 0.015, ISAC: 0.015, VUSA: 0.015 };
const getDivYield = (pos) => DIV_YIELDS[pos.ticker] || ({ etf: 0.015, index_fund: 0.012, bond: 0.04 }[pos.investment_type] || 0);

// ─── Donut chart ───────────────────────────────────────────────────────────────
function GQDonut({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const [hovered, setHovered] = useState(null);
  const center = size / 2;
  const r = size / 2 - 20;
  const ri = r - 18;
  let angle = -Math.PI / 2;
  const paths = data.map((d, i) => {
    const sweep = total > 0 ? (d.value / total) * Math.PI * 2 : 0;
    const x1 = center + r * Math.cos(angle);
    const y1 = center + r * Math.sin(angle);
    const x2 = center + r * Math.cos(angle + sweep);
    const y2 = center + r * Math.sin(angle + sweep);
    const xi1 = center + ri * Math.cos(angle);
    const yi1 = center + ri * Math.sin(angle);
    const xi2 = center + ri * Math.cos(angle + sweep);
    const yi2 = center + ri * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${large} 0 ${xi1} ${yi1} Z`;
    const result = { path, color: d.color || PAL[i % PAL.length], name: d.name, value: d.value, pct: total > 0 ? (d.value / total) * 100 : 0, i };
    angle += sweep;
    return result;
  });
  const hov = hovered !== null ? paths[hovered] : null;
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ cursor: 'default' }}>
        {paths.map((p, i) => (
          <path key={i} d={p.path} fill={p.color} stroke={GQ.card} strokeWidth="2"
            opacity={hovered === null || hovered === i ? 1 : 0.5}
            style={{ transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
        <text x={center} y={center - 6} textAnchor="middle" fill={GQ.text} fontSize="13" fontWeight="700">
          {hov ? `${hov.pct.toFixed(1)}%` : `${(data.reduce((s, d) => s + (d.value || 0), 0)).toFixed(0)}€`}
        </text>
        <text x={center} y={center + 10} textAnchor="middle" fill={GQ.textMuted} fontSize="10">
          {hov ? hov.name : 'Total'}
        </text>
      </svg>
    </div>
  );
}

// ─── Heatmap cell ─────────────────────────────────────────────────────────────
function HeatCell({ name, ticker, pct, gainPct }) {
  const intensity = Math.min(Math.abs(gainPct) / 10, 1);
  const bg = gainPct >= 0
    ? `rgba(34,197,94,${0.1 + intensity * 0.35})`
    : `rgba(239,68,68,${0.1 + intensity * 0.35})`;
  const border = gainPct >= 0 ? `rgba(34,197,94,${0.2 + intensity * 0.3})` : `rgba(239,68,68,${0.2 + intensity * 0.3})`;
  const tc = gainPct >= 0 ? GQ.green : GQ.red;
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 70, cursor: 'pointer', transition: 'all 0.15s' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: GQ.text, marginBottom: 3 }}>{ticker}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: tc }}>{gainPct >= 0 ? '+' : ''}{gainPct?.toFixed(2)}%</div>
      <div style={{ fontSize: 10, color: GQ.textMuted, marginTop: 2 }}>{pct?.toFixed(1)}% de cartera</div>
    </div>
  );
}

// ─── DistributionPanel ────────────────────────────────────────────────────────
function DistributionPanel({ positions, totalCurrentValue }) {
  const [activeView, setActiveView] = useState('sector'); // sector | region | type | deepdive

  const buildGrouped = (key) => {
    const groups = {};
    positions.forEach((pos, i) => {
      const val = pos.current_value_eur || pos.invested_amount_eur || 0;
      const groupKey = pos[key] || 'Sin clasificar';
      if (!groups[groupKey]) groups[groupKey] = { name: groupKey, value: 0, color: PAL[Object.keys(groups).length % PAL.length] };
      groups[groupKey].value += val;
    });
    return Object.values(groups).sort((a, b) => b.value - a.value);
  };

  const sectorData = buildGrouped('sector');
  const regionData = buildGrouped('region');
  const typeData = positions.reduce((acc, pos, i) => {
    const val = pos.current_value_eur || pos.invested_amount_eur || 0;
    const t = getType(pos.investment_type);
    const existing = acc.find(a => a.name === t.label);
    if (existing) existing.value += val;
    else acc.push({ name: t.label, value: val, color: t.color });
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const deepDiveData = buildDeepDive(positions, totalCurrentValue);

  const views = [
    { id: 'sector', label: 'Sector' },
    { id: 'region', label: 'Región' },
    { id: 'type', label: 'Tipo' },
    { id: 'deepdive', label: 'Deep Dive' },
  ];

  const currentData = activeView === 'sector' ? sectorData
    : activeView === 'region' ? regionData
    : activeView === 'type' ? typeData
    : deepDiveData;

  return (
    <div>
      {/* View selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {views.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: activeView === v.id ? 600 : 400, background: activeView === v.id ? '#1f2937' : 'transparent', color: activeView === v.id ? GQ.text : GQ.textMuted, cursor: 'pointer' }}>
            {v.label}
          </button>
        ))}
      </div>

      {positions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: GQ.textMuted }}>Sin posiciones para mostrar distribución</div>
      ) : (
        <div>
          {/* Chart + Legend */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <GQDonut data={currentData.slice(0, 12)} size={200} />
            <div style={{ flex: 1, minWidth: 200 }}>
              {currentData.slice(0, 10).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: GQ.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      <span style={{ fontSize: 12, color: GQ.textMuted, marginLeft: 8, flexShrink: 0 }}>{totalCurrentValue > 0 ? ((d.value / totalCurrentValue) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div style={{ width: '100%', height: 3, background: GQ.border, borderRadius: 2, marginTop: 3 }}>
                      <div style={{ width: `${totalCurrentValue > 0 ? (d.value / totalCurrentValue) * 100 : 0}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: GQ.textMuted, flexShrink: 0 }}>{d.value.toFixed(0)}€</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deep dive table */}
          {activeView === 'deepdive' && (
            <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${GQ.border}`, fontSize: 12, color: GQ.textMuted, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
                <span>Empresa/Activo</span><span>Sector</span><span>Región</span><span style={{ textAlign: 'right' }}>Peso</span>
              </div>
              {deepDiveData.slice(0, 20).map((d, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${GQ.border}`, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: GQ.text }}>{d.name}</div>
                      <div style={{ fontSize: 10, color: GQ.textMuted }}>{d.ticker}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: GQ.textMuted }}>{d.sector}</span>
                  <span style={{ fontSize: 11, color: GQ.textMuted }}>{d.region}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: GQ.text }}>{d.pct.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: GQ.textMuted }}>{d.value.toFixed(0)}€</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DividendsPanel ───────────────────────────────────────────────────────────
function DividendsPanel({ positions }) {
  const totalValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);

  const dividendPositions = positions
    .map(pos => {
      const val = pos.current_value_eur || pos.invested_amount_eur || 0;
      const yieldRate = getDivYield(pos);
      const annualDiv = val * yieldRate;
      const monthlyDiv = annualDiv / 12;
      return { ...pos, yieldRate, annualDiv, monthlyDiv, val };
    })
    .filter(p => p.annualDiv > 0)
    .sort((a, b) => b.annualDiv - a.annualDiv);

  const totalAnnualDiv = dividendPositions.reduce((s, p) => s + p.annualDiv, 0);
  const totalMonthlyDiv = totalAnnualDiv / 12;
  const avgYield = totalValue > 0 ? (totalAnnualDiv / totalValue) * 100 : 0;

  // Monthly projection chart
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: format(new Date(2026, i, 1), 'MMM', { locale: es }),
    dividendos: +totalMonthlyDiv.toFixed(2),
  }));

  return (
    <div style={{ color: GQ.text }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Dividendos anuales (est.)', value: `${totalAnnualDiv.toFixed(2)}€`, color: GQ.green },
          { label: 'Dividendos mensuales (est.)', value: `${totalMonthlyDiv.toFixed(2)}€`, color: GQ.amber },
          { label: 'Yield medio cartera', value: `${avgYield.toFixed(2)}%`, color: GQ.blue },
        ].map(c => (
          <div key={c.label} style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: GQ.textMuted, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {totalMonthlyDiv > 0 && (
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Proyección de dividendos mensuales</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}€`} />
              <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`${v}€`, 'Dividendos']} />
              <Bar dataKey="dividendos" fill={GQ.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-position breakdown */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${GQ.border}`, fontSize: 13, fontWeight: 600 }}>
          Desglose por posición
        </div>
        {dividendPositions.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: GQ.textMuted, fontSize: 13 }}>
            <DollarSign style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.3 }} />
            <div>Sin posiciones con dividendos conocidos</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Los yields son estimados basados en datos históricos</div>
          </div>
        ) : (
          dividendPositions.map((pos, i) => (
            <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${GQ.border}`, alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${GQ.green}15`, border: `1px solid ${GQ.green}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: GQ.green }}>
                  {pos.ticker?.slice(0, 4)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: GQ.text }}>{pos.name?.slice(0, 20)}</div>
                  <div style={{ fontSize: 10, color: GQ.textMuted }}>{pos.ticker}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: GQ.amber }}>{(pos.yieldRate * 100).toFixed(2)}%</div>
                <div style={{ fontSize: 10, color: GQ.textMuted }}>yield est.</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: GQ.green }}>{pos.annualDiv.toFixed(2)}€</div>
                <div style={{ fontSize: 10, color: GQ.textMuted }}>anual</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: GQ.text }}>{pos.monthlyDiv.toFixed(2)}€</div>
                <div style={{ fontSize: 10, color: GQ.textMuted }}>mensual</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ fontSize: 10, color: GQ.textMuted, marginTop: 8, textAlign: 'right' }}>
        * Yields estimados a partir de datos históricos conocidos. No son garantía de dividendos futuros.
      </div>
    </div>
  );
}

// ─── ScoreGauge ───────────────────────────────────────────────────────────────
function ScoreGauge({ score }) {
  const color = score >= 70 ? GQ.green : score >= 45 ? GQ.amber : GQ.red;
  return (
    <div style={{ position: 'relative', width: 140, height: 90, flexShrink: 0 }}>
      <svg width="140" height="90" viewBox="0 0 140 90">
        <path d="M 15 80 A 55 55 0 1 1 125 80" fill="none" stroke={GQ.border} strokeWidth="8" strokeLinecap="round" />
        <path d="M 15 80 A 55 55 0 1 1 125 80" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 259} 259`} style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: GQ.textMuted }}>/ 100</div>
      </div>
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ positions, totalInvested, totalCurrentValue, totalGain, totalGainPct }) {
  const [step, setStep] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({ salary: '', expenses: '', goal: '', horizon: '', risk: 'Moderado', job_security: 'Estable', monthly_invest: '', broker: '' });
  const [profileStep, setProfileStep] = useState(0);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const PROFILE_QUESTIONS = [
    { key: 'salary', label: '¿Cuál es tu salario neto mensual (€)?', placeholder: 'Ej: 1800', type: 'number' },
    { key: 'expenses', label: '¿Cuáles son tus gastos fijos mensuales (€)?', placeholder: 'Ej: 900', type: 'number' },
    { key: 'monthly_invest', label: '¿Cuánto puedes invertir cada mes (€)?', placeholder: 'Ej: 200', type: 'number' },
    { key: 'horizon', label: '¿Cuál es tu horizonte de inversión?', placeholder: 'Ej: 10 años', type: 'text' },
    { key: 'goal', label: '¿Cuál es tu objetivo principal?', placeholder: 'Ej: Jubilación anticipada, casa, libertad financiera...', type: 'text' },
    { key: 'risk', label: '¿Cuál es tu tolerancia al riesgo?', placeholder: '', type: 'select', options: ['Conservador', 'Moderado', 'Agresivo', 'Muy agresivo'] },
  ];

  const runAnalysis = async () => {
    setLoading(true);
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    const portStr = positions.map(p => {
      const gain = (p.current_value_eur || p.invested_amount_eur || 0) - (p.invested_amount_eur || 0);
      const gainPct = p.invested_amount_eur > 0 ? (gain / p.invested_amount_eur * 100).toFixed(2) : 0;
      return `${p.ticker}(${p.name}): ${(p.current_value_eur||p.invested_amount_eur||0).toFixed(0)}€, G/P:${gainPct}%, tipo:${p.investment_type}, sector:${p.sector||'N/D'}`;
    }).join(' | ');
    const profStr = `Salario:${profile.salary}€/mes, gastos:${profile.expenses}€, invertiría:${profile.monthly_invest}€/mes, horizonte:${profile.horizon}, objetivo:${profile.goal}, riesgo:${profile.risk}`;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', max_tokens: 1500, temperature: 0.5,
          messages: [{ role: 'user', content: `Analiza esta cartera de inversión y perfil financiero. Cartera: ${portStr}. Perfil: ${profStr}. Valor total: ${totalCurrentValue.toFixed(0)}€, invertido: ${totalInvested.toFixed(0)}€, G/P: ${totalGainPct.toFixed(2)}%.
Responde SOLO con JSON válido sin bloques de código:
{"score":NUMBER_0_100,"summary":"2 frases sobre la cartera","diversification":NUMBER_0_10,"risk_level":NUMBER_0_10,"cost_efficiency":NUMBER_0_10,"macroeconomic":NUMBER_0_10,"recommendations":[{"title":"título corto","detail":"explicación detallada en 2-3 frases"}],"top_action":"acción más urgente en 1 frase","above_pct":NUMBER_0_100}` }]
        }),
      });
      const d = await res.json();
      const text = d.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setResult(parsed);
      setStep('result');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const q = PROFILE_QUESTIONS[profileStep];

  if (step === 'profile') return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Análisis IA de cartera</span>
      </div>
      <div style={{ background: '#0a0e1a', border: `1px solid ${GQ.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: GQ.text, marginBottom: 12, fontWeight: 500 }}>{q.label}</div>
        {q.type === 'select' ? (
          <select value={profile[q.key]} onChange={e => setProfile(p => ({...p, [q.key]: e.target.value}))}
            style={{ width: '100%', background: '#0d1224', border: `1px solid ${GQ.border}`, borderRadius: 8, color: GQ.text, fontSize: 13, padding: '10px 12px', outline: 'none' }}>
            {q.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type={q.type} value={profile[q.key]} onChange={e => setProfile(p => ({...p, [q.key]: e.target.value}))}
              placeholder={q.placeholder} autoFocus
              onKeyDown={e => e.key === 'Enter' && profileStep < PROFILE_QUESTIONS.length - 1 && setProfileStep(s => s+1)}
              style={{ flex: 1, background: '#0d1224', border: `1px solid ${GQ.border}`, borderRadius: 8, color: GQ.text, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
            <button onClick={() => profileStep < PROFILE_QUESTIONS.length - 1 ? setProfileStep(s => s+1) : runAnalysis()}
              disabled={loading} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: GQ.blue, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 18 }}>→</button>
          </div>
        )}
        {q.type === 'select' && (
          <button onClick={() => profileStep < PROFILE_QUESTIONS.length - 1 ? setProfileStep(s => s+1) : runAnalysis()}
            disabled={loading} style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: GQ.blue, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? 'Analizando...' : profileStep < PROFILE_QUESTIONS.length - 1 ? 'Siguiente →' : '🔍 Analizar cartera'}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {PROFILE_QUESTIONS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= profileStep ? GQ.blue : GQ.border }} />
        ))}
      </div>
      {profileStep > 0 && <button onClick={() => setProfileStep(s => s-1)} style={{ marginTop: 10, background: 'none', border: 'none', color: GQ.textMuted, fontSize: 12, cursor: 'pointer' }}>← Atrás</button>}
    </div>
  );

  if (!result) return null;

  const scoreColor = result.score >= 70 ? GQ.green : result.score >= 45 ? '#f59e0b' : GQ.red;
  const gauges = [
    { label: 'Diversificación', val: result.diversification, sub: result.diversification < 5 ? 'Mejora posible' : 'Bien diversificado' },
    { label: 'Riesgo', val: result.risk_level, sub: result.risk_level < 4 ? 'Bajo' : result.risk_level < 7 ? 'Medio' : 'Alto' },
    { label: 'Tasas', val: result.cost_efficiency, sub: result.cost_efficiency < 4 ? 'Alto coste' : 'Eficiente' },
    { label: 'Macroeconomía', val: result.macroeconomic, sub: result.macroeconomic < 4 ? 'Bajo' : 'Favorable' },
  ];

  return (
    <div>
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Análisis IA</span>
          <button onClick={() => { setStep('profile'); setProfileStep(0); setResult(null); }}
            style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.text, fontSize: 11, cursor: 'pointer' }}>↻ Nueva</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
          <ScoreGauge score={result.score} />
          <div style={{ fontSize: 12, color: GQ.textMuted, marginTop: 4, textAlign: 'center' }}>
            Tu cartera se sitúa por encima del <span style={{ color: scoreColor, fontWeight: 700 }}>{result.above_pct || 0}%</span> de usuarios
          </div>
          <div style={{ marginTop: 10, padding: '10px 16px', background: '#0a0e1a', borderRadius: 10, fontSize: 12, color: GQ.textMuted, maxWidth: 400, textAlign: 'center' }}>
            {result.summary}
          </div>
          {result.top_action && (
            <div style={{ marginTop: 8, padding: '8px 14px', background: `${GQ.amber}15`, border: `1px solid ${GQ.amber}30`, borderRadius: 10, fontSize: 12, color: GQ.amber, maxWidth: 400, textAlign: 'center' }}>
              💡 {result.top_action}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 8 }}>
          {gauges.map(g => {
            const gc = g.val >= 7 ? GQ.green : g.val >= 4 ? '#f59e0b' : GQ.red;
            const dashLen = (g.val/10)*125;
            return (
              <div key={g.label} style={{ background: '#0a0e1a', border: `1px solid ${GQ.border}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <svg width="80" height="46" viewBox="0 0 80 46">
                  <path d="M 5 40 A 35 35 0 0 1 75 40" fill="none" stroke={GQ.border} strokeWidth="7" strokeLinecap="round" />
                  <path d="M 5 40 A 35 35 0 0 1 75 40" fill="none" stroke={gc} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${dashLen} 125`} />
                  <text x="40" y="38" textAnchor="middle" fill={gc} fontSize="14" fontWeight="800">{g.val}</text>
                </svg>
                <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 2 }}>{g.sub}</div>
                <div style={{ fontSize: 12, color: GQ.text, fontWeight: 600 }}>{g.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      {result.recommendations?.length > 0 && (
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${GQ.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Recomendaciones</span>
          </div>
          {result.recommendations.map((r, i) => (
            <div key={i} style={{ borderBottom: i < result.recommendations.length-1 ? `1px solid ${GQ.border}` : 'none' }}>
              <button onClick={() => setExpanded(expanded === i ? null : i)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', color: GQ.text, textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</span>
                <span style={{ fontSize: 14, color: GQ.textMuted, transform: expanded === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </button>
              {expanded === i && (
                <div style={{ padding: '0 20px 14px', fontSize: 12, color: GQ.textMuted, lineHeight: 1.6 }}>{r.detail}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Performance Panel ─────────────────────────────────────────────────────────
function PerformancePanel({ positions, totalInvested, totalCurrentValue, totalGain, totalGainPct }) {
  const [chartMode, setChartMode] = useState('bar');
  const [timeTab, setTimeTab] = useState('max');

  const getGain = (pos) => (pos.current_value_eur || pos.invested_amount_eur || 0) - (pos.invested_amount_eur || 0);
  const getGainPct = (pos) => { const inv = pos.invested_amount_eur || 0; return inv === 0 ? 0 : (getGain(pos) / inv) * 100; };

  const barData = positions.map((p, i) => ({ name: p.ticker, rendimiento: +getGainPct(p).toFixed(2), color: PAL[i % PAL.length] }));

  return (
    <div>
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${GQ.border}` }}>
            {['max', String(new Date().getFullYear()), String(new Date().getFullYear() - 1)].map(t => (
              <button key={t} onClick={() => setTimeTab(t)}
                style={{ padding: '8px 14px', border: 'none', fontSize: 12, fontWeight: timeTab === t ? 600 : 400, background: 'transparent', color: timeTab === t ? GQ.text : GQ.textMuted, cursor: 'pointer', borderBottom: `2px solid ${timeTab === t ? GQ.blue : 'transparent'}` }}>
                {t === 'max' ? 'Duración máxima' : t}
              </button>
            ))}
          </div>
          <select value={chartMode} onChange={e => setChartMode(e.target.value)}
            style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, color: GQ.text, fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>
            <option value="bar">Gráfico de barras</option>
            <option value="heatmap">Mapa de calor</option>
            <option value="line">Gráfico lineal</option>
          </select>
        </div>
        {positions.length === 0 ? (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GQ.textMuted, fontSize: 13 }}>Sin datos</div>
        ) : chartMode === 'heatmap' ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(positions.length, 4)}, 1fr)`, gap: 8 }}>
            {positions.map((p, i) => {
              const gainPct = getGainPct(p);
              const pct = ((p.current_value_eur || p.invested_amount_eur || 0) / (totalCurrentValue || 1)) * 100;
              return <HeatCell key={p.id} ticker={p.ticker} name={p.name} pct={pct} gainPct={gainPct} />;
            })}
          </div>
        ) : chartMode === 'line' ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={barData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11, color: GQ.text }} formatter={v => [`${v}%`, 'Rendimiento']} />
              <Line type="monotone" dataKey="rendimiento" stroke={GQ.blue} strokeWidth={2} dot={{ fill: GQ.blue, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11, color: GQ.text }} formatter={v => [`${v}%`, 'Rendimiento']} />
              <Bar dataKey="rendimiento" radius={[4, 4, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.rendimiento >= 0 ? GQ.green : GQ.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: GQ.text, marginBottom: 16 }}>Capital</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${GQ.border}` }}>
          <span style={{ fontSize: 13, color: GQ.textMuted }}>Capital invertido</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{totalInvested.toFixed(2)} €</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${GQ.border}` }}>
          <span style={{ fontSize: 13, color: GQ.textMuted }}>Valor actual</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{totalCurrentValue.toFixed(2)} €</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${GQ.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Retorno total</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: totalGain >= 0 ? GQ.green : GQ.red }}>
            {totalGain >= 0 ? '+' : ''}{totalGain.toFixed(2)} € ({totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Benchmark Panel ───────────────────────────────────────────────────────────
const BENCHMARK_OPTIONS = [
  { id: 'SPY', label: 'S&P 500', ticker: 'SPY', color: '#34d399' },
  { id: 'VWCE.DE', label: 'MSCI World', ticker: 'VWCE.DE', color: '#60a5fa' },
  { id: 'QQQ', label: 'NASDAQ 100', ticker: 'QQQ', color: '#a78bfa' },
  { id: 'BTC-USD', label: 'Bitcoin', ticker: 'BTC-USD', color: '#f59e0b' },
  { id: 'GLD', label: 'Oro', ticker: 'GLD', color: '#fbbf24' },
];

const BENCH_RANGES = ['1M', 'YTD', '1Y', '3Y', '5A', 'Max'];

function BenchmarkPanel({ totalGainPct }) {
  const [selected, setSelected] = useState(['SPY']);
  const [showPicker, setShowPicker] = useState(false);
  const [range, setRange] = useState('YTD');
  const [benchData, setBenchData] = useState({});
  const [loading, setLoading] = useState(false);

  const PROXY = 'https://corsproxy.io/?url=';
  const YF = 'https://query1.finance.yahoo.com';

  const fetchBench = async (ticker, r) => {
    const rangeMap = { '1M': { range: '1mo', interval: '1d' }, 'YTD': { range: 'ytd', interval: '1wk' }, '1Y': { range: '1y', interval: '1wk' }, '3Y': { range: '3y', interval: '1mo' }, '5A': { range: '5y', interval: '1mo' }, 'Max': { range: 'max', interval: '1mo' } };
    const { range: r2, interval } = rangeMap[r] || rangeMap['YTD'];
    try {
      const url = `${PROXY}${encodeURIComponent(`${YF}/v8/finance/chart/${ticker}?interval=${interval}&range=${r2}`)}`;
      const res = await fetch(url);
      const d = await res.json();
      const result = d?.chart?.result?.[0];
      if (!result) return null;
      const closes = result.indicators?.quote?.[0]?.close || [];
      const timestamps = result.timestamp || [];
      if (!closes.length) return null;
      const base = closes.find(v => v != null) || closes[0];
      return timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        pct: closes[i] != null ? +((closes[i] - base) / base * 100).toFixed(2) : null,
      })).filter(d => d.pct !== null);
    } catch { return null; }
  };

  useEffect(() => {
    if (!selected.length) return;
    setLoading(true);
    Promise.all(selected.map(id => {
      const b = BENCHMARK_OPTIONS.find(x => x.id === id);
      return b ? fetchBench(b.ticker, range).then(data => ({ id, data })) : null;
    })).then(results => {
      const map = {};
      results.filter(Boolean).forEach(({ id, data }) => { if (data) map[id] = data; });
      setBenchData(map);
      setLoading(false);
    });
  }, [selected, range]);

  const chartData = (() => {
    const allDates = [...new Set(Object.values(benchData).flatMap(d => d.map(p => p.date)))];
    return allDates.map(date => {
      const point = { date, portfolio: +totalGainPct.toFixed(2) };
      Object.entries(benchData).forEach(([id, data]) => {
        const match = data.find(p => p.date === date);
        if (match) point[id] = match.pct;
      });
      return point;
    });
  })();

  const allLines = [
    { id: 'portfolio', label: 'Mi cartera', color: '#6366f1' },
    ...BENCHMARK_OPTIONS.filter(b => selected.includes(b.id)),
  ];

  return (
    <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Evaluación comparativa</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {BENCH_RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: range === r ? GQ.text : 'transparent', color: range === r ? GQ.bg : GQ.textMuted, fontSize: 11, cursor: 'pointer', fontWeight: range === r ? 700 : 400 }}>
              {r}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GQ.textMuted, fontSize: 12 }}>Cargando datos...</div>
      ) : chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: GQ.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11, color: GQ.text }}
              formatter={(v, name) => [`${v >= 0 ? '+' : ''}${v}%`, allLines.find(l => l.id === name)?.label || name]} />
            {allLines.map(l => <Line key={l.id} type="monotone" dataKey={l.id} stroke={l.color} strokeWidth={l.id === 'portfolio' ? 2.5 : 1.5} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GQ.textMuted, fontSize: 12 }}>Sin datos para mostrar</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#6366f115', border: '1px solid #6366f130', borderRadius: 20 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Mi cartera</span>
        </div>
        {selected.map(id => {
          const b = BENCHMARK_OPTIONS.find(x => x.id === id);
          return b ? (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: `${b.color}15`, border: `1px solid ${b.color}30`, borderRadius: 20 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
              <span style={{ fontSize: 11, color: b.color }}>{b.label}</span>
              <button onClick={() => setSelected(s => s.filter(x => x !== id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: b.color, fontSize: 12, lineHeight: 1, padding: 0, marginLeft: 2 }}>✕</button>
            </div>
          ) : null;
        })}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowPicker(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.textMuted, fontSize: 11, cursor: 'pointer' }}>
            + Punto de referencia
          </button>
          {showPicker && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 50, background: '#1a1f2e', border: `1px solid ${GQ.border}`, borderRadius: 12, padding: '8px 0', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginBottom: 6 }}>
              {BENCHMARK_OPTIONS.map(b => (
                <button key={b.id} onClick={() => setSelected(s => s.includes(b.id) ? s.filter(x => x !== b.id) : [...s, b.id])}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: GQ.text, fontSize: 13, textAlign: 'left' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: GQ.text }}>{b.label}</div>
                    <div style={{ fontSize: 10, color: GQ.textMuted }}>{b.ticker}</div>
                  </div>
                  {selected.includes(b.id) && <span style={{ color: GQ.green }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function FinanceInvestTab() {
  const [positions, setPositions] = useState([]);
  const [dailyTxs, setDailyTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState('portfolio');
  const [portfolioRange, setPortfolioRange] = useState('YTD');
  const [portfolioChart, setPortfolioChart] = useState('line');
  const [portfolioMode, setPortfolioMode] = useState('valor');
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [showCapital, setShowCapital] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAssetId, setSellAssetId] = useState('');
  const [sellPriceInput, setSellPriceInput] = useState('');
  const [sellAmountInput, setSellAmountInput] = useState('');
  const [sellDate, setSellDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', broker: '' });
  const [accounts, setAccounts] = useState([]);
  const [sales, setSales] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'current', dir: 'desc' });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [txSearch, setTxSearch] = useState('');
  const [txFilter, setTxFilter] = useState('all');

  const emptyForm = () => ({ ticker: '', name: '', investment_type: 'stock', invested_amount_eur: '', buy_price: '', currency: 'EUR', description: '', date: format(new Date(), 'yyyy-MM-dd'), sector: '', region: '', _fxRate: null, is_own_money: true });
  const [form, setForm] = useState(emptyForm());

  const fetchData = useCallback(async () => {
    const [pos, txs, sl, acc] = await Promise.all([
      base44.entities.InvestmentPosition.list('-created_date', 100),
      base44.entities.FinanceTransaction.list('-date', 1000),
      base44.entities.InvestmentSale.list('-date', 200),
      base44.entities.InvestmentAccount.list('-created_date', 50),
    ]);
    setPositions(pos); setDailyTxs(txs); setSales(sl); setAccounts(acc); setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // Build portfolio history
  useEffect(() => {
    if (positions.length === 0) { setPortfolioHistory([]); return; }
    const now = new Date();
    const allBuys = [];
    positions.forEach(pos => {
      const gainRatio = (pos.buy_price > 0 && pos.current_price > 0) ? pos.current_price / pos.buy_price
        : (pos.invested_amount_eur > 0 ? (pos.current_value_eur || pos.invested_amount_eur) / pos.invested_amount_eur : 1);
      const hist = pos.purchase_history?.length > 0 ? pos.purchase_history
        : [{ date: pos.date, amount_eur: pos.invested_amount_eur, buy_price: pos.buy_price, currency: pos.currency }];
      hist.forEach(h => {
        if (!h.date || !h.amount_eur) return;
        allBuys.push({ date: new Date(h.date), amount: h.amount_eur || 0, isOwn: pos.is_own_money !== false, gainRatio });
      });
    });
    if (allBuys.length === 0) { setPortfolioHistory([]); return; }
    allBuys.sort((a, b) => a.date - b.date);
    const rangeMap = {
      '1D': { ms: 86400000, interval: 'hour' }, '1W': { ms: 7*86400000, interval: 'day' },
      '1M': { ms: 30*86400000, interval: 'day' }, 'YTD': { ms: (now - new Date(now.getFullYear(),0,1)), interval: 'week' },
      '1Y': { ms: 365*86400000, interval: 'week' }, 'Max': { ms: null, interval: 'month' },
    };
    const cfg = rangeMap[portfolioRange] || rangeMap['Max'];
    const startDate = cfg.ms ? new Date(now.getTime() - cfg.ms) : allBuys[0].date;
    const points = [];
    let d = new Date(startDate);
    const addStep = (d) => {
      const n = new Date(d);
      if (cfg.interval === 'hour') n.setHours(n.getHours() + 3);
      else if (cfg.interval === 'day') n.setDate(n.getDate() + 1);
      else if (cfg.interval === 'week') n.setDate(n.getDate() + 7);
      else n.setMonth(n.getMonth() + 1);
      return n;
    };
    while (d <= now) { points.push(new Date(d)); d = addStep(d); }
    points.push(now);
    const fmtDate = (d) => {
      if (cfg.interval === 'hour') return format(d, 'HH:mm', { locale: es });
      if (cfg.interval === 'day') return format(d, 'd MMM', { locale: es });
      if (cfg.interval === 'week') return format(d, 'd MMM', { locale: es });
      return format(d, 'MMM yy', { locale: es });
    };
    const history = points.map(point => {
      let ownCapital = 0, ownValue = 0, totalCap = 0, totalVal = 0;
      allBuys.filter(b => b.date <= point).forEach(b => {
        const progress = Math.min((point - b.date) / (now - b.date || 1), 1);
        const gainAtPoint = 1 + (b.gainRatio - 1) * progress;
        const valAtPoint = b.amount * gainAtPoint;
        if (b.isOwn) { ownCapital += b.amount; ownValue += valAtPoint; }
        totalCap += b.amount; totalVal += valAtPoint;
      });
      return {
        date: fmtDate(point),
        fullDate: format(point, "d 'de' MMMM yyyy", { locale: es }),
        valor: +totalVal.toFixed(2), capital: +totalCap.toFixed(2),
        ownCapital: +ownCapital.toFixed(2), ownValue: +ownValue.toFixed(2),
        rendimientoProp: ownCapital > 0 ? +((ownValue - ownCapital) / ownCapital * 100).toFixed(2) : 0,
        rendimientoTotal: totalCap > 0 ? +((totalVal - totalCap) / totalCap * 100).toFixed(2) : 0,
      };
    });
    setPortfolioHistory(history);
  }, [positions, portfolioRange]);

  // Helpers
  const getGain = useCallback((pos) => (pos.current_value_eur || pos.invested_amount_eur || 0) - (pos.invested_amount_eur || 0), []);
  const getGainPct = useCallback((pos) => {
    const inv = pos.invested_amount_eur || 0;
    return inv === 0 ? 0 : (getGain(pos) / inv) * 100;
  }, [getGain]);

  const allTransactions = useMemo(() => {
    const txs = [];
    positions.forEach(pos => {
      const hist = pos.purchase_history?.length > 0 ? pos.purchase_history
        : [{ date: pos.date, amount_eur: pos.invested_amount_eur, buy_price: pos.buy_price, currency: pos.currency }];
      hist.forEach((h, i) => {
        if (!h?.amount_eur) return;
        txs.push({ id: `${pos.id}_buy_${i}`, type: 'buy', ticker: pos.ticker, name: pos.name, date: h.date, amount: h.amount_eur, price: h.buy_price, currency: h.currency || pos.currency, posId: pos.id, investment_type: pos.investment_type });
      });
    });
    sales.forEach(s => txs.push({ id: s.id, type: 'sell', ticker: s.ticker, name: s.name, date: s.date, amount: s.amount_eur, price: s.sell_price, gain: s.gain_eur, gainPct: s.gain_pct, saleId: s.id }));
    txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return txs;
  }, [positions, sales]);

  const filteredTransactions = useMemo(() => {
    let txs = allTransactions;
    if (txFilter !== 'all') txs = txs.filter(t => t.type === txFilter);
    if (txSearch.trim()) { const q = txSearch.toLowerCase(); txs = txs.filter(t => t.ticker?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q)); }
    return txs;
  }, [allTransactions, txSearch, txFilter]);

  const filteredGroupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(tx => {
      const key = tx.date ? tx.date.slice(0, 7) : 'unknown';
      if (!groups[key]) groups[key] = { key, label: tx.date ? format(new Date(tx.date + 'T12:00:00'), 'MMMM yyyy', { locale: es }) : 'Sin fecha', txs: [] };
      groups[key].txs.push(tx);
    });
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredTransactions]);

  const sortedPositions = useMemo(() => {
    const arr = [...positions];
    const { key, dir } = sortConfig;
    arr.sort((a, b) => {
      let av, bv;
      if (key === 'name') { av = a.ticker || ''; bv = b.ticker || ''; }
      else if (key === 'buy') { av = a.invested_amount_eur || 0; bv = b.invested_amount_eur || 0; }
      else if (key === 'current') { av = a.current_value_eur || a.invested_amount_eur || 0; bv = b.current_value_eur || b.invested_amount_eur || 0; }
      else if (key === 'gain') { av = getGain(a); bv = getGain(b); }
      else if (key === 'gainPct') { av = getGainPct(a); bv = getGainPct(b); }
      else { av = 0; bv = 0; }
      if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [positions, sortConfig, getGain, getGainPct]);

  const toggleSort = (key) => setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
  const SortArrow = ({ k }) => {
    if (sortConfig.key !== k) return <span style={{ color: GQ.textDim }}>↕</span>;
    return <span style={{ color: GQ.text }}>{sortConfig.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  const dailyIncome = dailyTxs.filter(t => ['income', 'transfer_from_savings', 'transfer_from_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyOut = dailyTxs.filter(t => ['expense', 'other', 'transfer_to_savings', 'transfer_to_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyAvailable = dailyIncome - dailyOut;
  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true); setSearchResults([]);
    const r = await searchYahoo(searchQuery);
    setSearchResults(r); setSearchLoading(false);
  };

  const handleSelectResult = async (result) => {
    setSelectedResult(result);
    const typeMap = { 'EQUITY': 'stock', 'ETF': 'etf', 'MUTUALFUND': 'index_fund', 'CRYPTOCURRENCY': 'crypto', 'BOND': 'bond' };
    const regionMap = { 'NMS': 'América del Norte', 'NYQ': 'América del Norte', 'BIT': 'Europa', 'FRA': 'Europa', 'EPA': 'Europa', 'LSE': 'Europa' };
    const stockInfo = getStockInfo(result.ticker);
    setForm(f => ({ ...f, ticker: result.ticker, name: result.name, investment_type: typeMap[result.type?.toUpperCase()] || 'stock', region: regionMap[result.exchange] || stockInfo?.region || '', sector: stockInfo?.sector || '' }));
    const quote = await getYahooQuote(result.ticker);
    if (quote) { const fx = await getEurFxRate(quote.currency || 'USD'); setForm(f => ({ ...f, buy_price: quote.price?.toFixed(2) || '', currency: quote.currency || 'USD', _fxRate: fx })); }
    setSearchResults([]);
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    for (const pos of positions) {
      try {
        const quote = await getYahooQuote(pos.ticker);
        if (quote?.price) {
          const fx = await getEurFxRate(quote.currency || 'EUR');
          const eFx = fx || pos.fx_rate || 1;
          let val = pos.invested_amount_eur || 0;
          if (pos.buy_price > 0 && pos.invested_amount_eur > 0) { const units = pos.invested_amount_eur / (pos.buy_price * (pos.fx_rate || eFx)); val = units * quote.price * eFx; }
          await base44.entities.InvestmentPosition.update(pos.id, { current_price: quote.price, current_value_eur: +val.toFixed(2), fx_rate: +eFx.toFixed(6), last_updated: new Date().toISOString() });
        }
      } catch {}
    }
    await fetchData(); setRefreshing(false);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.invested_amount_eur);
    if (!amount || amount <= 0) return;
    const buyPrice = parseFloat(form.buy_price) || 0;
    const fxRate = form.currency !== 'EUR' && buyPrice > 0 ? (amount / buyPrice) : 1;
    const data = { ticker: form.ticker.toUpperCase(), name: form.name, investment_type: form.investment_type, invested_amount_eur: amount, buy_price: buyPrice, currency: form.currency, description: form.description, date: form.date, sector: form.sector, region: form.region, current_value_eur: amount, current_price: buyPrice, fx_rate: fxRate, is_own_money: form.is_own_money !== false };
    const m = new Date(form.date).getMonth() + 1; const yr = new Date(form.date).getFullYear();
    if (form.is_own_money !== false) { await base44.entities.FinanceTransaction.create({ type: 'transfer_to_investment', amount, description: `Inversión en ${form.ticker.toUpperCase()}`, date: form.date, month: m, year: yr }); }
    if (editingPos) {
      const hist = [...(editingPos.purchase_history || []), { date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }];
      await base44.entities.InvestmentPosition.update(editingPos.id, { ...data, invested_amount_eur: (editingPos.invested_amount_eur || 0) + amount, current_value_eur: (editingPos.current_value_eur || editingPos.invested_amount_eur || 0) + amount, purchase_history: hist });
    } else {
      await base44.entities.InvestmentPosition.create({ ...data, purchase_history: [{ date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }] });
    }
    setShowForm(false); setEditingPos(null); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setForm(emptyForm()); fetchData();
  };

  const handleDelete = async () => { await base44.entities.InvestmentPosition.delete(deleteId); setDeleteId(null); fetchData(); };

  const handleSellWithSave = async () => {
    const pos = positions.find(p => p.id === sellAssetId);
    if (!pos || !sellAmountInput) return;
    const amount = parseFloat(sellAmountInput);
    const sellPriceVal = parseFloat(sellPriceInput) || pos.current_price || 0;
    const cur = pos.current_value_eur || pos.invested_amount_eur || 0;
    if (amount > cur) { alert('Cantidad mayor al valor actual'); return; }
    const ratio = amount / cur;
    const gainOnSale = amount - (pos.invested_amount_eur || 0) * ratio;
    const gainPctOnSale = (pos.invested_amount_eur || 0) * ratio > 0 ? (gainOnSale / ((pos.invested_amount_eur || 0) * ratio)) * 100 : 0;
    await base44.entities.InvestmentSale.create({ position_id: pos.id, ticker: pos.ticker, name: pos.name, amount_eur: amount, sell_price: sellPriceVal, buy_price: pos.buy_price || 0, date: sellDate, gain_eur: +gainOnSale.toFixed(2), gain_pct: +gainPctOnSale.toFixed(2), investment_type: pos.investment_type });
    await base44.entities.InvestmentPosition.update(pos.id, { current_value_eur: +(cur - amount).toFixed(2), invested_amount_eur: +((pos.invested_amount_eur || 0) * (1 - ratio)).toFixed(2) });
    setShowSellModal(false); setSellAssetId(''); setSellAmountInput(''); setSellPriceInput('');
    fetchData();
  };

  const handleCreateAccount = async () => {
    if (!accountForm.name.trim()) return;
    await base44.entities.InvestmentAccount.create({ name: accountForm.name, broker: accountForm.broker, created_date: new Date().toISOString() });
    setShowAccountForm(false); setAccountForm({ name: '', broker: '' }); fetchData();
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${GQ.border}`, borderTopColor: GQ.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const MAIN_TABS = [
    { id: 'portfolio', label: 'Cartera de inversiones' },
    { id: 'distribution', label: 'Distribución' },
    { id: 'performance', label: 'Rendimiento' },
    { id: 'dividends', label: 'Dividendos' },
    { id: 'ai', label: 'getquin IA' },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: GQ.text, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: GQ.text, margin: 0 }}>Cartera de inversiones</h2>
              <button onClick={() => setShowAccountForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.text, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                + Agregar cuenta {accounts.length > 0 ? `(${accounts.length})` : ''}
              </button>
            </div>
            <div style={{ fontSize: 12, color: GQ.textMuted }}>Mis inversiones · Yahoo Finance en tiempo real</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: GQ.text }}>{totalCurrentValue.toFixed(2)} €</span>
            </div>
            <div style={{ fontSize: 13, color: totalGain >= 0 ? GQ.green : GQ.red }}>
              {totalGain >= 0 ? '↑' : '↓'}{Math.abs(totalGainPct).toFixed(2)}% ({totalGain >= 0 ? '+' : ''}{totalGain.toFixed(2)} €)
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {['1D', '1W', '1M', 'YTD', '1Y', 'Max'].map(r => (
            <button key={r} onClick={() => setPortfolioRange(r)}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: portfolioRange === r ? 600 : 400, background: portfolioRange === r ? '#1f2937' : 'transparent', color: portfolioRange === r ? GQ.text : GQ.textMuted, cursor: 'pointer' }}>
              {r}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          {['valor', 'rendimiento'].map(mode => (
            <button key={mode} onClick={() => setPortfolioMode(mode)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${portfolioMode === mode ? GQ.green : GQ.textDim}`, background: portfolioMode === mode ? GQ.green : 'transparent', transition: 'all 0.15s' }} />
              <span style={{ fontSize: 12, color: portfolioMode === mode ? GQ.text : GQ.textMuted, fontWeight: portfolioMode === mode ? 600 : 400 }}>
                {mode === 'valor' ? 'Valor de la cartera' : 'Rendimiento'}
              </span>
            </button>
          ))}
        </div>
        {positions.length > 0 && portfolioHistory.length > 0 && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={portfolioHistory} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="gqMainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GQ.green} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={GQ.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={GQ.border} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: GQ.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: GQ.textMuted }} axisLine={false} tickLine={false} width={40}
                tickFormatter={v => portfolioMode === 'rendimiento' ? `${v.toFixed(1)}%` : `${v.toFixed(0)}€`} domain={['auto', 'auto']} />
              <Tooltip cursor={{ stroke: GQ.textMuted, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: '#1a1f2e', border: `1px solid ${GQ.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                      <div style={{ color: GQ.textMuted, marginBottom: 8, fontSize: 11 }}>{d?.fullDate}</div>
                      {portfolioMode === 'valor' ? (
                        <div style={{ color: GQ.text, fontWeight: 700 }}>{(d?.valor || 0).toFixed(2)} €</div>
                      ) : (
                        <div style={{ color: (d?.rendimientoProp || 0) >= 0 ? GQ.green : GQ.red, fontWeight: 700 }}>
                          {(d?.rendimientoProp || 0) >= 0 ? '+' : ''}{(d?.rendimientoProp || 0).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {portfolioMode === 'valor' && <Line type="monotone" dataKey="capital" stroke={GQ.textMuted} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
              <Area type="monotone" dataKey={portfolioMode === 'rendimiento' ? 'rendimientoProp' : 'valor'}
                stroke={GQ.green} fill="url(#gqMainGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${GQ.border}`, marginBottom: 16, overflowX: 'auto' }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            style={{ padding: '12px 18px', border: 'none', fontSize: 13, fontWeight: mainTab === t.id ? 600 : 400, background: 'transparent', color: mainTab === t.id ? GQ.text : GQ.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${mainTab === t.id ? GQ.green : 'transparent'}`, transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PORTFOLIO TAB */}
      {mainTab === 'portfolio' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={handleRefreshPrices} disabled={refreshing || positions.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.textMuted, fontSize: 12, cursor: 'pointer' }}>
              <RefreshCw style={{ width: 13, height: 13, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Actualizando...' : 'Actualizar precios'}
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ id: 'line', label: '〜' }, { id: 'bar', label: '▊' }, { id: 'heatmap', label: '▦' }].map(ct => (
                <button key={ct.id} onClick={() => setPortfolioChart(ct.id)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid`, borderColor: portfolioChart === ct.id ? GQ.blue : GQ.border, background: portfolioChart === ct.id ? GQ.blueDim : 'transparent', color: portfolioChart === ct.id ? '#93c5fd' : GQ.textMuted, fontSize: 14, cursor: 'pointer' }}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Positions table */}
          <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, marginBottom: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${GQ.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Posiciones</span>
              <button onClick={() => { setEditingPos(null); setForm(emptyForm()); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setShowForm(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.text, fontSize: 12, cursor: 'pointer' }}>
                + Agregar transacción
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 32px', gap: 0, padding: '10px 20px', borderBottom: `1px solid ${GQ.border}` }}>
              {[{ label: 'Título', key: 'name' }, { label: 'Compra', key: 'buy' }, { label: 'Posición', key: 'current' }, { label: 'P/L', key: 'gainPct' }, { label: '', key: null }].map((h, i) => (
                <button key={i} onClick={() => h.key && toggleSort(h.key)}
                  style={{ fontSize: 11, color: GQ.textMuted, fontWeight: 500, textAlign: i > 0 ? 'right' : 'left', display: 'flex', alignItems: 'center', justifyContent: i > 0 ? 'flex-end' : 'flex-start', gap: 4, background: 'none', border: 'none', cursor: h.key ? 'pointer' : 'default', padding: 0 }}>
                  {h.label}{h.key && <SortArrow k={h.key} />}
                </button>
              ))}
            </div>
            {sortedPositions.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: GQ.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                <div style={{ fontSize: 14 }}>Sin posiciones aún</div>
              </div>
            ) : (
              sortedPositions.map(pos => {
                const gain = getGain(pos);
                const gainPct = getGainPct(pos);
                const cur = pos.current_value_eur || pos.invested_amount_eur || 0;
                const typeInfo = getType(pos.investment_type);
                return (
                  <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 32px', gap: 0, padding: '14px 20px', borderBottom: `1px solid ${GQ.border}`, alignItems: 'center', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${typeInfo.color}15`, border: `1px solid ${typeInfo.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: typeInfo.color, flexShrink: 0 }}>
                        {pos.ticker?.slice(0, 4)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{pos.name?.slice(0, 24)}</div>
                        <div style={{ fontSize: 11, color: GQ.textMuted }}>{pos.ticker}{pos.currency && pos.currency !== 'EUR' ? ` · ${pos.currency}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: GQ.textMuted }}>{pos.buy_price ? `${pos.buy_price.toFixed(2)} €` : '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{cur.toFixed(2)} €</div>
                      <div style={{ fontSize: 10, color: GQ.textDim }}>{pos.current_price ? `${pos.current_price.toFixed(2)} ${pos.currency || '€'}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: gain >= 0 ? GQ.green : GQ.red }}>{gain >= 0 ? '+' : ''}{gain.toFixed(2)} €</div>
                      <div style={{ fontSize: 11, color: gain >= 0 ? GQ.green : GQ.red }}>{gainPct >= 0 ? '↑' : '↓'}{Math.abs(gainPct).toFixed(2)}%</div>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === pos.id ? null : pos.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: GQ.textMuted, padding: '4px 6px', borderRadius: 6 }}>⋮</button>
                      {openMenuId === pos.id && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: '#1a1f2e', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '4px 0', minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                          <button onClick={() => { setEditingPos(pos); setForm({ ...emptyForm(), ticker: pos.ticker, name: pos.name, investment_type: pos.investment_type, currency: pos.currency || 'EUR', sector: pos.sector || '', region: pos.region || '' }); setShowForm(true); setOpenMenuId(null); }}
                            style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: GQ.text, fontSize: 13, cursor: 'pointer' }}>
                            ✏️ Editar
                          </button>
                          <button onClick={() => { setDeleteId(pos.id); setOpenMenuId(null); }}
                            style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: GQ.red, fontSize: 13, cursor: 'pointer' }}>
                            🗑️ Borrar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Transactions */}
          <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${GQ.border}`, alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#0a0a0f', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '8px 12px' }}>
                <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Buscar ticker, nombre..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: GQ.text, fontSize: 13 }} />
              </div>
              <select value={txFilter} onChange={e => setTxFilter(e.target.value)}
                style={{ background: '#0a0a0f', border: `1px solid ${GQ.border}`, borderRadius: 10, color: GQ.text, fontSize: 12, padding: '8px 12px', cursor: 'pointer', outline: 'none' }}>
                <option value="all">Todos</option><option value="buy">Compras</option><option value="sell">Ventas</option>
              </select>
            </div>
            {filteredGroupedTransactions.length === 0 ? (
              <div style={{ padding: '24px 20px', fontSize: 12, color: GQ.textDim }}>Sin transacciones</div>
            ) : (
              filteredGroupedTransactions.map(group => (
                <div key={group.key}>
                  <div style={{ padding: '10px 20px', background: '#0d0d14', fontSize: 12, fontWeight: 600, color: GQ.textMuted, textTransform: 'capitalize' }}>{group.label}</div>
                  {group.txs.map((tx, i) => {
                    const isBuy = tx.type === 'buy';
                    const dayStr = tx.date ? format(new Date(tx.date + 'T12:00:00'), 'dd', { locale: es }) : '—';
                    return (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${GQ.border}`, transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ minWidth: 36, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: GQ.text, lineHeight: 1 }}>{dayStr}</div>
                          <div style={{ fontSize: 9, color: GQ.textMuted }}>{isBuy ? '→' : '←'}</div>
                        </div>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: isBuy ? `${GQ.blue}18` : `${GQ.green}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: isBuy ? '#93c5fd' : GQ.green, flexShrink: 0 }}>
                          {tx.ticker?.slice(0, 4)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{tx.name || tx.ticker}</div>
                          <div style={{ fontSize: 11, color: GQ.textMuted }}>{isBuy ? 'Compra' : 'Venta'}{tx.price ? ` · ${tx.price.toFixed(2)} €` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isBuy ? GQ.text : GQ.green }}>{isBuy ? '' : '+'}{(tx.amount || 0).toFixed(2)} €</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DISTRIBUTION TAB */}
      {mainTab === 'distribution' && (
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
          <DistributionPanel positions={positions} totalCurrentValue={totalCurrentValue} />
        </div>
      )}

      {/* PERFORMANCE TAB */}
      {mainTab === 'performance' && (
        <div>
          <PerformancePanel positions={positions} totalInvested={totalInvested} totalCurrentValue={totalCurrentValue} totalGain={totalGain} totalGainPct={totalGainPct} />
          <BenchmarkPanel totalGainPct={totalGainPct} />
        </div>
      )}

      {/* DIVIDENDS TAB */}
      {mainTab === 'dividends' && (
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
          <DividendsPanel positions={positions} />
        </div>
      )}

      {/* AI TAB */}
      {mainTab === 'ai' && (
        <AIPanel positions={positions} totalInvested={totalInvested} totalCurrentValue={totalCurrentValue} totalGain={totalGain} totalGainPct={totalGainPct} />
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* New/Edit position */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingPos(null); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setForm(emptyForm()); } }}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground">{editingPos ? `Añadir compra — ${editingPos.ticker}` : 'Nueva posición'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {!editingPos && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">💰 Saldo disponible: <span className="text-green-400 font-semibold">{dailyAvailable.toFixed(2)}€</span></div>
                <div className="flex gap-2 mb-2">
                  <Input placeholder="Buscar ticker o nombre..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="bg-background/50 border-border text-sm" />
                  <Button onClick={handleSearch} disabled={searchLoading} variant="outline" className="border-border px-3">
                    {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {selectedResult && (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg mb-2">
                    <span className="text-xs text-green-400">✓ {selectedResult.ticker} — {selectedResult.name}</span>
                    <button onClick={() => { setSelectedResult(null); setForm(f => ({ ...f, ticker: '', name: '', buy_price: '' })); }} className="ml-auto"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden mb-2">
                    {searchResults.map(r => (
                      <button key={r.ticker} onClick={() => handleSelectResult(r)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors border-b border-border last:border-0 text-left">
                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-[10px] font-bold text-foreground">{r.ticker.slice(0, 3)}</div>
                        <div><div className="text-sm font-medium text-foreground">{r.ticker}</div><div className="text-xs text-muted-foreground">{r.name}</div></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Ticker</label><Input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" className="bg-background/50 border-border text-sm" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Nombre</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Apple Inc." className="bg-background/50 border-border text-sm" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={form.investment_type} onValueChange={v => setForm(f => ({ ...f, investment_type: v }))}>
                <SelectTrigger className="bg-background/50 border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">{TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Dinero invertido (€)</label><Input type="number" value={form.invested_amount_eur} onChange={e => setForm(f => ({ ...f, invested_amount_eur: e.target.value }))} placeholder="0.00" className="bg-background/50 border-border text-sm" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Precio compra</label><Input type="number" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} placeholder="0.00" className="bg-background/50 border-border text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Moneda</label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="bg-background/50 border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Fecha</label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-background/50 border-border text-sm" /></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Tipo de compra</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setForm(f => ({ ...f, is_own_money: true }))}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid`, borderColor: form.is_own_money !== false ? '#22c55e' : '#1f2937', background: form.is_own_money !== false ? '#14532d' : 'transparent', color: form.is_own_money !== false ? '#4ade80' : '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                  💰 Dinero propio
                </button>
                <button onClick={() => setForm(f => ({ ...f, is_own_money: false }))}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid`, borderColor: form.is_own_money === false ? '#3b82f6' : '#1f2937', background: form.is_own_money === false ? '#1e3a5f' : 'transparent', color: form.is_own_money === false ? '#93c5fd' : '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                  🎁 No dinero propio
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingPos(null); setForm(emptyForm()); }} className="flex-1 border-border text-sm">Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.ticker || !form.invested_amount_eur} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                {editingPos ? 'Añadir compra' : 'Crear posición'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell modal */}
      <Dialog open={showSellModal} onOpenChange={v => { if (!v) setShowSellModal(false); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Vender posición</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Activo a vender</label>
              <select value={sellAssetId} onChange={e => setSellAssetId(e.target.value)}
                style={{ width: '100%', background: '#0a0a0f', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '9px 12px', color: GQ.text, fontSize: 13, outline: 'none' }}>
                {positions.map(p => <option key={p.id} value={p.id}>{p.ticker} — {(p.current_value_eur || p.invested_amount_eur || 0).toFixed(2)} €</option>)}
              </select>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Precio de venta</label><Input type="number" value={sellPriceInput} onChange={e => setSellPriceInput(e.target.value)} placeholder="0.00" className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Cantidad vendida (€)</label><Input type="number" value={sellAmountInput} onChange={e => setSellAmountInput(e.target.value)} placeholder="0.00" className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Fecha</label><Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="bg-background/50 border-border [color-scheme:dark]" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={() => setShowSellModal(false)} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleSellWithSave} disabled={!sellAssetId || !sellAmountInput} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Confirmar venta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account modal */}
      <Dialog open={showAccountForm} onOpenChange={v => { if (!v) setShowAccountForm(false); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Nueva cartera</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Nombre</label><Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="Mi Cartera Principal..." className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Broker (opcional)</label><Input value={accountForm.broker} onChange={e => setAccountForm(f => ({ ...f, broker: e.target.value }))} placeholder="DEGIRO, Trade Republic..." className="bg-background/50 border-border" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={() => setShowAccountForm(false)} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleCreateAccount} disabled={!accountForm.name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Crear cartera</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle className="text-foreground">¿Eliminar posición?</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
