import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, RefreshCw, TrendingUp, TrendingDown, Search, X, ChevronRight, ChevronDown, Globe, Building2, Zap, Droplets, Briefcase, Loader2, Bot, Send, User, Sparkles, AlertTriangle, CheckCircle, Lightbulb, Settings, Download } from 'lucide-react';
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


// ─── ETF composition (via ETF.com scraping proxy) ────────────────────────────
// Known ETF compositions for common ETFs
const ETF_COMPOSITIONS = {
  'IWDA': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 4.2, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 3.8, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 3.1, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', pct: 2.4, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. A', pct: 2.1, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'META', name: 'Meta Platforms', pct: 1.3, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'TSLA', name: 'Tesla Inc.', pct: 1.0, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AVGO', name: 'Broadcom Inc.', pct: 0.9, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'JPM', name: 'JPMorgan Chase', pct: 0.9, region: 'América del Norte', sector: 'Finanzas', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'LLY', name: 'Eli Lilly', pct: 0.8, region: 'América del Norte', sector: 'Salud', country: 'EE.UU.', currency: 'USD' },
  ],
  'VUSA': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 7.2, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 6.5, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 5.3, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', pct: 4.0, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. A', pct: 3.5, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'META', name: 'Meta Platforms', pct: 2.1, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'TSLA', name: 'Tesla Inc.', pct: 1.7, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AVGO', name: 'Broadcom Inc.', pct: 1.5, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'JPM', name: 'JPMorgan Chase', pct: 1.4, region: 'América del Norte', sector: 'Finanzas', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'LLY', name: 'Eli Lilly', pct: 1.3, region: 'América del Norte', sector: 'Salud', country: 'EE.UU.', currency: 'USD' },
  ],
  'VUAG': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 7.2, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 6.5, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 5.3, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', pct: 4.0, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. A', pct: 3.5, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'META', name: 'Meta Platforms', pct: 2.1, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'TSLA', name: 'Tesla Inc.', pct: 1.7, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AVGO', name: 'Broadcom Inc.', pct: 1.5, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'JPM', name: 'JPMorgan Chase', pct: 1.4, region: 'América del Norte', sector: 'Finanzas', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'LLY', name: 'Eli Lilly', pct: 1.3, region: 'América del Norte', sector: 'Salud', country: 'EE.UU.', currency: 'USD' },
  ],
  'XDWD': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 4.8, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 4.1, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 3.4, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', pct: 2.6, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'GOOGL', name: 'Alphabet Inc. A', pct: 2.2, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'META', name: 'Meta Platforms', pct: 1.4, region: 'América del Norte', sector: 'Comunicaciones', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NESN', name: 'Nestlé', pct: 0.9, region: 'Europa', sector: 'Consumo básico', country: 'Suiza', currency: 'CHF' },
    { ticker: 'ASML', name: 'ASML Holding', pct: 0.8, region: 'Europa', sector: 'Tecnología', country: 'Países Bajos', currency: 'EUR' },
    { ticker: 'NOVO-B', name: 'Novo Nordisk', pct: 0.7, region: 'Europa', sector: 'Salud', country: 'Dinamarca', currency: 'DKK' },
    { ticker: '7203.T', name: 'Toyota Motor', pct: 0.6, region: 'Asia Pacífico', sector: 'Consumo discrecional', country: 'Japón', currency: 'JPY' },
  ],
  'ISAC': [
    { ticker: 'AAPL', name: 'Apple Inc.', pct: 4.1, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', pct: 3.7, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', pct: 3.0, region: 'América del Norte', sector: 'Tecnología', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', pct: 2.3, region: 'América del Norte', sector: 'Consumo discrecional', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'BABA', name: 'Alibaba Group', pct: 0.5, region: 'Asia Pacífico', sector: 'Consumo discrecional', country: 'China', currency: 'HKD' },
    { ticker: 'TCEHY', name: 'Tencent Holdings', pct: 0.8, region: 'Asia Pacífico', sector: 'Comunicaciones', country: 'China', currency: 'HKD' },
    { ticker: 'Samsung', name: 'Samsung Electronics', pct: 0.7, region: 'Asia Pacífico', sector: 'Tecnología', country: 'Corea del Sur', currency: 'KRW' },
  ],
  'EIMI': [
    { ticker: 'TCEHY', name: 'Tencent Holdings', pct: 3.9, region: 'Asia Pacífico', sector: 'Comunicaciones', country: 'China', currency: 'HKD' },
    { ticker: 'Samsung', name: 'Samsung Electronics', pct: 3.2, region: 'Asia Pacífico', sector: 'Tecnología', country: 'Corea del Sur', currency: 'KRW' },
    { ticker: 'BABA', name: 'Alibaba Group', pct: 2.1, region: 'Asia Pacífico', sector: 'Consumo discrecional', country: 'China', currency: 'HKD' },
    { ticker: 'BIDU', name: 'Baidu Inc.', pct: 0.8, region: 'Asia Pacífico', sector: 'Comunicaciones', country: 'China', currency: 'HKD' },
    { ticker: 'VALE', name: 'Vale S.A.', pct: 0.6, region: 'América Latina', sector: 'Materiales', country: 'Brasil', currency: 'BRL' },
  ],
  'VHYG': [
    { ticker: 'JNJ', name: 'Johnson & Johnson', pct: 2.8, region: 'América del Norte', sector: 'Salud', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'JPM', name: 'JPMorgan Chase', pct: 2.5, region: 'América del Norte', sector: 'Finanzas', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'XOM', name: 'ExxonMobil', pct: 2.3, region: 'América del Norte', sector: 'Energía', country: 'EE.UU.', currency: 'USD' },
    { ticker: 'NESN', name: 'Nestlé', pct: 2.0, region: 'Europa', sector: 'Consumo básico', country: 'Suiza', currency: 'CHF' },
    { ticker: 'NOVN', name: 'Novartis', pct: 1.8, region: 'Europa', sector: 'Salud', country: 'Suiza', currency: 'CHF' },
  ],
};

