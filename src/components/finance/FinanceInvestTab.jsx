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
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar
} from 'recharts';
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw,
  Eye, ArrowUpRight, ArrowDownRight, Search, X, ChevronDown, ChevronUp,
  DollarSign, BarChart2, PieChart as PieIcon, Briefcase, Globe,
  Building2, Zap, Droplets, Bot, Send, Target, Shield,
  Lightbulb, AlertTriangle, CheckCircle, Loader2, Sparkles, User
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// ─── Groq API ────────────────────────────────────────────────────────────────
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
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&listsCount=0`;
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
    return { ticker: meta.symbol, price: meta.regularMarketPrice, previousClose: meta.previousClose || meta.chartPreviousClose, currency: meta.currency, exchange: meta.exchangeName };
  } catch { return null; }
}

async function getEurFxRate(currency) {
  if (currency === 'EUR') return 1;
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${currency}EUR=X?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return rate || null;
  } catch {
    const fallback = { USD: 0.92, GBP: 1.17, CHF: 1.06, JPY: 0.0062, CAD: 0.68, AUD: 0.60 };
    return fallback[currency] || null;
  }
}

async function getYahooHistory(ticker, months = 12) {
  try {
    const url = `https://corsproxy.io/?url=https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=${months}mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    return timestamps.map((ts, i) => ({
      date: format(new Date(ts * 1000), 'MMM yy', { locale: es }),
      price: closes[i] ? +closes[i].toFixed(2) : null,
    })).filter(d => d.price !== null);
  } catch { return []; }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INVESTMENT_TYPES = [
  { id: 'stock', label: 'Acción', color: '#60a5fa', icon: TrendingUp },
  { id: 'etf', label: 'ETF', color: '#34d399', icon: BarChart2 },
  { id: 'index_fund', label: 'Fondo indexado', color: '#a78bfa', icon: Globe },
  { id: 'crypto', label: 'Crypto', color: '#f59e0b', icon: Zap },
  { id: 'bond', label: 'Bono', color: '#6ee7b7', icon: Building2 },
  { id: 'commodity', label: 'Materia prima', color: '#fbbf24', icon: Droplets },
  { id: 'other', label: 'Otro', color: '#9ca3af', icon: Briefcase },
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
const SECTORS = ['Tecnología', 'Salud', 'Finanzas', 'Consumo discrecional', 'Consumo básico', 'Energía', 'Materiales', 'Industria', 'Servicios públicos', 'Inmobiliario', 'Comunicaciones', 'Criptomonedas', 'Otro'];
const REGIONS = ['América del Norte', 'Europa', 'Asia Pacífico', 'Emergentes', 'Global', 'América Latina', 'África/Oriente Medio'];
const POSITION_COLORS = ['#60a5fa','#34d399','#a78bfa','#f59e0b','#fb923c','#f87171','#6ee7b7','#c4b5fd','#fbbf24','#4ade80','#38bdf8','#e879f9','#ff6b6b','#ffd93d','#6bcb77','#4d96ff'];
const SECTOR_COLORS = ['#60a5fa','#34d399','#a78bfa','#f59e0b','#fb923c','#f87171','#6ee7b7','#c4b5fd','#fbbf24','#4ade80','#38bdf8','#e879f9'];
const REGION_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16'];

// ─── Sub-components ───────────────────────────────────────────────────────────
const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-xl">
      <p style={{ color: payload[0].payload.color }}>
        {payload[0].name}: {payload[0].value?.toFixed(2)}€{' '}
        ({((payload[0].payload.pct || 0) * 100).toFixed(1)}%)
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

// ─── Portfolio Score Component ────────────────────────────────────────────────
function PortfolioScore({ score, recommendations }) {
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#f59e0b' : '#f87171';
  const label = score >= 70 ? 'Buena' : score >= 45 ? 'Media' : 'Mejorable';
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" /> Puntuación de cartera
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
                strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold" style={{ color }}>{score}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color }}>{label}</div>
            <div className="text-xs text-muted-foreground mt-1">Tu cartera supera al {Math.round(score * 0.8)}% de inversores similares</div>
          </div>
        </div>
        {recommendations?.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground mb-2">Recomendaciones</div>
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-muted/20 rounded-lg">
                {rec.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  : rec.type === 'good' ? <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                  : <Lightbulb className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />}
                <span className="text-xs text-muted-foreground">{rec.text}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── AI Onboarding + Chat Component ──────────────────────────────────────────
const ONBOARDING_QUESTIONS = [
  { id: 'salary', text: '¿Cuál es tu salario neto mensual en €?', type: 'number', placeholder: 'Ej: 1800' },
  { id: 'fixed_expenses', text: '¿Cuánto gastas en gastos fijos al mes (alquiler, luz, comida...)?', type: 'number', placeholder: 'Ej: 900' },
  { id: 'goal', text: '¿Cuál es tu objetivo principal de inversión?', type: 'select', options: ['Independencia financiera', 'Jubilación anticipada', 'Comprar una casa', 'Educación de hijos', 'Crear patrimonio a largo plazo', 'Complementar ingresos', 'Otro'] },
  { id: 'horizon', text: '¿A qué plazo quieres invertir?', type: 'select', options: ['Menos de 2 años', '2-5 años', '5-10 años', 'Más de 10 años'] },
  { id: 'risk', text: '¿Cuánta pérdida temporal podrías soportar sin entrar en pánico?', type: 'select', options: ['Ninguna — prefiero no perder nada', 'Hasta un 10%', 'Hasta un 20%', 'Hasta un 30%', 'Más del 30% si es a largo plazo'] },
  { id: 'job_security', text: 'Si perdieras el trabajo hoy, ¿cuántos meses podrías vivir con tus ahorros?', type: 'select', options: ['Menos de 1 mes', '1-3 meses', '3-6 meses', '6-12 meses', 'Más de 12 meses'] },
  { id: 'monthly_investment', text: '¿Cuánto puedes invertir cada mes de forma estable?', type: 'number', placeholder: 'Ej: 200' },
  { id: 'broker', text: '¿Qué broker/plataforma usas principalmente?', type: 'select', options: ['Trade Republic', 'DEGIRO', 'Interactive Brokers', 'Indexa Capital', 'MyInvestor', 'Revolut', 'Otro'] },
];

function AIAdvisorPanel({ positions, totalInvested, totalCurrentValue, totalGain, totalGainPct }) {
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('invest_ai_profile') || 'null'); } catch { return null; }
  });
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState({});
  const [onboardingInput, setOnboardingInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(() => {
    try { return JSON.parse(localStorage.getItem('invest_ai_analysis') || 'null'); } catch { return null; }
  });
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const buildSystemPrompt = (prof) => {
    const portfolioSummary = positions.length > 0
      ? `Cartera actual: ${positions.map(p => `${p.ticker} (${p.name}, ${(p.current_value_eur || p.invested_amount_eur || 0).toFixed(0)}€, ${p.investment_type})`).join(', ')}. Total: ${totalCurrentValue.toFixed(0)}€, invertido: ${totalInvested.toFixed(0)}€, ganancia: ${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(0)}€ (${totalGainPct.toFixed(1)}%).`
      : 'Sin cartera aún.';

    return `Eres un asesor financiero personal de élite. Hablas en español, eres directo, profesional y usas datos reales.

PERFIL DEL USUARIO:
- Salario neto mensual: ${prof.salary}€
- Gastos fijos: ${prof.fixed_expenses}€
- Disponible mensual: ${(parseFloat(prof.salary) - parseFloat(prof.fixed_expenses)).toFixed(0)}€
- Objetivo: ${prof.goal}
- Horizonte: ${prof.horizon}
- Tolerancia al riesgo: ${prof.risk}
- Seguridad laboral (meses ahorros): ${prof.job_security}
- Inversión mensual objetivo: ${prof.monthly_investment}€
- Broker: ${prof.broker}

CARTERA: ${portfolioSummary}

INSTRUCCIONES:
1. Siempre basa tus consejos en el perfil real del usuario.
2. Da cifras concretas en euros, no solo porcentajes.
3. Ten en cuenta su tolerancia al riesgo y horizonte temporal.
4. Si tiene poca seguridad laboral, prioriza el fondo de emergencia.
5. Compara su cartera con benchmarks reales (S&P 500, MSCI World).
6. Usa markdown: **negrita**, ## secciones, - listas.
7. Sé honesto aunque el mensaje no sea lo que quiere oír.`;
  };

  const handleOnboardingAnswer = async (answer) => {
    const q = ONBOARDING_QUESTIONS[onboardingStep];
    const newAnswers = { ...onboardingAnswers, [q.id]: answer };
    setOnboardingAnswers(newAnswers);

    if (onboardingStep < ONBOARDING_QUESTIONS.length - 1) {
      setOnboardingStep(s => s + 1);
      setOnboardingInput('');
    } else {
      // Completed onboarding
      localStorage.setItem('invest_ai_profile', JSON.stringify(newAnswers));
      setProfile(newAnswers);
      setOnboardingStep(0);
      setOnboardingAnswers({});
      // Auto-analyze portfolio
      await runAnalysis(newAnswers);
    }
  };

  const runAnalysis = async (prof) => {
    setAnalyzing(true);
    try {
      const sys = buildSystemPrompt(prof);
      const portfolioSummary = positions.length > 0
        ? positions.map(p => `${p.ticker}: ${(p.current_value_eur || p.invested_amount_eur || 0).toFixed(0)}€ (${p.investment_type}${p.sector ? ', ' + p.sector : ''}${p.region ? ', ' + p.region : ''})`).join('\n')
        : 'Sin posiciones';

      const prompt = `Analiza esta cartera en profundidad:
${portfolioSummary}

Responde SOLO con JSON válido, sin texto adicional:
{
  "score": número entre 0 y 100,
  "summary": "resumen en 2 frases",
  "recommendations": [
    {"type": "warning|good|tip", "text": "recomendación concreta"},
    {"type": "warning|good|tip", "text": "recomendación concreta"},
    {"type": "warning|good|tip", "text": "recomendación concreta"},
    {"type": "warning|good|tip", "text": "recomendación concreta"},
    {"type": "warning|good|tip", "text": "recomendación concreta"}
  ],
  "diversification": número 0-10,
  "risk_level": número 0-10,
  "cost_efficiency": número 0-10,
  "macroeconomic": número 0-10
}`;

      const result = await callGroq([{ role: 'system', content: sys }, { role: 'user', content: prompt }], 800);
      const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
      localStorage.setItem('invest_ai_analysis', JSON.stringify(parsed));
      setAnalysis(parsed);
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || loading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const sys = buildSystemPrompt(profile);
      const groqMessages = [{ role: 'system', content: sys }, ...newMessages.slice(-10)];
      const reply = await callGroq(groqMessages, 1500);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  const resetProfile = () => {
    localStorage.removeItem('invest_ai_profile');
    localStorage.removeItem('invest_ai_analysis');
    setProfile(null);
    setAnalysis(null);
    setMessages([]);
    setOnboardingStep(0);
    setOnboardingAnswers({});
  };

  // ── Onboarding UI ──
  if (!profile) {
    const q = ONBOARDING_QUESTIONS[onboardingStep];
    return (
      <Card className="glass-card border-gold/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-gold" /> Asesor IA — Configuración inicial
          </CardTitle>
          <p className="text-xs text-muted-foreground">Pregunta {onboardingStep + 1} de {ONBOARDING_QUESTIONS.length}</p>
          <div className="w-full h-1 bg-muted/30 rounded-full">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${((onboardingStep + 1) / ONBOARDING_QUESTIONS.length) * 100}%` }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-gold/5 border border-gold/20 rounded-xl">
            <p className="text-sm text-foreground font-medium">{q.text}</p>
          </div>

          {q.type === 'select' ? (
            <div className="space-y-2">
              {q.options.map(opt => (
                <button key={opt} onClick={() => handleOnboardingAnswer(opt)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-gold/5 text-sm text-foreground transition-colors">
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={q.placeholder}
                value={onboardingInput}
                onChange={e => setOnboardingInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && onboardingInput) handleOnboardingAnswer(onboardingInput); }}
                className="bg-background/50 border-border text-sm"
              />
              <Button onClick={() => onboardingInput && handleOnboardingAnswer(onboardingInput)}
                className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30">
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {onboardingStep > 0 && (
            <button onClick={() => { setOnboardingStep(s => s - 1); setOnboardingInput(''); }}
              className="text-xs text-muted-foreground hover:text-foreground">← Anterior</button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Main AI Panel ──
  return (
    <div className="space-y-4">
      {/* Analysis cards */}
      {analyzing ? (
        <Card className="glass-card">
          <CardContent className="py-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-3 text-gold animate-spin" />
            <p className="text-sm text-muted-foreground">Analizando tu cartera...</p>
          </CardContent>
        </Card>
      ) : analysis ? (
        <>
          <PortfolioScore score={analysis.score} recommendations={analysis.recommendations} />

          {/* Sub-scores */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Diversificación', value: analysis.diversification, color: '#60a5fa' },
              { label: 'Riesgo', value: analysis.risk_level, color: '#f59e0b' },
              { label: 'Eficiencia costes', value: analysis.cost_efficiency, color: '#34d399' },
              { label: 'Macroeconomía', value: analysis.macroeconomic, color: '#a78bfa' },
            ].map(item => (
              <Card key={item.label} className="glass-card">
                <CardContent className="pt-3 pb-3">
                  <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold" style={{ color: item.color }}>{item.value}</div>
                    <div className="text-xs text-muted-foreground">/10</div>
                  </div>
                  <div className="w-full h-1.5 bg-muted/30 rounded-full mt-1.5">
                    <div className="h-full rounded-full" style={{ width: `${item.value * 10}%`, backgroundColor: item.color }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="glass-card">
          <CardContent className="py-6 text-center">
            <Button onClick={() => runAnalysis(profile)} className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 text-sm gap-2">
              <Sparkles className="w-4 h-4" /> Analizar mi cartera
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Chat */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-gold" /> Chat con tu asesor
            </CardTitle>
            <button onClick={resetProfile} className="text-[10px] text-muted-foreground hover:text-foreground">
              Cambiar perfil
            </button>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
            <User className="w-3 h-3 text-gold" />
            <span className="text-[10px] text-muted-foreground">
              {profile.salary}€/mes · {profile.goal} · Riesgo: {profile.risk?.split('–')[0]?.trim() || profile.risk}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Quick questions */}
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Preguntas frecuentes:</p>
              {[
                '¿Estoy bien diversificado para mi perfil?',
                '¿Cuánto debería tener en fondo de emergencia?',
                'Crea un plan de inversión mensual con mi nómina',
                '¿Qué ETF me recomiendas para mi objetivo?',
                'Analiza mi tolerancia al riesgo y ajusta mis inversiones',
              ].map(q => (
                <button key={q} onClick={() => { setChatInput(q); }}
                  className="w-full text-left p-2 rounded-lg border border-border hover:border-gold/30 hover:bg-gold/5 text-xs text-muted-foreground transition-colors">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${msg.role === 'user' ? 'bg-gold/20 text-gold' : 'bg-muted/50 text-foreground'}`}>
                    {msg.role === 'user' ? 'Tú' : '🤖'}
                  </div>
                  <div className={`rounded-xl p-3 text-xs max-w-[85%] ${msg.role === 'user' ? 'bg-gold/10 text-foreground' : 'bg-muted/20 text-foreground'}`}
                    style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-[10px]">🤖</div>
                  <div className="rounded-xl p-3 bg-muted/20">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Pregunta sobre tu cartera, nómina, objetivos..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
              className="bg-background/50 border-border text-xs"
            />
            <Button onClick={sendMessage} disabled={loading || !chatInput.trim()}
              className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 px-3">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FinanceInvestTab() {
  const [positions, setPositions] = useState([]);
  const [dailyTxs, setDailyTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  const emptyForm = () => ({
    ticker: '', name: '', investment_type: 'stock',
    invested_amount_eur: '', buy_price: '', currency: 'EUR',
    description: '', date: format(new Date(), 'yyyy-MM-dd'),
    sector: '', region: '', _fxRate: null,
  });
  const [form, setForm] = useState(emptyForm());

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
  const getGainPct = (pos) => { const inv = pos.invested_amount_eur || 0; return inv === 0 ? 0 : (getGain(pos) / inv) * 100; };
  const getTypeInfo = (id) => INVESTMENT_TYPES.find(t => t.id === id) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];

  const totalVal = totalCurrentValue || 1;

  const typeGroups = {};
  positions.forEach(p => {
    const t = getTypeInfo(p.investment_type);
    if (!typeGroups[p.investment_type]) typeGroups[p.investment_type] = { name: t.label, value: 0, color: t.color, pct: 0 };
    typeGroups[p.investment_type].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  Object.values(typeGroups).forEach(g => { g.pct = g.value / totalVal; });
  const typeData = Object.values(typeGroups);

  const positionData = positions.map((p, i) => ({
    name: p.ticker,
    value: +(p.current_value_eur || p.invested_amount_eur || 0).toFixed(2),
    color: POSITION_COLORS[i % POSITION_COLORS.length],
    pct: (p.current_value_eur || p.invested_amount_eur || 0) / totalVal,
  }));

  const sectorGroups = {};
  positions.forEach(p => {
    const sec = p.sector || 'Sin sector';
    if (!sectorGroups[sec]) sectorGroups[sec] = { name: sec, value: 0 };
    sectorGroups[sec].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const sectorData = Object.values(sectorGroups).sort((a, b) => b.value - a.value);

  const regionGroups = {};
  positions.forEach(p => {
    const reg = p.region || 'Sin región';
    if (!regionGroups[reg]) regionGroups[reg] = { name: reg, value: 0 };
    regionGroups[reg].value += p.current_value_eur || p.invested_amount_eur || 0;
  });
  const regionData = Object.values(regionGroups).sort((a, b) => b.value - a.value);

  const sorted = [...positions].sort((a, b) => getGainPct(b) - getGainPct(a));
  const topPerformers = sorted.slice(0, 3);
  const worstPerformers = sorted.slice(-3).reverse();

  // ─── Actions ─────────────────────────────────────────────────────────────────
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
    const typeMap = { 'EQUITY': 'stock', 'ETF': 'etf', 'MUTUALFUND': 'index_fund', 'CRYPTOCURRENCY': 'crypto', 'BOND': 'bond', 'COMMODITY': 'commodity', 'FUTURE': 'commodity', 'INDEX': 'etf' };
    const investmentType = typeMap[result.type?.toUpperCase()] || 'stock';
    const regionMap = { 'NMS': 'América del Norte', 'NYQ': 'América del Norte', 'NGM': 'América del Norte', 'PCX': 'América del Norte', 'BIT': 'Europa', 'FRA': 'Europa', 'EPA': 'Europa', 'AMS': 'Europa', 'LSE': 'Europa', 'STO': 'Europa', 'BME': 'Europa', 'TYO': 'Asia Pacífico', 'HKG': 'Asia Pacífico', 'CCY': 'Global', 'CCC': 'Global' };
    const autoRegion = regionMap[result.exchange] || '';
    setForm(f => ({ ...f, ticker: result.ticker, name: result.name, investment_type: investmentType, region: autoRegion }));
    const quote = await getYahooQuote(result.ticker);
    if (quote) {
      const currency = quote.currency || 'USD';
      const fxRate = await getEurFxRate(currency);
      setForm(f => ({ ...f, buy_price: quote.price?.toFixed(2) || '', currency, _fxRate: fxRate }));
    }
    setSearchResults([]);
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    for (const pos of positions) {
      try {
        const quote = await getYahooQuote(pos.ticker);
        if (quote && quote.price) {
          const currency = quote.currency || pos.currency || 'EUR';
          const fxRate = await getEurFxRate(currency);
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
    if (!editingPos && amount > dailyAvailable) { alert(`No tienes suficiente saldo. Disponible: ${dailyAvailable.toFixed(2)}€`); return; }
    const buyPrice = parseFloat(form.buy_price) || 0;
    const fxRate = form.currency === 'EUR' ? 1 : (form._fxRate || null);
    const data = { ticker: form.ticker.toUpperCase(), name: form.name, investment_type: form.investment_type, invested_amount_eur: amount, buy_price: buyPrice, currency: form.currency, description: form.description, date: form.date, sector: form.sector, region: form.region, current_value_eur: amount, current_price: buyPrice, fx_rate: fxRate };
    const m = new Date(form.date).getMonth() + 1;
    const yr = new Date(form.date).getFullYear();
    await base44.entities.FinanceTransaction.create({ type: 'transfer_to_investment', amount, description: `Inversión en ${form.ticker.toUpperCase()}`, date: form.date, month: m, year: yr });
    if (editingPos) {
      const newHistory = [...(editingPos.purchase_history || []), { date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }];
      await base44.entities.InvestmentPosition.update(editingPos.id, { ...data, invested_amount_eur: (editingPos.invested_amount_eur || 0) + amount, current_value_eur: (editingPos.current_value_eur || editingPos.invested_amount_eur || 0) + amount, purchase_history: newHistory });
    } else {
      await base44.entities.InvestmentPosition.create({ ...data, purchase_history: [{ date: form.date, amount_eur: amount, buy_price: buyPrice, currency: form.currency }] });
    }
    setShowForm(false); setEditingPos(null); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setForm(emptyForm()); fetchData();
  };

  const handleSell = async () => {
    if (!sellPos || !sellAmount) return;
    const amount = parseFloat(sellAmount);
    const currentValue = sellPos.current_value_eur || sellPos.invested_amount_eur || 0;
    if (amount > currentValue) { alert(`Solo puedes vender hasta ${currentValue.toFixed(2)}€`); return; }
    const ratio = amount / currentValue;
    await base44.entities.InvestmentPosition.update(sellPos.id, { current_value_eur: +(currentValue - amount).toFixed(2), invested_amount_eur: +((sellPos.invested_amount_eur || 0) * (1 - ratio)).toFixed(2) });
    const m = new Date(sellDate).getMonth() + 1;
    const yr = new Date(sellDate).getFullYear();
    await base44.entities.FinanceTransaction.create({ type: 'transfer_from_investment', amount, category: 'Desde inversión', description: `Venta de ${sellPos.ticker}`, date: sellDate, month: m, year: yr });
    setShowSellForm(false); setSellPos(null); setSellAmount(''); fetchData();
  };

  const handleDelete = async () => { await base44.entities.InvestmentPosition.delete(deleteId); setDeleteId(null); fetchData(); };

  const handleSavePrice = async () => {
    const price = parseFloat(editPriceForm.current_price);
    const valueEur = parseFloat(editPriceForm.current_value_eur);
    const updates = {};
    if (!isNaN(price)) updates.current_price = price;
    if (!isNaN(valueEur)) updates.current_value_eur = valueEur;
    if (Object.keys(updates).length) { updates.last_updated = new Date().toISOString(); await base44.entities.InvestmentPosition.update(editPricePos.id, updates); }
    setShowPriceEdit(false); setEditPricePos(null); fetchData();
  };

  const openViewPos = async (pos) => {
    setViewingPos(pos); setViewHistoryLoading(true);
    const hist = await getYahooHistory(pos.ticker, 12);
    setViewHistory(hist); setViewHistoryLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gold/30 border-t-gold rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Valor total" value={`${totalCurrentValue.toFixed(2)}€`} color="text-gold" icon={TrendingUp} />
        <StatCard label="Total invertido" value={`${totalInvested.toFixed(2)}€`} icon={DollarSign} />
        <StatCard label="Ganancia / Pérdida" value={`${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)}€`}
          sub={<>{totalGain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{totalGain >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%</>}
          color={totalGain >= 0 ? 'text-gym' : 'text-destructive'}
          icon={totalGain >= 0 ? TrendingUp : TrendingDown} />
        <StatCard label="Posiciones" value={positions.length.toString()} icon={Briefcase} />
      </div>

      {/* Action bar */}
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
        {positions.length > 0 && <span className="text-xs text-muted-foreground">💡 Precios vía Yahoo Finance en tiempo real</span>}
      </div>

      {/* Tabs */}
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
          <TabsTrigger value="ai" className="flex-1 text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold">
            <Bot className="w-3.5 h-3.5 mr-1" /> IA Asesor
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {positions.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-16 text-center"><TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" /><p className="text-muted-foreground text-sm">Sin posiciones aún</p><p className="text-xs text-muted-foreground/60 mt-1">Añade tu primera inversión para empezar a trackear</p></CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm flex items-center gap-2"><PieIcon className="w-4 h-4 text-gold" /> Por tipo de activo</CardTitle></CardHeader>
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
                  <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-gold" /> Por posición</CardTitle></CardHeader>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="glass-card border-gym/20">
                  <CardHeader className="pb-2"><CardTitle className="text-gym text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Mejores performers</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {topPerformers.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">Sin datos</p>
                      : topPerformers.map(pos => (
                        <div key={pos.id} className="flex items-center justify-between p-2 bg-gym/5 rounded-lg border border-gym/10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-gym/10 text-gym">{pos.ticker?.slice(0, 3)}</div>
                            <div><div className="text-xs font-medium text-foreground">{pos.ticker}</div><div className="text-[10px] text-muted-foreground">{pos.name}</div></div>
                          </div>
                          <div className="text-right"><div className="text-xs font-bold text-gym">{getGainPct(pos) >= 0 ? '+' : ''}{getGainPct(pos).toFixed(2)}%</div><div className="text-[10px] text-gym">{getGain(pos) >= 0 ? '+' : ''}{getGain(pos).toFixed(2)}€</div></div>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                <Card className="glass-card border-destructive/20">
                  <CardHeader className="pb-2"><CardTitle className="text-destructive text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Peores performers</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {worstPerformers.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">Sin datos</p>
                      : worstPerformers.map(pos => (
                        <div key={pos.id} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg border border-destructive/10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-destructive/10 text-destructive">{pos.ticker?.slice(0, 3)}</div>
                            <div><div className="text-xs font-medium text-foreground">{pos.ticker}</div><div className="text-[10px] text-muted-foreground">{pos.name}</div></div>
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

        {/* Positions tab */}
        <TabsContent value="positions" className="space-y-3 mt-4">
          {positions.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-16 text-center"><Briefcase className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" /><p className="text-muted-foreground text-sm">Sin posiciones</p></CardContent></Card>
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
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color, border: `1px solid ${typeInfo.color}30` }}>{pos.ticker?.slice(0, 4)}</div>
                        <div>
                          <div className="font-semibold text-foreground text-sm flex items-center gap-2">{pos.ticker}{pos.current_price ? <span className="text-xs font-normal text-muted-foreground">{pos.current_price} {pos.currency}</span> : null}</div>
                          <div className="text-xs text-muted-foreground">{pos.name}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ color: typeInfo.color, borderColor: `${typeInfo.color}40` }}>{typeInfo.label}</Badge>
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
                        <div className="text-[10px] text-muted-foreground">{alloc.toFixed(1)}% del portafolio</div>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(alloc, 100)}%`, backgroundColor: typeInfo.color }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                      <span>Invertido: {(pos.invested_amount_eur || 0).toFixed(2)}€</span>
                      {pos.last_updated && <span>Act: {format(new Date(pos.last_updated), 'd MMM HH:mm', { locale: es })}</span>}
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openViewPos(pos)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors" title="Ver gráfico"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditPricePos(pos); setEditPriceForm({ current_price: pos.current_price || '', current_value_eur: pos.current_value_eur || '' }); setShowPriceEdit(true); }} className="p-1.5 text-muted-foreground hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" title="Editar precio"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditingPos(pos); setForm({ ...emptyForm(), ticker: pos.ticker, name: pos.name, investment_type: pos.investment_type, currency: pos.currency || 'EUR', sector: pos.sector || '', region: pos.region || '' }); setShowForm(true); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors" title="Añadir compra"><Plus className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setSellPos(pos); setSellAmount(''); setShowSellForm(true); }} className="p-1.5 text-muted-foreground hover:text-gym hover:bg-gym/10 rounded-lg transition-colors" title="Vender"><ArrowUpRight className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(pos.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Analysis tab */}
        <TabsContent value="analysis" className="space-y-4 mt-4">
          {positions.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-16 text-center"><BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" /><p className="text-muted-foreground text-sm">Sin datos para analizar</p></CardContent></Card>
          ) : (
            <>
              {sectorData.some(s => s.name !== 'Sin sector') && (
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-gold" /> Distribución por sector</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sectorData.map((s, i) => {
                        const pct = totalCurrentValue > 0 ? (s.value / totalCurrentValue) * 100 : 0;
                        return (
                          <div key={s.name} className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground w-28 truncate">{s.name}</div>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} /></div>
                            <div className="text-xs text-foreground font-medium w-10 text-right">{pct.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground w-16 text-right">{s.value.toFixed(0)}€</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {regionData.some(r => r.name !== 'Sin región') && (
                <Card className="glass-card">
                  <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-gold" /> Distribución geográfica</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {regionData.map((r, i) => {
                        const pct = totalCurrentValue > 0 ? (r.value / totalCurrentValue) * 100 : 0;
                        return (
                          <div key={r.name} className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground w-28 truncate">{r.name}</div>
                            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: REGION_COLORS[i % REGION_COLORS.length] }} /></div>
                            <div className="text-xs text-foreground font-medium w-10 text-right">{pct.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground w-16 text-right">{r.value.toFixed(0)}€</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="glass-card">
                <CardHeader className="pb-2"><CardTitle className="text-foreground text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-gold" /> Rendimiento por posición</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={positions.map((p, i) => ({ name: p.ticker, ganancia: +getGainPct(p).toFixed(2), color: POSITION_COLORS[i % POSITION_COLORS.length] }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={v => [`${v}%`, 'Rendimiento']} contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="ganancia" radius={[4, 4, 0, 0]}>
                        {positions.map((_, i) => <Cell key={i} fill={getGainPct(positions[i]) >= 0 ? '#34d399' : '#f87171'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* AI Advisor tab */}
        <TabsContent value="ai" className="mt-4">
          <AIAdvisorPanel
            positions={positions}
            totalInvested={totalInvested}
            totalCurrentValue={totalCurrentValue}
            totalGain={totalGain}
            totalGainPct={totalGainPct}
          />
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}

      {/* New/Edit position */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingPos(null); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setForm(emptyForm()); } }}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground">{editingPos ? `Añadir compra — ${editingPos.ticker}` : 'Nueva posición'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {!editingPos && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5 font-medium">🔍 Saldo disponible: <span className="text-gold">{dailyAvailable.toFixed(2)}€</span></div>
                <div className="flex gap-2">
                  <Input placeholder="Buscar por ticker o nombre" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="bg-background/50 border-border text-sm" />
                  <Button onClick={handleSearch} disabled={searchLoading} variant="outline" className="border-border px-3">{searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button>
                </div>
                {selectedResult && <div className="flex items-center gap-2 p-2 bg-gym/10 border border-gym/20 rounded-lg mt-2"><div className="w-2 h-2 rounded-full bg-gym" /><span className="text-xs text-gym">Seleccionado: <strong>{selectedResult.ticker}</strong> — {selectedResult.name}</span><button onClick={() => { setSelectedResult(null); setForm(f => ({ ...f, ticker: '', name: '', buy_price: '' })); }} className="ml-auto"><X className="w-3.5 h-3.5 text-muted-foreground" /></button></div>}
                {searchResults.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden mt-2">
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
                <SelectContent className="bg-card border-border">{INVESTMENT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
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

            <div><label className="text-xs text-muted-foreground mb-1 block">Descripción (opcional)</label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Notas adicionales..." className="bg-background/50 border-border text-sm" /></div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingPos(null); setForm(emptyForm()); }} className="flex-1 border-border text-sm">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 text-sm">Crear posición</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell dialog */}
      <Dialog open={showSellForm} onOpenChange={v => { if (!v) { setShowSellForm(false); setSellPos(null); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Vender {sellPos?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/20 rounded-lg text-xs text-muted-foreground">Valor actual: <span className="text-foreground font-medium">{(sellPos?.current_value_eur || sellPos?.invested_amount_eur || 0).toFixed(2)}€</span></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Cantidad a vender (€)</label><Input type="number" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder="0.00" className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Fecha de venta</label><Input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} className="bg-background/50 border-border" /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowSellForm(false); setSellPos(null); }} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleSell} className="flex-1 bg-gym/20 text-gym hover:bg-gym/30 border border-gym/30">Confirmar venta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price edit dialog */}
      <Dialog open={showPriceEdit} onOpenChange={v => { if (!v) { setShowPriceEdit(false); setEditPricePos(null); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Editar precio — {editPricePos?.ticker}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Precio actual ({editPricePos?.currency})</label><Input type="number" value={editPriceForm.current_price} onChange={e => setEditPriceForm(f => ({ ...f, current_price: e.target.value }))} placeholder="0.00" className="bg-background/50 border-border" /></div>
            <div><label className="text-xs text-muted-foreground mb-1.5 block">Valor actual (€)</label><Input type="number" value={editPriceForm.current_value_eur} onChange={e => setEditPriceForm(f => ({ ...f, current_value_eur: e.target.value }))} placeholder="0.00" className="bg-background/50 border-border" /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowPriceEdit(false); setEditPricePos(null); }} className="flex-1 border-border">Cancelar</Button>
              <Button onClick={handleSavePrice} className="flex-1 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View position chart */}
      <Dialog open={!!viewingPos} onOpenChange={v => { if (!v) { setViewingPos(null); setViewHistory([]); } }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{viewingPos?.ticker} — {viewingPos?.name}</DialogTitle></DialogHeader>
          <div className="py-2">
            {viewHistoryLoading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /></div>
            ) : viewHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={viewHistory}>
                  <defs><linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} /><stop offset="95%" stopColor="#d4af37" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="price" stroke="#d4af37" fill="url(#priceGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No hay historial disponible</p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-muted/20 rounded-lg"><div className="text-xs text-muted-foreground">Invertido</div><div className="font-semibold text-foreground">{(viewingPos?.invested_amount_eur || 0).toFixed(2)}€</div></div>
              <div className="p-3 bg-muted/20 rounded-lg"><div className="text-xs text-muted-foreground">Valor actual</div><div className="font-semibold text-foreground">{(viewingPos?.current_value_eur || viewingPos?.invested_amount_eur || 0).toFixed(2)}€</div></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle className="text-foreground">¿Eliminar posición?</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