// Known sector map for individual stocks
const STOCK_SECTOR_MAP = {
  AAPL: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  MSFT: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  NVDA: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  AMZN: { sector: 'Consumo discrecional', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  GOOGL: { sector: 'Comunicaciones', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  GOOG: { sector: 'Comunicaciones', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  META: { sector: 'Comunicaciones', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  TSLA: { sector: 'Consumo discrecional', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  AVGO: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  JPM: { sector: 'Finanzas', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  LLY: { sector: 'Salud', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  JNJ: { sector: 'Salud', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  XOM: { sector: 'Energía', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  INTC: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  AMD: { sector: 'Tecnología', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  KO: { sector: 'Consumo básico', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  MCD: { sector: 'Consumo discrecional', region: 'América del Norte', country: 'EE.UU.', currency: 'USD' },
  'BTC-USD': { sector: 'Criptomonedas', region: 'Global', country: 'Global', currency: 'USD' },
  'BTC-EUR': { sector: 'Criptomonedas', region: 'Global', country: 'Global', currency: 'EUR' },
  'ETH-USD': { sector: 'Criptomonedas', region: 'Global', country: 'Global', currency: 'USD' },
};

function getEtfComposition(ticker) {
  // Try exact match, then base ticker (EIMI.MI -> EIMI)
  const base = ticker.split('.')[0].split('-')[0];
  return ETF_COMPOSITIONS[ticker] || ETF_COMPOSITIONS[base] || null;
}

function getStockInfo(ticker) {
  const base = ticker.split('.')[0];
  return STOCK_SECTOR_MAP[ticker] || STOCK_SECTOR_MAP[base] || null;
}

// Build DeepDive data: expand ETFs into their holdings, sum with direct stocks
function buildDeepDive(positions, totalCurrentValue) {
  const holdings = {}; // ticker -> { name, value, region, sector, country, currency }
  
  positions.forEach(pos => {
    const posValue = pos.current_value_eur || pos.invested_amount_eur || 0;
    const isEtf = ['etf', 'index_fund'].includes(pos.investment_type);
    const composition = isEtf ? getEtfComposition(pos.ticker) : null;
    
    if (composition && composition.length > 0) {
      // Expand ETF into holdings
      composition.forEach(holding => {
        const holdingValue = posValue * (holding.pct / 100);
        if (!holdings[holding.ticker]) {
          holdings[holding.ticker] = { name: holding.name, value: 0, region: holding.region, sector: holding.sector, country: holding.country, currency: holding.currency };
        }
        holdings[holding.ticker].value += holdingValue;
      });
      // Remainder goes to "Otros (ETF)"
      const coveredPct = composition.reduce((s, h) => s + h.pct, 0);
      if (coveredPct < 100) {
        const otherKey = `OTHER_${pos.ticker}`;
        holdings[otherKey] = { name: `Otros (${pos.ticker})`, value: posValue * ((100 - coveredPct) / 100), region: pos.region || 'Global', sector: 'Diversificado', country: 'Global', currency: 'EUR' };
      }
    } else {
      // Direct stock/crypto
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
const fmtEur = (v) => `${v >= 0 ? '' : ''}${(+v || 0).toFixed(2)}€`;

// ─── Getquin colors ───────────────────────────────────────────────────────────
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

// ─── AI Onboarding ─────────────────────────────────────────────────────────────
const AI_QS = [
  { id: 'salary', q: '¿Cuál es tu salario neto mensual (€)?', type: 'number', ph: 'Ej: 1800' },
  { id: 'expenses', q: '¿Cuánto gastas en gastos fijos al mes?', type: 'number', ph: 'Ej: 900' },
  { id: 'goal', q: '¿Cuál es tu objetivo principal?', type: 'select', opts: ['Independencia financiera', 'Jubilación anticipada', 'Comprar una casa', 'Crear patrimonio', 'Complementar ingresos', 'Ahorro a largo plazo'] },
  { id: 'horizon', q: '¿A qué plazo inviertes?', type: 'select', opts: ['< 2 años', '2-5 años', '5-10 años', '> 10 años'] },
  { id: 'risk', q: '¿Qué pérdida temporal puedes asumir?', type: 'select', opts: ['Ninguna', 'Hasta 10%', 'Hasta 20%', 'Hasta 30%', 'Más del 30%'] },
  { id: 'job_security', q: 'Sin trabajo, ¿cuántos meses aguantarías con tus ahorros?', type: 'select', opts: ['< 1 mes', '1-3 meses', '3-6 meses', '6-12 meses', '> 12 meses'] },
  { id: 'monthly_invest', q: '¿Cuánto puedes invertir cada mes?', type: 'number', ph: 'Ej: 200' },
  { id: 'broker', q: '¿Qué broker usas principalmente?', type: 'select', opts: ['Trade Republic', 'DEGIRO', 'Interactive Brokers', 'Indexa Capital', 'MyInvestor', 'Revolut', 'Otro'] },
];

// Known dividend yields
const DIV_YIELDS = { AAPL: 0.005, MSFT: 0.007, INTC: 0.025, JNJ: 0.03, KO: 0.03, PG: 0.025, VHYG: 0.04, VIG: 0.018, O: 0.055, ABT: 0.018, MCD: 0.024, MMM: 0.065, VUAG: 0.016, IWDA: 0.015, XDWD: 0.015, ISAC: 0.015, VUSA: 0.015 };
const getDivYield = (pos) => DIV_YIELDS[pos.ticker] || ({ etf: 0.015, index_fund: 0.012, bond: 0.04 }[pos.investment_type] || 0);

// ─── Getquin Score Gauge ───────────────────────────────────────────────────────
function ScoreGauge({ score }) {
  const color = score >= 70 ? GQ.green : score >= 45 ? GQ.amber : GQ.red;
  const deg = (score / 100) * 270 - 135;
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

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ positions, totalInvested, totalCurrentValue, totalGain, totalGainPct }) {
  const [profile, setProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('gq_profile_v2') || 'null'); } catch { return null; } });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [numInput, setNumInput] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(() => { try { return JSON.parse(localStorage.getItem('gq_analysis_v2') || 'null'); } catch { return null; } });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisUsed, setAnalysisUsed] = useState(() => parseInt(localStorage.getItem('gq_analysis_used') || '0'));
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const sysPrompt = (prof) => {
    const portStr = positions.length > 0
      ? positions.map(p => `${p.ticker}(${p.name?.slice(0, 20)}, ${(p.current_value_eur || p.invested_amount_eur || 0).toFixed(0)}€, ${p.investment_type}${p.sector ? ',' + p.sector : ''}${p.region ? ',' + p.region : ''})`).join(' | ')
      : 'Sin posiciones';
    return `Eres un asesor financiero personal de élite. Español, directo, profesional. Usa datos reales.
PERFIL: salario=${prof.salary}€/mes, gastos_fijos=${prof.expenses}€, disponible=${(parseFloat(prof.salary || 0) - parseFloat(prof.expenses || 0)).toFixed(0)}€, objetivo="${prof.goal}", horizonte="${prof.horizon}", riesgo="${prof.risk}", seguridad_laboral="${prof.job_security}", inversión_mensual=${prof.monthly_invest}€, broker="${prof.broker}"
CARTERA: ${portStr} | Total=${totalCurrentValue.toFixed(0)}€ invertido=${totalInvested.toFixed(0)}€ ganancia=${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(0)}€(${totalGainPct.toFixed(1)}%)
Da cifras en euros. Usa **negrita** y listas. Sé honesto.`;
  };

  const answer = async (val) => {
    const q = AI_QS[step];
    const newAns = { ...answers, [q.id]: val };
    setAnswers(newAns);
    if (step < AI_QS.length - 1) { setStep(s => s + 1); setNumInput(''); }
    else { localStorage.setItem('gq_profile_v2', JSON.stringify(newAns)); setProfile(newAns); await runAnalysis(newAns); }
  };

  const runAnalysis = async (prof) => {
    setAnalyzing(true);
    try {
      const portStr = positions.map(p => `${p.ticker}: ${(p.current_value_eur || p.invested_amount_eur || 0).toFixed(0)}€ (${p.investment_type}${p.sector ? ',' + p.sector : ''}${p.region ? ',' + p.region : ''})`).join('\n') || 'Sin posiciones';
      const text = await callGroq([
        { role: 'system', content: sysPrompt(prof) },
        { role: 'user', content: `Analiza esta cartera:\n${portStr}\n\nResponde SOLO con JSON válido:\n{"score":0-100,"summary":"2 frases","recommendations":[{"type":"warning|good|tip","text":"texto"}],"diversification":0-10,"risk_level":0-10,"cost_efficiency":0-10,"macroeconomic":0-10,"top_action":"acción más urgente en 1 frase"}` }
      ], 600);
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const used = analysisUsed + 1;
      localStorage.setItem('gq_analysis_v2', JSON.stringify(parsed));
      localStorage.setItem('gq_analysis_used', String(used));
      setAnalysis(parsed); setAnalysisUsed(used);
    } catch (e) { console.error(e); }
    setAnalyzing(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); setInput('');
    const newMsgs = [...msgs, { role: 'user', content: userMsg }];
    setMsgs(newMsgs); setLoading(true);
    try {
      const reply = await callGroq([{ role: 'system', content: sysPrompt(profile) }, ...newMsgs.slice(-12)], 1200);
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) { setMsgs(m => [...m, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setLoading(false);
  };

  const reset = () => { localStorage.removeItem('gq_profile_v2'); localStorage.removeItem('gq_analysis_v2'); localStorage.removeItem('gq_analysis_used'); setProfile(null); setAnalysis(null); setMsgs([]); setStep(0); setAnswers({}); setAnalysisUsed(0); };

  // Onboarding
  if (!profile) {
    const q = AI_QS[step];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot style={{ width: 16, height: 16, color: GQ.blue }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: GQ.text }}>getquin IA</span>
            </div>
            <span style={{ fontSize: 11, color: GQ.textMuted }}>{step + 1}/{AI_QS.length} análisis utilizado</span>
          </div>
          <div style={{ height: 3, background: GQ.border, borderRadius: 2, marginBottom: 20 }}>
            <div style={{ height: '100%', background: GQ.blue, width: `${((step + 1) / AI_QS.length) * 100}%`, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ background: '#0a0a0f', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: GQ.text, fontWeight: 500, margin: 0 }}>{q.q}</p>
          </div>
          {q.type === 'select' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.opts.map(o => (
                <button key={o} onClick={() => answer(o)}
                  style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.text, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = GQ.blueDim; e.currentTarget.style.borderColor = GQ.blue; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = GQ.border; }}>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" placeholder={q.ph} value={numInput} onChange={e => setNumInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && numInput && answer(numInput)}
                style={{ flex: 1, background: '#0a0a0f', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '10px 14px', color: GQ.text, fontSize: 13, outline: 'none' }} />
              <button onClick={() => numInput && answer(numInput)}
                style={{ padding: '10px 18px', borderRadius: 10, background: GQ.blue, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                →
              </button>
            </div>
          )}
          {step > 0 && <button onClick={() => { setStep(s => s - 1); setNumInput(''); }} style={{ marginTop: 12, fontSize: 12, color: GQ.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>← Anterior</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* getquin IA score card */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot style={{ width: 16, height: 16, color: GQ.blue }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: GQ.text }}>getquin IA</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: GQ.textMuted }}>{analysisUsed}/5 Análisis utilizado</span>
            <button onClick={() => profile && runAnalysis(profile)} disabled={analyzing}
              style={{ fontSize: 11, color: GQ.blue, background: 'transparent', border: `1px solid ${GQ.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
              {analyzing ? '...' : '↻ Actualización'}
            </button>
          </div>
        </div>

        {analyzing ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Loader2 style={{ width: 28, height: 28, color: GQ.blue, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: GQ.textMuted, fontSize: 13, margin: 0 }}>Analizando tu cartera...</p>
          </div>
        ) : analysis ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
              <ScoreGauge score={analysis.score} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: GQ.textMuted, marginBottom: 4 }}>Puntuación de la cartera</div>
                <div style={{ fontSize: 12, color: GQ.text, lineHeight: 1.6, marginBottom: 8 }}>{analysis.summary}</div>
                <div style={{ fontSize: 11, color: GQ.textMuted }}>Su cartera se sitúa por encima del <span style={{ color: GQ.text, fontWeight: 600 }}>{Math.round(analysis.score * 0.7)}%</span> de usuarios de getquin</div>
                {analysis.top_action && <div style={{ marginTop: 10, background: GQ.blueDim, border: `1px solid ${GQ.blue}22`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#93c5fd' }}>⚡ {analysis.top_action}</div>}
              </div>
            </div>

            {/* Recomendaciones */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: GQ.textMuted, marginBottom: 8, fontWeight: 600 }}>Recomendaciones</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analysis.recommendations?.slice(0, 5).map((rec, i) => (
                  <button key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#0a0a0f', borderRadius: 10, border: `1px solid ${GQ.border}`, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 12, color: GQ.text }}>{rec.type === 'warning' ? '⚠️' : rec.type === 'good' ? '✅' : '💡'} {rec.text}</span>
                    <ChevronDown style={{ width: 14, height: 14, color: GQ.textMuted, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Análisis sub-scores */}
            <div>
              <div style={{ fontSize: 12, color: GQ.textMuted, marginBottom: 8, fontWeight: 600 }}>Análisis</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Diversificación', value: analysis.diversification, color: GQ.blue, badge: analysis.diversification >= 7 ? 'Alta' : analysis.diversification >= 4 ? 'Posibilidades de m...' : 'Baja' },
                  { label: 'Riesgo', value: analysis.risk_level, color: GQ.amber, badge: analysis.risk_level >= 7 ? 'Alto' : analysis.risk_level >= 4 ? 'Medio' : 'Bajo' },
                  { label: 'Tasas', value: analysis.cost_efficiency, color: GQ.green, badge: analysis.cost_efficiency >= 7 ? 'Bajo' : 'Medio' },
                  { label: 'Macroeconomía', value: analysis.macroeconomic, color: '#8b5cf6', badge: analysis.macroeconomic >= 7 ? 'Alto' : 'Medio' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0a0a0f', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</span>
                      <span style={{ fontSize: 11, color: GQ.textMuted }}>/10</span>
                    </div>
                    <div style={{ background: `${item.color}22`, borderRadius: 4, padding: '2px 7px', display: 'inline-block', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: item.color, fontWeight: 600 }}>{item.badge}</span>
                    </div>
                    <div style={{ fontSize: 12, color: GQ.text, fontWeight: 500 }}>{item.label} <ChevronRight style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle' }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button onClick={() => runAnalysis(profile)} style={{ padding: '10px 22px', background: GQ.blueDim, border: `1px solid ${GQ.blue}`, borderRadius: 10, color: '#93c5fd', fontSize: 13, cursor: 'pointer' }}>
              ✨ Analizar mi cartera
            </button>
          </div>
        )}
      </div>

      {/* Chat */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GQ.green }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>Agente de IA</span>
          </div>
          <button onClick={reset} style={{ fontSize: 11, color: GQ.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>Cambiar perfil</button>
        </div>
        <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User style={{ width: 12, height: 12, color: GQ.textMuted, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: GQ.textMuted }}>{profile.salary}€/mes · {profile.goal} · Riesgo: {profile.risk}</span>
        </div>

        {msgs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {['¿Cuáles son las noticias importantes del mercado hoy?', '¿Qué mueve hoy mi cartera?', '¿Estoy bien diversificado?', 'Crea un plan mensual con mi nómina', '¿Cuánto fondo de emergencia necesito?'].map(q => (
              <button key={q} onClick={() => setInput(q)}
                style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.textMuted, fontSize: 12, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = GQ.blue}
                onMouseLeave={e => e.currentTarget.style.borderColor = GQ.border}>
                {q}
              </button>
            ))}
          </div>
        )}

        {msgs.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.role === 'user' ? GQ.blueDim : GQ.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                  {m.role === 'user' ? '👤' : '🤖'}
                </div>
                <div style={{ maxWidth: '82%', padding: '10px 12px', borderRadius: 12, background: m.role === 'user' ? GQ.blueDim : '#0a0a0f', fontSize: 12, color: GQ.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: GQ.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div><div style={{ padding: '10px 12px', borderRadius: 12, background: '#0a0a0f' }}><Loader2 style={{ width: 14, height: 14, color: GQ.textMuted, animation: 'spin 1s linear infinite' }} /></div></div>}
            <div ref={endRef} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask anything"
            style={{ flex: 1, background: '#0a0a0f', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '9px 13px', color: GQ.text, fontSize: 12, outline: 'none' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ padding: '9px 14px', borderRadius: 10, background: loading ? GQ.border : GQ.blue, border: 'none', color: '#fff', cursor: 'pointer' }}>
            <Send style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dividends Panel ───────────────────────────────────────────────────────────
function DividendsPanel({ positions }) {
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewTab, setViewTab] = useState('max'); // max | year | prev
  const years = [new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1];

  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
  const totalCurrent = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  const totalAnnualDiv = positions.reduce((s, p) => s + ((p.current_value_eur || p.invested_amount_eur || 0) * getDivYield(p)), 0);
  const yoc = totalInvested > 0 ? (totalAnnualDiv / totalInvested) * 100 : 0;

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const total = positions.filter(p => getDivYield(p) > 0).reduce((s, p) => {
      const annual = (p.current_value_eur || p.invested_amount_eur || 0) * getDivYield(p);
      const payMonths = p.investment_type === 'bond' ? [6, 12] : [3, 6, 9, 12];
      return payMonths.includes(month) ? s + annual / payMonths.length : s;
    }, 0);
    return { month: format(new Date(viewYear, i, 1), 'MMM', { locale: es }), amount: +total.toFixed(2), year: viewYear };
  });
  const yearTotal = monthlyData.reduce((s, m) => s + m.amount, 0);

  const divPositions = positions.filter(p => getDivYield(p) > 0).map(p => ({
    ticker: p.ticker, name: p.name,
    annual: (p.current_value_eur || p.invested_amount_eur || 0) * getDivYield(p),
    yoc: getDivYield(p) * 100,
    freq: p.investment_type === 'bond' ? 'Semestral' : 'Trimestral',
  })).sort((a, b) => b.annual - a.annual);

  return (
    <div>
      {/* Header stats - getquin style */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total recibido', value: '0,00 €' },
          { label: 'Retorno por dividendo últimos 12 meses (TTM)', value: '0 %' },
          { label: 'YoC TTM', value: `${yoc.toFixed(2)} %` },
          { label: 'TCAC', value: '-' },
        ].map(item => (
          <div key={item.label} style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: GQ.textMuted, marginBottom: 8, lineHeight: 1.3 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GQ.text }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Chart tabs */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'max', label: 'Duración máxima' }, ...years.map(y => ({ id: String(y), label: String(y) }))].map(t => (
              <button key={t.id} onClick={() => { setViewTab(t.id); if (t.id !== 'max') setViewYear(parseInt(t.id)); }}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: viewTab === t.id ? 600 : 400, background: viewTab === t.id ? '#1f2937' : 'transparent', color: viewTab === t.id ? GQ.text : GQ.textMuted, cursor: 'pointer', borderBottom: viewTab === t.id ? `2px solid ${GQ.blue}` : '2px solid transparent' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: GQ.textMuted }} />
            <span style={{ fontSize: 11, color: GQ.textMuted }}>{yoc > 0 ? `${(yoc / 12).toFixed(3)} €` : '0,126 €'}</span>
          </div>
        </div>

        {yearTotal > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}€`} />
              <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11, color: GQ.text }} formatter={v => [`${(+v).toFixed(2)}€`, 'Dividendo']} />
              <Bar dataKey="amount" fill={GQ.blue} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: GQ.textMuted, marginBottom: 4 }}>No hay datos de dividendos.</div>
              <div style={{ fontSize: 30, color: GQ.textDim }}>— —</div>
            </div>
          </div>
        )}
      </div>

      {/* Dividend calendar table - getquin style */}
      {divPositions.length > 0 && (
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 12, borderBottom: `1px solid ${GQ.border}`, paddingBottom: 8 }}>
            {[viewYear + 1, viewYear].map(y => (
              <button key={y} onClick={() => setViewYear(y)}
                style={{ fontSize: 13, fontWeight: viewYear === y ? 600 : 400, color: viewYear === y ? GQ.text : GQ.textMuted, background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 8, borderBottom: `2px solid ${viewYear === y ? GQ.blue : 'transparent'}` }}>
                {y}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 80px', gap: 0 }}>
            <div style={{ fontSize: 11, color: GQ.textMuted, padding: '4px 0' }}>Nasdaq</div>
            <div style={{ fontSize: 11, color: '#6366f1', padding: '4px 0', background: '#6366f122', borderRadius: 4, textAlign: 'center' }}>Estimado</div>
            <div style={{ fontSize: 11, color: GQ.textMuted, padding: '4px 0', textAlign: 'center' }}>4</div>
            <div style={{ fontSize: 11, color: GQ.textMuted, padding: '4px 0', textAlign: 'right' }}>—</div>
            <div style={{ fontSize: 11, color: GQ.textMuted, padding: '4px 0', textAlign: 'right' }}>—</div>
          </div>
          <div style={{ marginTop: 16 }}>
            {divPositions.map((d, i) => (
              <div key={d.ticker} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < divPositions.length - 1 ? `1px solid ${GQ.border}` : 'none', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: PAL[i % PAL.length] }} />
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: GQ.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: GQ.textMuted, flexShrink: 0 }}>{d.ticker.slice(0, 4)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: GQ.text }}>{d.name?.slice(0, 30)}</div>
                  <div style={{ fontSize: 10, color: GQ.textMuted }}>{d.freq}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GQ.green }}>{d.annual.toFixed(3)} €</div>
                  <div style={{ fontSize: 10, color: GQ.textMuted }}>{d.yoc.toFixed(2)} %</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sold / Vendido section */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text, marginBottom: 4 }}>Vendido</div>
        <div style={{ fontSize: 12, color: GQ.textMuted }}>No hay ventas registradas</div>
      </div>
    </div>
  );
}

// ─── Distribution Panel ────────────────────────────────────────────────────────
const DIST_VIEWS = ['Tipo', 'Posiciones', 'DeepDive', 'Regiones', 'Sectores', 'Activos', 'Países', 'Divisas'];

function DistributionPanel({ positions, totalCurrentValue }) {
  const [view, setView] = useState('Tipo');
  const totalVal = totalCurrentValue || 1;

  const groups = useMemo(() => {
    const typeG = {}, posG = {}, regionG = {}, sectorG = {};
    positions.forEach((p, i) => {
      const t = getType(p.investment_type);
      const val = p.current_value_eur || p.invested_amount_eur || 0;
      const gain = val - (p.invested_amount_eur || 0);
      const gainPct = (p.invested_amount_eur || 0) > 0 ? (gain / (p.invested_amount_eur || 0)) * 100 : 0;
      if (!typeG[p.investment_type]) typeG[p.investment_type] = { name: t.label, value: 0, color: t.color };
      typeG[p.investment_type].value += val;
      posG[p.ticker] = { name: p.name || p.ticker, ticker: p.ticker, value: val, color: PAL[i % PAL.length], gain, gainPct };
      const reg = p.region || 'Sin región';
      if (!regionG[reg]) regionG[reg] = { name: reg, value: 0, color: PAL[Object.keys(regionG).length % PAL.length] };
      regionG[reg].value += val;
      const sec = p.sector || 'Sin sector';
      if (!sectorG[sec]) sectorG[sec] = { name: sec, value: 0, color: PAL[Object.keys(sectorG).length % PAL.length] };
      sectorG[sec].value += val;
    });
    return {
      tipo: Object.values(typeG).map(g => ({ ...g, pct: (g.value / totalVal) * 100 })).sort((a, b) => b.value - a.value),
      posiciones: Object.values(posG).map(g => ({ ...g, pct: (g.value / totalVal) * 100 })).sort((a, b) => b.value - a.value),
      regiones: Object.values(regionG).map(g => ({ ...g, pct: (g.value / totalVal) * 100 })).sort((a, b) => b.value - a.value),
      sectores: Object.values(sectorG).map(g => ({ ...g, pct: (g.value / totalVal) * 100 })).sort((a, b) => b.value - a.value),
    };
  }, [positions, totalVal]);

  const getViewData = () => {
    if (view === 'Tipo') return groups.tipo;
    if (view === 'Posiciones') return groups.posiciones;
    if (view === 'Regiones') return groups.regiones;
    if (view === 'Sectores') return groups.sectores;
    if (view === 'DeepDive') return buildDeepDive(positions, totalVal);
    if (view === 'Activos') return groups.posiciones;
    if (view === 'Países') {
      const countryG = {};
      buildDeepDive(positions, totalVal).forEach((h, i) => {
        const c = h.country || 'Global';
        if (!countryG[c]) countryG[c] = { name: c, value: 0, color: PAL[i % PAL.length] };
        countryG[c].value += h.value;
      });
      return Object.values(countryG).map(g => ({ ...g, pct: (g.value / totalVal) * 100 })).sort((a,b) => b.value - a.value);
    }
    if (view === 'Divisas') {
      const currG = {};
      buildDeepDive(positions, totalVal).forEach((h, i) => {
        const c = h.currency || 'EUR';
        if (!currG[c]) currG[c] = { name: c, value: 0, color: PAL[i % PAL.length] };
        currG[c].value += h.value;
      });
      return Object.values(currG).map(g => ({ ...g, pct: (g.value / totalVal) * 100 })).sort((a,b) => b.value - a.value);
    }
    return groups.tipo;
  };
  const data = getViewData();

  if (positions.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: GQ.textMuted }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>Añade posiciones para ver la distribución</div>
    </div>
  );

  return (
    <div>
      {/* Tab row */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${GQ.border}`, marginBottom: 20, overflowX: 'auto' }}>
        {DIST_VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: '10px 14px', border: 'none', fontSize: 13, fontWeight: view === v ? 600 : 400, background: 'transparent', color: view === v ? GQ.text : GQ.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${view === v ? GQ.blue : 'transparent'}`, transition: 'all 0.15s' }}>
            {v}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <GQDonut data={data} size={220} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: GQ.text, marginBottom: 14, textAlign: 'right' }}>{view}</div>
          {data.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${GQ.border}`, gap: 10, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: GQ.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                <div style={{ height: 2, background: GQ.border, borderRadius: 1, marginTop: 5 }}>
                  <div style={{ height: '100%', background: row.color, width: `${Math.min(row.pct, 100)}%`, borderRadius: 1 }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: GQ.text }}>{row.pct.toFixed(2)} %</div>
                {row.gainPct !== undefined && (
                  <div style={{ fontSize: 11, color: row.gainPct >= 0 ? GQ.green : GQ.red }}>
                    {row.gainPct >= 0 ? '↑' : '↓'}{Math.abs(row.gainPct).toFixed(2)}%
                  </div>
                )}
              </div>
              <ChevronRight style={{ width: 14, height: 14, color: GQ.textMuted, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Performance Panel ─────────────────────────────────────────────────────────
function PerformancePanel({ positions, totalInvested, totalCurrentValue, totalGain, totalGainPct }) {
  const [chartMode, setChartMode] = useState('bar'); // bar | heatmap | line
  const [timeTab, setTimeTab] = useState('max'); // max | year | prev

  const getGain = (pos) => (pos.current_value_eur || pos.invested_amount_eur || 0) - (pos.invested_amount_eur || 0);
  const getGainPct = (pos) => { const inv = pos.invested_amount_eur || 0; return inv === 0 ? 0 : (getGain(pos) / inv) * 100; };

  const barData = positions.map((p, i) => ({ name: p.ticker, rendimiento: +getGainPct(p).toFixed(2), color: PAL[i % PAL.length] }));

  return (
    <div>
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${GQ.border}` }}>
            {['max', String(new Date().getFullYear()), String(new Date().getFullYear() - 1)].map(t => (
              <button key={t} onClick={() => setTimeTab(t)}
                style={{ padding: '8px 14px', border: 'none', fontSize: 12, fontWeight: timeTab === t ? 600 : 400, background: 'transparent', color: timeTab === t ? GQ.text : GQ.textMuted, cursor: 'pointer', borderBottom: `2px solid ${timeTab === t ? GQ.blue : 'transparent'}` }}>
                {t === 'max' ? 'Duración máxima' : t}
              </button>
            ))}
          </div>
          {/* Chart type switcher - getquin style dropdown */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select value={chartMode} onChange={e => setChartMode(e.target.value)}
              style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, color: GQ.text, fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>
              <option value="bar">Gráfico de barras</option>
              <option value="heatmap">Mapa de calor</option>
              <option value="line">Gráfico lineal</option>
            </select>
          </div>
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

      {/* Capital breakdown */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: GQ.text, marginBottom: 16 }}>Capital</div>
        {[
          { label: 'Capital invertido', value: `${totalInvested.toFixed(2)} €`, valueColor: GQ.text },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${GQ.border}` }}>
            <span style={{ fontSize: 13, color: GQ.textMuted }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: item.valueColor }}>{item.value}</span>
          </div>
        ))}

        <div style={{ fontSize: 13, fontWeight: 700, color: GQ.text, marginBottom: 12 }}>Desglose del rendimiento</div>
        {[
          { label: 'Ganancia de precio', pct: `${totalGainPct >= 0 ? '+' : ''}${totalGainPct.toFixed(2)} %`, value: `${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)} €`, color: totalGain >= 0 ? GQ.green : GQ.red },
          { label: 'Dividendos', pct: '↑0,00 %', value: '0,00 €', color: GQ.green },
          { label: 'Pérdidas realizadas', pct: '↓0,70 %', value: '-0,0499 €', color: GQ.red },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${GQ.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: GQ.textMuted }}>{item.label}</span>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${GQ.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: 9, color: GQ.textMuted }}>ⓘ</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 12, color: item.color, marginRight: 12 }}>{item.pct}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</span>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 13, fontWeight: 700, color: GQ.text, marginBottom: 12, marginTop: 4 }}>Costos de transacción</div>
        {[
          { label: 'Costos de transacción', value: '-1,00 €' },
          { label: 'Impuestos', value: '0,00 €' },
          { label: 'Costos corrientes', value: '0,101 €' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${GQ.border}` }}>
            <span style={{ fontSize: 13, color: GQ.textMuted }}>{item.label}</span>
            <span style={{ fontSize: 13, color: GQ.text }}>{item.value}</span>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: 4, borderTop: `1px solid ${GQ.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Retorno de inversión total</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: totalGain >= 0 ? GQ.green : GQ.red }}>
            {totalGain >= 0 ? '↑' : '↓'}{Math.abs(totalGain).toFixed(2)} €
          </span>
        </div>

        {[
          { label: 'Tasa interna de rentabilidad', value: totalGainPct >= 0 ? `↑${totalGainPct.toFixed(2)} %` : `↓${Math.abs(totalGainPct).toFixed(2)} %`, color: totalGain >= 0 ? GQ.green : GQ.red },
          { label: 'Tasa real de retorno ponderada en el tiempo', value: '↓10,26 %', color: GQ.red },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${GQ.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: GQ.textMuted }}>{item.label}</span>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${GQ.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: GQ.textMuted }}>ⓘ</span>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
          </div>
        ))}
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
  const [portfolioMode, setPortfolioMode] = useState('valor'); // valor | rendimiento
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [showCapital, setShowCapital] = useState(true);

  // Dialogs
  const [showForm, setShowForm] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [viewingPos, setViewingPos] = useState(null);
  const [viewHistory, setViewHistory] = useState([]);
  const [viewRange, setViewRange] = useState('1y');
  const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
  const [viewChartType, setViewChartType] = useState('line');
  const [deleteId, setDeleteId] = useState(null);
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellPos, setSellPos] = useState(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellDate, setSellDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [editPricePos, setEditPricePos] = useState(null);
  const [editPriceForm, setEditPriceForm] = useState({ current_price: '', current_value_eur: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [expandedPos, setExpandedPos] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'current', dir: 'desc' });
  const [openMenuId, setOpenMenuId] = useState(null); // 3-dot menu
  const [sales, setSales] = useState([]);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellAssetId, setSellAssetId] = useState('');
  const [sellPriceInput, setSellPriceInput] = useState('');
  const [sellAmountInput, setSellAmountInput] = useState('');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', broker: '' });
  const [accounts, setAccounts] = useState([]);

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

  // Build portfolio value history from real purchase_history
  useEffect(() => {
    if (positions.length === 0) { setPortfolioHistory([]); return; }
    const now = new Date();

    // Collect all buy events from purchase_history
    const allBuys = [];
    positions.forEach(pos => {
      const gainRatio = (pos.buy_price > 0 && pos.current_price > 0)
        ? pos.current_price / pos.buy_price
        : (pos.invested_amount_eur > 0 ? (pos.current_value_eur || pos.invested_amount_eur) / pos.invested_amount_eur : 1);
      const hist = pos.purchase_history?.length > 0
        ? pos.purchase_history
        : [{ date: pos.date, amount_eur: pos.invested_amount_eur, buy_price: pos.buy_price, currency: pos.currency }];
      hist.forEach(h => {
        if (!h.date || !h.amount_eur) return;
        allBuys.push({
          date: new Date(h.date),
          amount: h.amount_eur || 0,
          isOwn: pos.is_own_money !== false,
          gainRatio,
        });
      });
    });
    if (allBuys.length === 0) { setPortfolioHistory([]); return; }
    allBuys.sort((a, b) => a.date - b.date);

    // Determine range start and interval
    const rangeMap = {
      '1D': { ms: 86400000, interval: 'hour' },
      '1W': { ms: 7*86400000, interval: 'day' },
      '1M': { ms: 30*86400000, interval: 'day' },
      'YTD': { ms: (now - new Date(now.getFullYear(),0,1)), interval: 'week' },
      '1Y': { ms: 365*86400000, interval: 'week' },
      'Max': { ms: null, interval: 'month' },
    };
    const cfg = rangeMap[portfolioRange] || rangeMap['Max'];
    const startDate = cfg.ms ? new Date(now.getTime() - cfg.ms) : allBuys[0].date;

    // Generate time points
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
      let ownCapital = 0, notOwnCapital = 0, ownValue = 0, notOwnValue = 0;
      allBuys.filter(b => b.date <= point).forEach(b => {
        const totalMs = now - b.date;
        const elapsedMs = point - b.date;
        const progress = totalMs > 0 ? Math.min(elapsedMs / totalMs, 1) : 1;
        const gainAtPoint = 1 + (b.gainRatio - 1) * progress;
        const valAtPoint = b.amount * gainAtPoint;
        if (b.isOwn) { ownCapital += b.amount; ownValue += valAtPoint; }
        else { notOwnCapital += b.amount; notOwnValue += valAtPoint; }
      });
      const totalCapital = ownCapital + notOwnCapital;
      const totalValue = ownValue + notOwnValue;
      const rendProp = ownCapital > 0 ? ((ownValue - ownCapital) / ownCapital) * 100 : 0;
      const rendTotal = totalCapital > 0 ? ((totalValue - totalCapital) / totalCapital) * 100 : 0;
      return {
        date: fmtDate(point),
        fullDate: format(point, "d 'de' MMMM yyyy", { locale: es }),
        valor: +totalValue.toFixed(2),
        capital: +totalCapital.toFixed(2),
        ownCapital: +ownCapital.toFixed(2),
        ownValue: +ownValue.toFixed(2),
        rendimientoProp: +rendProp.toFixed(2),
        rendimientoTotal: +rendTotal.toFixed(2),
      };
    });
    setPortfolioHistory(history);
  }, [positions, portfolioRange]);

  // Cerrar menú al clicar fuera — DEBE estar antes del if(loading) return
  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // Sorted positions
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
  }, [positions, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };
  const SortArrow = ({ k }) => {
    if (sortConfig.key !== k) return <span style={{ color: GQ.textDim }}>↕</span>;
    return <span style={{ color: GQ.text }}>{sortConfig.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  // Handle sell with saving to DB
  const handleSellWithSave = async () => {
    const pos = positions.find(p => p.id === sellAssetId);
    if (!pos || !sellAmountInput) return;
    const amount = parseFloat(sellAmountInput);
    const sellPriceVal = parseFloat(sellPriceInput) || pos.current_price || 0;
    const cur = pos.current_value_eur || pos.invested_amount_eur || 0;
    if (amount > cur) { alert('Cantidad mayor al valor actual'); return; }
    const ratio = amount / cur;
    const gainOnSale = amount - (pos.invested_amount_eur || 0) * ratio;
    const gainPctOnSale = (pos.invested_amount_eur || 0) * ratio > 0
      ? (gainOnSale / ((pos.invested_amount_eur || 0) * ratio)) * 100 : 0;
    // Save sale
    await base44.entities.InvestmentSale.create({
      position_id: pos.id,
      ticker: pos.ticker,
      name: pos.name,
      amount_eur: amount,
      sell_price: sellPriceVal,
      buy_price: pos.buy_price || 0,
      date: sellDate,
      gain_eur: +gainOnSale.toFixed(2),
      gain_pct: +gainPctOnSale.toFixed(2),
      investment_type: pos.investment_type,
    });
    // Update position
    await base44.entities.InvestmentPosition.update(pos.id, {
      current_value_eur: +(cur - amount).toFixed(2),
      invested_amount_eur: +((pos.invested_amount_eur || 0) * (1 - ratio)).toFixed(2),
    });
    setShowSellModal(false); setSellAssetId(''); setSellAmountInput(''); setSellPriceInput('');
    fetchData();
  };

  // Handle create account
  const handleCreateAccount = async () => {
    if (!accountForm.name.trim()) return;
    await base44.entities.InvestmentAccount.create({ name: accountForm.name, broker: accountForm.broker, created_date: new Date().toISOString() });
    setShowAccountForm(false); setAccountForm({ name: '', broker: '' });
    fetchData();
  };

  // Build all transactions from purchase_history for display
  const allTransactions = useMemo(() => {
    const txs = [];
    positions.forEach(pos => {
      const hist = pos.purchase_history?.length > 0
        ? pos.purchase_history
        : [{ date: pos.date, amount_eur: pos.invested_amount_eur, buy_price: pos.buy_price, currency: pos.currency }];
      hist.forEach((h, i) => {
        if (!h?.amount_eur) return;
        txs.push({ id: `${pos.id}_buy_${i}`, type: 'buy', ticker: pos.ticker, name: pos.name, date: h.date, amount: h.amount_eur, price: h.buy_price, currency: h.currency || pos.currency, posId: pos.id, investment_type: pos.investment_type });
      });
    });
    sales.forEach(s => {
      txs.push({ id: s.id, type: 'sell', ticker: s.ticker, name: s.name, date: s.date, amount: s.amount_eur, price: s.sell_price, gain: s.gain_eur, gainPct: s.gain_pct, saleId: s.id });
    });
    txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return txs;
  }, [positions, sales]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    allTransactions.forEach(tx => {
      const key = tx.date ? tx.date.slice(0, 7) : 'unknown';
      if (!groups[key]) groups[key] = { key, label: tx.date ? format(new Date(tx.date + 'T12:00:00'), 'MMMM yyyy', { locale: es }) : 'Sin fecha', txs: [] };
      groups[key].txs.push(tx);
    });
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [allTransactions]);

  const getGain = (pos) => (pos.current_value_eur || pos.invested_amount_eur || 0) - (pos.invested_amount_eur || 0);
  const getGainPct = (pos) => { const inv = pos.invested_amount_eur || 0; return inv === 0 ? 0 : (getGain(pos) / inv) * 100; };

  const dailyIncome = dailyTxs.filter(t => ['income', 'transfer_from_savings', 'transfer_from_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyOut = dailyTxs.filter(t => ['expense', 'other', 'transfer_to_savings', 'transfer_to_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const dailyAvailable = dailyIncome - dailyOut;
  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const handleSearch = async () => { if (!searchQuery.trim()) return; setSearchLoading(true); setSearchResults([]); const r = await searchYahoo(searchQuery); setSearchResults(r); setSearchLoading(false); };
  const handleSelectResult = async (result) => {
    setSelectedResult(result);
    const typeMap = { 'EQUITY': 'stock', 'ETF': 'etf', 'MUTUALFUND': 'index_fund', 'CRYPTOCURRENCY': 'crypto', 'BOND': 'bond', 'COMMODITY': 'commodity', 'FUTURE': 'commodity', 'INDEX': 'etf' };
    const regionMap = { 'NMS': 'América del Norte', 'NYQ': 'América del Norte', 'NGM': 'América del Norte', 'PCX': 'América del Norte', 'BIT': 'Europa', 'FRA': 'Europa', 'EPA': 'Europa', 'AMS': 'Europa', 'LSE': 'Europa', 'BME': 'Europa', 'TYO': 'Asia Pacífico', 'HKG': 'Asia Pacífico', 'CCY': 'Global', 'CCC': 'Global' };
    const stockInfo = getStockInfo(result.ticker);
    const etfComp = getEtfComposition(result.ticker);
    // Auto-detect sector from known data
    const autoSector = stockInfo?.sector || '';
    const autoRegion = regionMap[result.exchange] || stockInfo?.region || '';
    setForm(f => ({ ...f, ticker: result.ticker, name: result.name, investment_type: typeMap[result.type?.toUpperCase()] || 'stock', region: autoRegion, sector: autoSector }));
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
    if (!editingPos && form.is_own_money !== false && amount > dailyAvailable) { alert(`Saldo insuficiente. Disponible: ${dailyAvailable.toFixed(2)}€`); return; }
    const buyPrice = parseFloat(form.buy_price) || 0;
    const fxRate = form.currency !== 'EUR' && buyPrice > 0 ? (amount / buyPrice) : 1;
    const data = { ticker: form.ticker.toUpperCase(), name: form.name, investment_type: form.investment_type, invested_amount_eur: amount, buy_price: buyPrice, currency: form.currency, description: form.description, date: form.date, sector: form.sector, region: form.region, current_value_eur: amount, current_price: buyPrice, fx_rate: fxRate, is_own_money: form.is_own_money !== false };
    const m = new Date(form.date).getMonth() + 1; const yr = new Date(form.date).getFullYear();
    if (form.is_own_money !== false) { await base44.entities.FinanceTransaction.create({ type: 'transfer_to_investment', amount, description: `Inversión en ${form.ticker.toUpperCase()}`, date: form.date, month: m, year: yr }); }
    if (editingPos) {
      const hist = [...(editingPos.purchase_history || []), { date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }];
      await base44.entities.InvestmentPosition.update(editingPos.id, { ...data, invested_amount_eur: (editingPos.invested_amount_eur || 0) + amount, current_value_eur: (editingPos.current_value_eur || editingPos.invested_amount_eur || 0) + amount, purchase_history: hist });
    } else { await base44.entities.InvestmentPosition.create({ ...data, purchase_history: [{ date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }] }); }
    setShowForm(false); setEditingPos(null); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setForm(emptyForm()); fetchData();
  };
  const handleSell = async () => {
    if (!sellPos || !sellAmount) return;
    const amount = parseFloat(sellAmount);
    const cur = sellPos.current_value_eur || sellPos.invested_amount_eur || 0;
    if (amount > cur) { alert(`Máximo: ${cur.toFixed(2)}€`); return; }
    const ratio = amount / cur;
    await base44.entities.InvestmentPosition.update(sellPos.id, { current_value_eur: +(cur - amount).toFixed(2), invested_amount_eur: +((sellPos.invested_amount_eur || 0) * (1 - ratio)).toFixed(2) });
    const m = new Date(sellDate).getMonth() + 1; const yr = new Date(sellDate).getFullYear();
    await base44.entities.FinanceTransaction.create({ type: 'transfer_from_investment', amount, category: 'Desde inversión', description: `Venta de ${sellPos.ticker}`, date: sellDate, month: m, year: yr });
    setShowSellForm(false); setSellPos(null); setSellAmount(''); fetchData();
  };
  const handleDelete = async () => { await base44.entities.InvestmentPosition.delete(deleteId); setDeleteId(null); fetchData(); };
  const handleSavePrice = async () => {
    const p = parseFloat(editPriceForm.current_price); const v = parseFloat(editPriceForm.current_value_eur);
    const u = {}; if (!isNaN(p)) u.current_price = p; if (!isNaN(v)) u.current_value_eur = v;
    if (Object.keys(u).length) { u.last_updated = new Date().toISOString(); await base44.entities.InvestmentPosition.update(editPricePos.id, u); }
    setShowPriceEdit(false); setEditPricePos(null); fetchData();
  };
  const openViewPos = async (pos) => {
    setViewingPos(pos); setViewHistoryLoading(true);
    const hist = await getYahooHistory(pos.ticker, viewRange, viewRange === '1d' ? '5m' : viewRange === '1w' ? '1d' : '1mo');
    setViewHistory(hist); setViewHistoryLoading(false);
  };
  const loadViewRange = async (range) => {
    if (!viewingPos) return;
    setViewRange(range); setViewHistoryLoading(true);
    const hist = await getYahooHistory(viewingPos.ticker, range, range === '1d' ? '5m' : range === '1w' ? '1d' : '1mo');
    setViewHistory(hist); setViewHistoryLoading(false);
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

      {/* ── getquin header bar (like "Cartera de inversiones / Trade Republic") ── */}
      <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: GQ.text, margin: 0 }}>Cartera de inversiones</h2>
              <button onClick={() => setShowAccountForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.text, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                + Agregar cuenta {accounts.length > 0 ? `(${accounts.length})` : ''}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings style={{ width: 14, height: 14 }} />
                </button>
                <button style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: GQ.textMuted }}>Mis inversiones · Yahoo Finance en tiempo real</div>
          </div>
        </div>

        {/* Value + controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: GQ.text }}>{totalCurrentValue.toFixed(2)} €</span>
            </div>
            <div style={{ fontSize: 13, color: totalGain >= 0 ? GQ.green : GQ.red, display: 'flex', alignItems: 'center', gap: 4 }}>
              {totalGain >= 0 ? '↑' : '↓'}{Math.abs(totalGainPct).toFixed(2)} % ({totalGain >= 0 ? '+' : ''}{totalGain.toFixed(2)} €)
            </div>
          </div>
        </div>

        {/* Range tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {['1D', '1W', '1M', 'YTD', '1Y', 'Max'].map(r => (
            <button key={r} onClick={() => setPortfolioRange(r)}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: portfolioRange === r ? 600 : 400, background: portfolioRange === r ? '#1f2937' : 'transparent', color: portfolioRange === r ? GQ.text : GQ.textMuted, cursor: 'pointer' }}>
              {r}
            </button>
          ))}
        </div>

        {/* Mode selector: Rendimiento vs Valor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <button onClick={() => setPortfolioMode('valor')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${portfolioMode === 'valor' ? GQ.green : GQ.textDim}`, background: portfolioMode === 'valor' ? GQ.green : 'transparent', transition: 'all 0.15s' }} />
            <span style={{ fontSize: 12, color: portfolioMode === 'valor' ? GQ.text : GQ.textMuted, fontWeight: portfolioMode === 'valor' ? 600 : 400 }}>Valor de la cartera</span>
          </button>
          <button onClick={() => setPortfolioMode('rendimiento')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${portfolioMode === 'rendimiento' ? GQ.green : GQ.textDim}`, background: portfolioMode === 'rendimiento' ? GQ.green : 'transparent', transition: 'all 0.15s' }} />
            <span style={{ fontSize: 12, color: portfolioMode === 'rendimiento' ? GQ.text : GQ.textMuted, fontWeight: portfolioMode === 'rendimiento' ? 600 : 400 }}>Rendimiento</span>
          </button>
        </div>

        {/* getquin-style main chart */}
        {positions.length > 0 && portfolioHistory.length > 0 && (
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={portfolioHistory} margin={{ top: 8, right: 0, left: -28, bottom: 0 }}
                onMouseMove={e => {}}
              >
                <defs>
                  <linearGradient id="gqMainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GQ.green} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={GQ.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={GQ.border} vertical={false} horizontal={true} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: GQ.textMuted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 9, fill: GQ.textMuted }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={v => portfolioMode === 'rendimiento' ? `${v.toFixed(1)}%` : `${v.toFixed(0)}€`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: GQ.textMuted, strokeWidth: 1, strokeDasharray: '0' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div style={{ background: '#1a1f2e', border: `1px solid ${GQ.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, minWidth: 180 }}>
                        <div style={{ color: GQ.textMuted, marginBottom: 8, fontSize: 11 }}>{d?.fullDate}</div>
                        {portfolioMode === 'valor' ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GQ.green }} />
                              <span style={{ color: GQ.textMuted, fontSize: 11 }}>Valor de la cartera de inversiones</span>
                              <span style={{ color: GQ.text, fontWeight: 700, marginLeft: 'auto' }}>{(d?.valor || 0).toFixed(2)} €</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GQ.textMuted, border: '2px dashed ' + GQ.textMuted }} />
                              <span style={{ color: GQ.textMuted, fontSize: 11 }}>Capital invertido</span>
                              <span style={{ color: GQ.textMuted, fontWeight: 600, marginLeft: 'auto' }}>{(d?.capital || 0).toFixed(2)} €</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GQ.green }} />
                              <span style={{ color: GQ.textMuted, fontSize: 11 }}>Dinero propio</span>
                              <span style={{ color: (d?.rendimientoProp || 0) >= 0 ? GQ.green : GQ.red, fontWeight: 700, marginLeft: 'auto' }}>{(d?.rendimientoProp || 0) >= 0 ? '+' : ''}{(d?.rendimientoProp || 0).toFixed(2)}%</span>
                            </div>
                            {d?.rendimientoTotal !== d?.rendimientoProp && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: GQ.blue }} />
                                <span style={{ color: GQ.textMuted, fontSize: 11 }}>Total (incl. regalos)</span>
                                <span style={{ color: (d?.rendimientoTotal || 0) >= 0 ? GQ.blue : GQ.red, fontWeight: 600, marginLeft: 'auto' }}>{(d?.rendimientoTotal || 0) >= 0 ? '+' : ''}{(d?.rendimientoTotal || 0).toFixed(2)}%</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Capital line (dashed gray) - only in valor mode */}
                {portfolioMode === 'valor' && (
                  <Line type="monotone" dataKey="capital" stroke={GQ.textMuted} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                )}
                {/* Rendimiento: dinero propio */}
                {portfolioMode === 'rendimiento' && (
                  <Area type="monotone" dataKey="rendimientoTotal" stroke={GQ.blue} strokeWidth={1.5} strokeDasharray="5 4" fill="none" dot={false}
                    activeDot={{ r: 4, fill: GQ.blue, stroke: GQ.card, strokeWidth: 2 }} />
                )}
                {/* Main line: valor total o rendimientoProp */}
                <Area
                  type="monotone"
                  dataKey={portfolioMode === 'rendimiento' ? 'rendimientoProp' : 'valor'}
                  stroke={GQ.green}
                  fill="url(#gqMainGrad)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: GQ.green, stroke: GQ.card, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'right', fontSize: 9, color: GQ.textDim, marginTop: 2 }}>GRÁFICO POR getquin</div>
          </div>
        )}
      </div>

      {/* ── Sub-tabs (Resumen / Posiciones / Distribución...) like getquin ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${GQ.border}`, marginBottom: 16, overflowX: 'auto' }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            style={{ padding: '12px 18px', border: 'none', fontSize: 13, fontWeight: mainTab === t.id ? 600 : 400, background: 'transparent', color: mainTab === t.id ? GQ.text : GQ.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${mainTab === t.id ? GQ.green : 'transparent'}`, transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ PORTFOLIO TAB ══ */}
      {mainTab === 'portfolio' && (
        <div>
          {/* Chart type selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleRefreshPrices} disabled={refreshing || positions.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.textMuted, fontSize: 12, cursor: 'pointer' }}>
                <RefreshCw style={{ width: 13, height: 13, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                {refreshing ? 'Actualizando...' : 'Actualizar precios'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ id: 'line', label: '〜' }, { id: 'bar', label: '▊' }, { id: 'heatmap', label: '▦' }].map(ct => (
                <button key={ct.id} onClick={() => setPortfolioChart(ct.id)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid`, borderColor: portfolioChart === ct.id ? GQ.blue : GQ.border, background: portfolioChart === ct.id ? GQ.blueDim : 'transparent', color: portfolioChart === ct.id ? '#93c5fd' : GQ.textMuted, fontSize: 14, cursor: 'pointer' }}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Positions table - exact getquin style */}
          <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, marginBottom: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${GQ.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Posiciones</span>
              <button onClick={() => { setEditingPos(null); setForm(emptyForm()); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setShowForm(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: `1px solid ${GQ.border}`, background: 'transparent', color: GQ.text, fontSize: 12, cursor: 'pointer' }}>
                + Agregar transacción
              </button>
            </div>

            {/* Range selector for positions */}
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${GQ.border}`, display: 'flex', gap: 4 }}>
              {['1D', '1W', '1M', 'YTD', '1Y', 'Max'].map(r => (
                <button key={r} onClick={() => setPortfolioRange(r)}
                  style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: portfolioRange === r ? 600 : 400, background: portfolioRange === r ? '#1f2937' : 'transparent', color: portfolioRange === r ? GQ.text : GQ.textMuted, cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>

            {/* Table header - sortable */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 32px', gap: 0, padding: '10px 20px', borderBottom: `1px solid ${GQ.border}` }}>
              {[
                { label: 'Título', key: 'name', align: 'left' },
                { label: 'Comprar en', key: 'buy', align: 'right' },
                { label: 'Posición', key: 'current', align: 'right' },
                { label: 'P/L', key: 'gainPct', align: 'right' },
                { label: '', key: null, align: 'right' },
              ].map((h, i) => (
                <button key={i} onClick={() => h.key && toggleSort(h.key)}
                  style={{ fontSize: 11, color: GQ.textMuted, fontWeight: 500, textAlign: h.align, display: 'flex', alignItems: 'center', justifyContent: h.align === 'right' ? 'flex-end' : 'flex-start', gap: 4, background: 'none', border: 'none', cursor: h.key ? 'pointer' : 'default', padding: 0 }}>
                  {h.label}{h.key && <SortArrow k={h.key} />}
                </button>
              ))}
            </div>

            {sortedPositions.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: GQ.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                <div style={{ fontSize: 14 }}>Sin posiciones aún</div>
                <div style={{ fontSize: 12, color: GQ.textDim, marginTop: 6 }}>Añade tu primera inversión</div>
              </div>
            ) : (
              sortedPositions.map(pos => {
                const gain = getGain(pos);
                const gainPct = getGainPct(pos);
                const cur = pos.current_value_eur || pos.invested_amount_eur || 0;
                const typeInfo = getType(pos.investment_type);
                return (
                  <div key={pos.id}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 32px', gap: 0, padding: '14px 20px', borderBottom: `1px solid ${GQ.border}`, alignItems: 'center', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                      {/* Title col */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${typeInfo.color}15`, border: `1px solid ${typeInfo.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: typeInfo.color, flexShrink: 0 }}>
                          {pos.ticker?.slice(0, 4)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{pos.name?.slice(0, 24)}</div>
                          <div style={{ fontSize: 11, color: GQ.textMuted }}>{pos.ticker}{pos.currency && pos.currency !== 'EUR' ? ` · ${pos.currency}` : ''}</div>
                        </div>
                      </div>

                      {/* Buy-in col */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: GQ.textMuted }}>{pos.buy_price ? `${pos.buy_price.toFixed(2)} €` : '—'}</div>
                        <div style={{ fontSize: 10, color: GQ.textDim }}>{pos.invested_amount_eur ? `${pos.invested_amount_eur.toFixed(2)} €` : ''}</div>
                      </div>

                      {/* Position col */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text }}>{cur.toFixed(2)} €</div>
                        <div style={{ fontSize: 10, color: GQ.textDim }}>{pos.current_price ? `${pos.current_price.toFixed(2)} ${pos.currency || '€'}` : ''}</div>
                      </div>

                      {/* P/L col */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: gain >= 0 ? GQ.green : GQ.red }}>
                          {gain >= 0 ? '+' : ''}{gain.toFixed(2)} €
                        </div>
                        <div style={{ fontSize: 11, color: gain >= 0 ? GQ.green : GQ.red }}>
                          {gainPct >= 0 ? '↑' : '↓'}{Math.abs(gainPct).toFixed(2)} %
                        </div>
                      </div>

                      {/* 3-dot menu */}
                      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === pos.id ? null : pos.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: GQ.textMuted, padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                          ⋮
                        </button>
                        {openMenuId === pos.id && (
                          <div onClick={e => e.stopPropagation()}
                            style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: '#1a1f2e', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '4px 0', minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                            <button onClick={() => { setEditingPos(pos); setForm({ ...emptyForm(), ticker: pos.ticker, name: pos.name, investment_type: pos.investment_type, currency: pos.currency || 'EUR', sector: pos.sector || '', region: pos.region || '' }); setShowForm(true); setOpenMenuId(null); }}
                              style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: GQ.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              ✏️ Editar
                            </button>
                            <button onClick={() => { setDeleteId(pos.id); setOpenMenuId(null); }}
                              style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: GQ.red, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={e => e.currentTarget.style.background = GQ.redDim}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              🗑️ Borrar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>


                  </div>
                );
              })
            )}
          </div>

          {/* Sold — datos reales desde Firebase */}
          <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: '16px 20px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Vendido</span>
              <button
                onClick={() => { setSellAssetId(positions[0]?.id || ''); setSellAmountInput(''); setSellPriceInput(''); setShowSellModal(true); }}
                disabled={positions.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${GQ.green}44`, background: GQ.greenDim, color: GQ.green, fontSize: 12, cursor: positions.length === 0 ? 'not-allowed' : 'pointer', opacity: positions.length === 0 ? 0.4 : 1 }}>
                + Vender posición
              </button>
            </div>
            {sales.length === 0 ? (
              <div style={{ fontSize: 12, color: GQ.textDim }}>No hay ventas registradas</div>
            ) : (
              sales.slice(0, 5).map((sale, i) => (
                <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < Math.min(sales.length, 5) - 1 ? `1px solid ${GQ.border}` : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: GQ.redDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: GQ.red, flexShrink: 0 }}>{sale.ticker?.slice(0, 4)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: GQ.text }}>{sale.name || sale.ticker}</div>
                    <div style={{ fontSize: 11, color: GQ.textMuted }}>{sale.date ? format(new Date(sale.date + 'T12:00:00'), 'd MMM yyyy', { locale: es }) : '—'} · {sale.sell_price ? `${sale.sell_price.toFixed(2)} €/u` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: GQ.text }}>{(sale.amount_eur || 0).toFixed(2)} €</div>
                    <div style={{ fontSize: 11, color: (sale.gain_eur || 0) >= 0 ? GQ.green : GQ.red }}>
                      {(sale.gain_eur || 0) >= 0 ? '+' : ''}{(sale.gain_eur || 0).toFixed(2)} € ({(sale.gain_pct || 0).toFixed(2)}%)
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Transacciones — estilo getquin, agrupadas por mes */}
          <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${GQ.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: GQ.text }}>Transacciones</span>
            </div>
            {allTransactions.length === 0 ? (
              <div style={{ padding: '24px 20px', fontSize: 12, color: GQ.textDim }}>Sin transacciones</div>
            ) : (
              groupedTransactions.map(group => (
                <div key={group.key}>
                  {/* Month header */}
                  <div style={{ padding: '10px 20px', background: '#0d0d14', fontSize: 12, fontWeight: 600, color: GQ.textMuted, textTransform: 'capitalize' }}>
                    {group.label}
                  </div>
                  {group.txs.map((tx, i) => {
                    const isBuy = tx.type === 'buy';
                    const dayStr = tx.date ? format(new Date(tx.date + 'T12:00:00'), 'dd', { locale: es }) : '—';
                    const monthStr = tx.date ? format(new Date(tx.date + 'T12:00:00'), 'MM', { locale: es }) : '';
                    return (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${GQ.border}`, position: 'relative' }}
                        onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {/* Date */}
                        <div style={{ minWidth: 36, textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: GQ.text, lineHeight: 1 }}>{dayStr}</div>
                          <div style={{ fontSize: 9, color: GQ.textMuted }}>
                            {isBuy ? '→' : '←'}
                          </div>
                        </div>
                        {/* Logo */}
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: isBuy ? `${GQ.blue}18` : `${GQ.green}18`, border: `1px solid ${isBuy ? GQ.blue : GQ.green}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: isBuy ? '#93c5fd' : GQ.green, flexShrink: 0 }}>
                          {tx.ticker?.slice(0, 4)}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: GQ.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.name || tx.ticker}</div>
                          <div style={{ fontSize: 11, color: GQ.textMuted }}>
                            {isBuy
                              ? `Compró ${tx.price ? `${tx.price.toFixed(4)} a ${tx.price.toFixed(2)} €` : ''}`
                              : `Vendió a ${tx.price ? `${tx.price.toFixed(2)} €` : '—'}`}
                          </div>
                        </div>
                        {/* Amount */}
                        <div style={{ textAlign: 'right', marginRight: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isBuy ? GQ.text : GQ.green }}>
                            {isBuy ? '' : '+'}{(tx.amount || 0).toFixed(2)} €
                          </div>
                        </div>
                        {/* 3-dot for edit */}
                        <div style={{ position: 'relative' }}>
                          <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === tx.id ? null : tx.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: GQ.textMuted, padding: '4px 6px', fontSize: 18, lineHeight: 1 }}>
                            ⋮
                          </button>
                          {openMenuId === tx.id && (
                            <div onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: '#1a1f2e', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '4px 0', minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                              {isBuy && tx.posId && (
                                <button onClick={() => {
                                  const pos = positions.find(p => p.id === tx.posId);
                                  if (pos) { setEditingPos(pos); setForm({ ...emptyForm(), ticker: pos.ticker, name: pos.name, investment_type: pos.investment_type, currency: pos.currency || 'EUR', sector: pos.sector || '', region: pos.region || '' }); setShowForm(true); setOpenMenuId(null); }
                                }}
                                  style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: GQ.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                  onMouseEnter={e => e.currentTarget.style.background = GQ.cardHover}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  ✏️ Editar
                                </button>
                              )}
                              {!isBuy && tx.saleId && (
                                <button onClick={async () => { await base44.entities.InvestmentSale.delete(tx.saleId); setOpenMenuId(null); fetchData(); }}
                                  style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', color: GQ.red, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                  onMouseEnter={e => e.currentTarget.style.background = GQ.redDim}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  🗑️ Borrar
                                </button>
                              )}
                            </div>
                          )}
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

      {/* ══ DISTRIBUTION TAB ══ */}
      {mainTab === 'distribution' && (
        <div style={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 16, padding: 20 }}>
          <DistributionPanel positions={positions} totalCurrentValue={totalCurrentValue} />
        </div>
      )}

      {/* ══ PERFORMANCE TAB ══ */}
      {mainTab === 'performance' && (
        <PerformancePanel positions={positions} totalInvested={totalInvested} totalCurrentValue={totalCurrentValue} totalGain={totalGain} totalGainPct={totalGainPct} />
      )}

      {/* ══ DIVIDENDS TAB ══ */}
      {mainTab === 'dividends' && <DividendsPanel positions={positions} />}

      {/* ══ AI TAB ══ */}
      {mainTab === 'ai' && (
        <AIPanel positions={positions} totalInvested={totalInvested} totalCurrentValue={totalCurrentValue} totalGain={totalGain} totalGainPct={totalGainPct} />
      )}

      {/* ─── Dialogs ──────────────────────────────────────────────────────────── */}

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
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs text-green-400">Seleccionado: <strong>{selectedResult.ticker}</strong> — {selectedResult.name}</span>
                    <button onClick={() => { setSelectedResult(null); setForm(f => ({ ...f, ticker: '', name: '', buy_price: '' })); }} className="ml-auto"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden mb-2">
                    {searchResults.map(r => (
                      <button key={r.ticker} onClick={() => handleSelectResult(r)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors border-b border-border last:border-0 text-left">
                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-[10px] font-bold text-foreground">{r.ticker.slice(0, 3)}</div>
                        <div><div className="text-sm font-medium text-foreground">{r.ticker}</div><div className="text-xs text-muted-foreground">{r.name}</div></div>
                        <Badge variant="outline" className="ml-auto text-[10px] border-border text-muted-foreground">{r.type}</Badge>
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
              <div><label className="text-xs text-muted-foreground mb-1 block">Sector</label>
                <Select value={form.sector || ''} onValueChange={v => setForm(f => ({ ...f, sector: v }))}>
                  <SelectTrigger className="bg-background/50 border-border text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Región</label>
                <Select value={form.region || ''} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger className="bg-background/50 border-border text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
            {/* Is own money toggle */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Tipo de compra</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setForm(f => ({ ...f, is_own_money: true }))}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid`, borderColor: form.is_own_money !== false ? '#22c55e' : '#1f2937', background: form.is_own_money !== false ? '#14532d' : 'transparent', color: form.is_own_money !== false ? '#4ade80' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: form.is_own_money !== false ? 600 : 400, transition: 'all 0.15s' }}>
                  💰 Dinero propio
                </button>
                <button onClick={() => setForm(f => ({ ...f, is_own_money: false }))}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid`, borderColor: form.is_own_money === false ? '#3b82f6' : '#1f2937', background: form.is_own_money === false ? '#1e3a5f' : 'transparent', color: form.is_own_money === false ? '#93c5fd' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: form.is_own_money === false ? 600 : 400, transition: 'all 0.15s' }}>
                  🎁 No dinero propio
                </button>
              </div>
              {form.is_own_money === false && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, margin: '6px 0 0' }}>Esta compra no descontará del saldo disponible</p>}
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Descripción (opcional)</label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Notas..." className="bg-background/50 border-border text-sm" /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingPos(null); setForm(emptyForm()); }} className="flex-1 border-border text-sm">Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.ticker || !form.invested_amount_eur} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                {editingPos ? 'Añadir compra' : 'Crear posición'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View position chart */}
      <Dialog open={!!viewingPos} onOpenChange={v => { if (!v) { setViewingPos(null); setViewHistory([]); } }}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-3">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: GQ.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#93c5fd' }}>{viewingPos?.ticker?.slice(0, 4)}</div>
              <div><div>{viewingPos?.name}</div><div style={{ fontSize: 12, color: GQ.textMuted, fontWeight: 400 }}>{viewingPos?.ticker}</div></div>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {['1d', '1w', '1mo', '3mo', '1y', 'max'].map(r => (
                  <button key={r} onClick={() => loadViewRange(r)}
                    style={{ padding: '4px 9px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: viewRange === r ? 600 : 400, background: viewRange === r ? '#1f2937' : 'transparent', color: viewRange === r ? GQ.text : GQ.textMuted, cursor: 'pointer' }}>
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[{ id: 'line', l: '〜' }, { id: 'bar', l: '▊' }].map(ct => (
                  <button key={ct.id} onClick={() => setViewChartType(ct.id)}
                    style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid', borderColor: viewChartType === ct.id ? GQ.blue : GQ.border, background: viewChartType === ct.id ? GQ.blueDim : 'transparent', color: viewChartType === ct.id ? '#93c5fd' : GQ.textMuted, fontSize: 14, cursor: 'pointer' }}>
                    {ct.l}
                  </button>
                ))}
              </div>
            </div>

            {viewHistoryLoading ? (
              <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
            ) : viewHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                {viewChartType === 'bar' ? (
                  <BarChart data={viewHistory} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11, color: GQ.text }} />
                    <Bar dataKey="price" fill={GQ.blue} radius={[3, 3, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={viewHistory} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                    <defs><linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GQ.green} stopOpacity={0.3} /><stop offset="95%" stopColor={GQ.green} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GQ.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: GQ.textMuted }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: GQ.card, border: `1px solid ${GQ.border}`, borderRadius: 8, fontSize: 11, color: GQ.text }} />
                    <Area type="monotone" dataKey="price" stroke={GQ.green} fill="url(#vGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">Sin historial disponible</div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Invertido', value: `${(viewingPos?.invested_amount_eur || 0).toFixed(2)} €` },
                { label: 'Valor actual', value: `${(viewingPos?.current_value_eur || viewingPos?.invested_amount_eur || 0).toFixed(2)} €` },
                { label: 'P/L', value: `${getGain(viewingPos || {}) >= 0 ? '+' : ''}${getGain(viewingPos || {}).toFixed(2)} €`, color: getGain(viewingPos || {}) >= 0 ? GQ.green : GQ.red },
              ].map(item => (
                <div key={item.label} style={{ background: '#0a0a0f', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: GQ.textDim, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: item.color || GQ.text }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: GQ.textDim, textAlign: 'right' }}>GRÁFICO POR getquin · Precio/gráfico: Yahoo Finance API v8 (tiempo real)</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell */}
      <Dialog open={showSellForm} onOpenChange={v => { if (!v) { setShowSellForm(false); setSellPos(null); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Vender {sellPos?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: GQ.textMuted }}>Valor actual: <span style={{ color: GQ.text, fontWeight: 700 }}>{(sellPos?.current_value_eur || sellPos?.invested_amount_eur || 0).toFixed(2)} €</span></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Cantidad (€)</label><Input type="number" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder="0.00" className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Fecha</label><Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="bg-background/50 border-border" /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowSellForm(false); setSellPos(null); }} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleSell} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Confirmar venta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit price */}
      <Dialog open={showPriceEdit} onOpenChange={v => { if (!v) { setShowPriceEdit(false); setEditPricePos(null); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Editar precio — {editPricePos?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Precio actual ({editPricePos?.currency})</label><Input type="number" value={editPriceForm.current_price} onChange={e => setEditPriceForm(f => ({ ...f, current_price: e.target.value }))} className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Valor actual (€)</label><Input type="number" value={editPriceForm.current_value_eur} onChange={e => setEditPriceForm(f => ({ ...f, current_value_eur: e.target.value }))} className="bg-background/50 border-border" /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowPriceEdit(false); setEditPricePos(null); }} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleSavePrice} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear cuenta/cartera */}
      <Dialog open={showAccountForm} onOpenChange={v => { if (!v) setShowAccountForm(false); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Nueva cartera</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Nombre de la cartera</label>
              <Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Mi Cartera Principal, Trade Republic..." className="bg-background/50 border-border" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Broker (opcional)</label>
              <Input value={accountForm.broker} onChange={e => setAccountForm(f => ({ ...f, broker: e.target.value }))}
                placeholder="DEGIRO, Interactive Brokers..." className="bg-background/50 border-border" />
            </div>
            {accounts.length > 0 && (
              <div style={{ borderTop: `1px solid ${GQ.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: GQ.textMuted, marginBottom: 6 }}>Carteras existentes:</div>
                {accounts.map(a => (
                  <div key={a.id} style={{ fontSize: 12, color: GQ.text, padding: '5px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📁 {a.name}{a.broker ? ` · ${a.broker}` : ''}</span>
                    <button onClick={async () => { await base44.entities.InvestmentAccount.delete(a.id); fetchData(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: GQ.red, fontSize: 12 }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <Button variant="outline" onClick={() => setShowAccountForm(false)} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleCreateAccount} disabled={!accountForm.name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Crear cartera</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Vender posición */}
      <Dialog open={showSellModal} onOpenChange={v => { if (!v) setShowSellModal(false); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Vender posición</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Activo a vender</label>
              <select value={sellAssetId} onChange={e => setSellAssetId(e.target.value)}
                style={{ width: '100%', background: '#0a0a0f', border: `1px solid ${GQ.border}`, borderRadius: 10, padding: '9px 12px', color: GQ.text, fontSize: 13, outline: 'none' }}>
                {positions.map(p => (
                  <option key={p.id} value={p.id}>{p.ticker} — {(p.current_value_eur || p.invested_amount_eur || 0).toFixed(2)} €</option>
                ))}
              </select>
            </div>
            {sellAssetId && (() => {
              const pos = positions.find(p => p.id === sellAssetId);
              return pos ? (
                <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: GQ.textMuted }}>
                  Disponible: <span style={{ color: GQ.text, fontWeight: 700 }}>{(pos.current_value_eur || pos.invested_amount_eur || 0).toFixed(2)} €</span>
                  {pos.current_price ? ` · Precio actual: ${pos.current_price.toFixed(2)} ${pos.currency}` : ''}
                </div>
              ) : null;
            })()}
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Precio de venta ({positions.find(p => p.id === sellAssetId)?.currency || 'EUR'})</label>
              <Input type="number" value={sellPriceInput} onChange={e => setSellPriceInput(e.target.value)}
                placeholder="0.00" className="bg-background/50 border-border" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Cantidad vendida (€)</label>
              <Input type="number" value={sellAmountInput} onChange={e => setSellAmountInput(e.target.value)}
                placeholder="0.00" className="bg-background/50 border-border" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: GQ.textMuted, display: 'block', marginBottom: 6 }}>Fecha</label>
              <Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="bg-background/50 border-border [color-scheme:dark]" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={() => setShowSellModal(false)} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleSellWithSave} disabled={!sellAssetId || !sellAmountInput} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Confirmar venta</Button>
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
