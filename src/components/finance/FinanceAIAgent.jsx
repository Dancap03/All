import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot, Send, User, TrendingUp, TrendingDown, RefreshCw,
  BarChart2, Globe, Shield, Zap, AlertTriangle, Sparkles,
  ChevronRight, DollarSign, PieChart, Target, Newspaper,
  Calendar, Plus, X, Check, BookOpen, Search, Bell,
  CalendarPlus, ArrowRight, Lightbulb, Clock, Trash2,
  ExternalLink, Map, Flag, Wallet, Briefcase, Layers,
  CreditCard, BadgePercent, Star, ChevronDown, ChevronUp,
  Building, Banknote, Landmark
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';


// ─── Gemini API helper ────────────────────────────────────────────────────────
const GEMINI_API = (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

async function callGemini(prompt, systemPrompt = '') {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt + '\n\n' + prompt }] });
  } else {
    contents.push({ role: 'user', parts: [{ text: prompt }] });
  }
  const res = await fetch(GEMINI_API(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiChat(history, userMessage, systemPrompt = '') {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY no configurada');
  const contents = [];
  // Inject system prompt as first user message if provided
  if (systemPrompt && history.length === 0) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Entendido. Estoy listo para ayudarte como Danc Finance AI.' }] });
  }
  // Add history
  for (const m of history) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const res = await fetch(GEMINI_API(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}


// ─── Constants ────────────────────────────────────────────────────────────────




// Prompts rápidos del agente
const QUICK_PROMPTS = [
  { icon: BarChart2,  label: 'Análisis completo',       prompt: 'Haz un análisis profesional completo de mi portafolio. Busca en internet el estado actual de cada empresa que tengo, evalúa diversificación, riesgo y rentabilidad, y dame recomendaciones concretas con datos actuales.' },
  { icon: Shield,     label: 'Riesgo y volatilidad',    prompt: 'Analiza el riesgo de mi portafolio con datos actuales del mercado. ¿Qué activos son más volátiles ahora mismo? ¿Cómo está el contexto macro? Dame un plan para reducir riesgo si es necesario.' },
  { icon: Map,        label: 'Plan financiero',         prompt: 'Con los datos de mi portafolio e inversiones, créame un plan financiero personalizado a 1, 3 y 5 años. Incluye objetivos de ahorro, estrategia de inversión y hitos concretos.' },
  { icon: Globe,      label: 'Diversificación',         prompt: 'Busca en internet los mejores ETFs y fondos indexados para diversificar mi portafolio. Dame opciones concretas con datos actuales de rentabilidad y comisiones.' },
  { icon: DollarSign, label: 'Próximos dividendos',     prompt: 'Busca en internet las próximas fechas de dividendos de todos los activos de mi portafolio. Dame las fechas exactas y los importes estimados para que los pueda añadir al calendario.' },
  { icon: Calendar,   label: 'Próximos reportes',       prompt: 'Busca en internet las próximas fechas de resultados trimestrales (earnings) de todas las empresas de mi portafolio. Dame fechas exactas y qué esperar en cada uno.' },
  { icon: Lightbulb,  label: 'Oportunidades',           prompt: 'Con el contexto del mercado actual, ¿qué oportunidades de inversión ves para mi perfil? Busca en internet tendencias, sectores en auge y activos con potencial.' },
  { icon: Flag,       label: 'Aclarar mis objetivos',   prompt: 'Quiero definir bien mis objetivos financieros. Pregúntame lo que necesites saber sobre mi situación (edad, ingresos, horizonte temporal, tolerancia al riesgo) y ayúdame a crear un plan de inversión personalizado.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCalendarEvents(text) {
  const regex = /\[CALENDARIO:\s*(\{[^}]+\})\]/g;
  const events = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      events.push(JSON.parse(match[1]));
    } catch {}
  }
  return events;
}

function cleanText(text) {
  return text.replace(/\[CALENDARIO:\s*\{[^}]+\}\]/g, '').trim();
}

function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

// ─── Render markdown inline ───────────────────────────────────────────────────

function RenderLine({ line }) {
  const parts = line.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return <span>{line}</span>;
  return <>{parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{p}</strong> : <span key={i}>{p}</span>)}</>;
}

function RenderContent({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.startsWith('## '))  return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1 border-b border-border/30 pb-1">{line.slice(3)}</h3>;
        if (line.startsWith('### ')) return <h4 key={i} className="text-xs font-bold text-gold mt-2 mb-0.5 uppercase tracking-wider">{line.slice(4)}</h4>;
        if (line.startsWith('#### ')) return <h5 key={i} className="text-xs font-semibold text-foreground mt-1.5 mb-0.5">{line.slice(5)}</h5>;
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} className="flex items-start gap-2 my-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gold/50 mt-[7px] shrink-0" />
            <span className="text-xs text-muted-foreground leading-relaxed"><RenderLine line={line.slice(2)} /></span>
          </div>
        );
        if (line.match(/^\d+\. /)) return (
          <div key={i} className="flex items-start gap-2 my-0.5">
            <span className="text-gold font-bold text-xs w-4 shrink-0 mt-0.5">{line.match(/^\d+/)[0]}.</span>
            <span className="text-xs text-muted-foreground leading-relaxed"><RenderLine line={line.replace(/^\d+\. /, '')} /></span>
          </div>
        );
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-gold/40 pl-3 text-xs text-muted-foreground/80 italic my-1"><RenderLine line={line.slice(2)} /></blockquote>;
        if (line.trim() === '' || line === '---') return <div key={i} className="h-1.5" />;
        return <p key={i} className="text-xs text-muted-foreground leading-relaxed"><RenderLine line={line} /></p>;
      })}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onSaveEvent, savedEvents }) {
  const isUser = msg.role === 'user';
  const cleanedText = cleanText(msg.content || '');
  const calEvents = msg.calendarEvents || [];

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-finance/20 text-finance' : 'bg-gold/20 text-gold'}`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[88%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-finance/10 border border-finance/20 text-foreground rounded-tr-sm'
            : 'bg-card border border-border text-foreground rounded-tl-sm shadow-sm'
        }`}>
          {msg.loading ? (
            <div className="flex items-center gap-2.5 text-muted-foreground py-1">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs">{msg.loadingText || 'Pensando...'}</span>
            </div>
          ) : (
            <RenderContent text={cleanedText} />
          )}
        </div>

        {/* Web sources */}
        {msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-w-full">
            {msg.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 bg-blue-400/5 border border-blue-400/20 rounded-full px-2 py-0.5 transition-colors">
                <ExternalLink className="w-2.5 h-2.5" />
                {s.title?.slice(0, 35) || s.url?.slice(0, 35)}{s.title?.length > 35 ? '...' : ''}
              </a>
            ))}
          </div>
        )}

        {/* Calendar events found */}
        {calEvents.length > 0 && (
          <div className="space-y-1.5 w-full">
            {calEvents.map((ev, i) => {
              const key = `${ev.title}-${ev.date}`;
              const saved = savedEvents.has(key);
              return (
                <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                  ev.type === 'dividend' ? 'bg-gym/5 border-gym/20' : 'bg-finance/5 border-finance/20'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${ev.type === 'dividend' ? 'bg-gym/20' : 'bg-finance/20'}`}>
                      {ev.type === 'dividend' ? <DollarSign className="w-3 h-3 text-gym" /> : <BarChart2 className="w-3 h-3 text-finance" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{ev.title}</div>
                      <div className="text-muted-foreground text-[10px]">{ev.date} · {ev.type === 'dividend' ? 'Dividendo' : 'Resultados'}{ev.amount ? ` · ${ev.amount}` : ''}</div>
                    </div>
                  </div>
                  <button onClick={() => onSaveEvent(ev, key)} disabled={saved}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium shrink-0 transition-all ${
                      saved ? 'bg-gym/20 text-gym border border-gym/30' : 'bg-muted/30 border border-border hover:bg-muted/50 text-muted-foreground'
                    }`}>
                    {saved ? <><Check className="w-3 h-3" /> Guardado</> : <><CalendarPlus className="w-3 h-3" /> Al calendario</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── News Panel ───────────────────────────────────────────────────────────────

function NewsPanel({ positions }) {
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('finance_news_watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [newItem, setNewItem] = useState('');
  const [news, setNews] = useState({});
  const [loading, setLoading] = useState({});

  const saveWatchlist = (list) => {
    setWatchlist(list);
    localStorage.setItem('finance_news_watchlist', JSON.stringify(list));
  };

  const addItem = () => {
    if (!newItem.trim() || watchlist.includes(newItem.trim().toUpperCase())) return;
    saveWatchlist([...watchlist, newItem.trim().toUpperCase()]);
    setNewItem('');
  };

  const removeItem = (item) => {
    saveWatchlist(watchlist.filter(w => w !== item));
    setNews(n => { const c = { ...n }; delete c[item]; return c; });
  };

  const fetchNews = async (item) => {
    setLoading(l => ({ ...l, [item]: true }));
    try {
      const prompt = `Dame las 6 noticias más recientes sobre "${item}" (empresa, ETF, sector o índice).
Responde SOLO con JSON válido, sin texto adicional ni bloques de código:
[{"title":"título","summary":"resumen 1-2 frases","date":"fecha o hace X días","sentiment":"positive|negative|neutral","source":"nombre medio","url":"url o null"}]`;
      const text = await callGemini(prompt);
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setNews(n => ({ ...n, [item]: Array.isArray(parsed) ? parsed : [] }));
    } catch {
      setNews(n => ({ ...n, [item]: [] }));
    }
    setLoading(l => ({ ...l, [item]: false }));
  };

  // Auto-populate from portfolio
  const addFromPortfolio = () => {
    const tickers = positions.map(p => p.ticker).filter(t => !watchlist.includes(t));
    if (tickers.length > 0) saveWatchlist([...watchlist, ...tickers]);
  };

  const SENTIMENT_COLOR = { positive: 'text-gym border-gym/30 bg-gym/5', negative: 'text-destructive border-destructive/30 bg-destructive/5', neutral: 'text-muted-foreground border-border bg-muted/10' };
  const SENTIMENT_ICON = { positive: '▲', negative: '▼', neutral: '◆' };

  return (
    <div className="space-y-4">
      {/* Add to watchlist */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold" /> Monitor de noticias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newItem} onChange={e => setNewItem(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Ticker, sector o empresa (AAPL, Tecnología...)"
              className="bg-muted/30 border-border text-sm" />
            <Button onClick={addItem} size="sm" className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {positions.length > 0 && (
            <button onClick={addFromPortfolio} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <ArrowRight className="w-3 h-3" /> Añadir todos mis activos del portafolio
            </button>
          )}

          {watchlist.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {watchlist.map(item => (
                <div key={item} className="flex items-center gap-1.5 bg-muted/20 border border-border rounded-full pl-3 pr-1.5 py-1">
                  <span className="text-xs text-foreground font-medium">{item}</span>
                  <button onClick={() => fetchNews(item)} disabled={loading[item]}
                    className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center hover:bg-gold/30 transition-colors">
                    {loading[item] ? <RefreshCw className="w-2.5 h-2.5 text-gold animate-spin" /> : <Search className="w-2.5 h-2.5 text-gold" />}
                  </button>
                  <button onClick={() => removeItem(item)} className="w-5 h-5 rounded-full hover:bg-destructive/20 flex items-center justify-center transition-colors">
                    <X className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <button onClick={() => watchlist.forEach(fetchNews)}
                className="text-xs px-3 py-1 bg-muted/20 border border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Actualizar todas
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* News by item */}
      {watchlist.map(item => (
        <div key={item} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-sm font-semibold text-foreground">{item}</h3>
            {loading[item] && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {!news[item] && !loading[item] && (
              <button onClick={() => fetchNews(item)} className="text-[10px] text-gold hover:underline">Cargar noticias</button>
            )}
          </div>

          {news[item]?.length > 0 ? (
            <div className="space-y-2">
              {news[item].map((n, i) => (
                <Card key={i} className={`glass-card border-l-2 ${
                  n.sentiment === 'positive' ? 'border-l-gym' : n.sentiment === 'negative' ? 'border-l-destructive' : 'border-l-muted-foreground/20'
                }`}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.summary}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/60">{n.source}</span>
                          <span className="text-[10px] text-muted-foreground/30">·</span>
                          <span className="text-[10px] text-muted-foreground/60">{n.date}</span>
                          {n.url && (
                            <a href={n.url} target="_blank" rel="noreferrer"
                              className="text-[10px] text-blue-400/70 hover:text-blue-400 flex items-center gap-0.5 transition-colors">
                              <ExternalLink className="w-2.5 h-2.5" /> Ver fuente
                            </a>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${SENTIMENT_COLOR[n.sentiment] || SENTIMENT_COLOR.neutral}`}>
                        {SENTIMENT_ICON[n.sentiment] || '◆'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : news[item] && !loading[item] ? (
            <Card className="glass-card">
              <CardContent className="py-4 text-center text-xs text-muted-foreground">Sin noticias encontradas para {item}</CardContent>
            </Card>
          ) : null}
        </div>
      ))}

      {watchlist.length === 0 && (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Newspaper className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Añade empresas, ETFs o sectores para monitorizar sus noticias</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Cualquier término — AAPL, NVDA, "Sector energía", "Bitcoin"...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Goals Panel ─────────────────────────────────────────────────────────────

function GoalsPanel({ onGoalChat }) {
  const [goals, setGoals] = useState(() => {
    const s = localStorage.getItem('finance_goals');
    return s ? JSON.parse(s) : [];
  });
  const [form, setForm] = useState({ title: '', target: '', deadline: '', notes: '' });
  const [showForm, setShowForm] = useState(false);

  const save = (list) => { setGoals(list); localStorage.setItem('finance_goals', JSON.stringify(list)); };

  const addGoal = () => {
    if (!form.title.trim()) return;
    save([...goals, { ...form, id: Date.now(), progress: 0, created: new Date().toISOString() }]);
    setForm({ title: '', target: '', deadline: '', notes: '' });
    setShowForm(false);
  };

  const deleteGoal = (id) => save(goals.filter(g => g.id !== id));

  const analyzeGoal = (goal) => {
    onGoalChat(`Analiza mi objetivo financiero: "${goal.title}". Meta: ${goal.target ? fmtMoney(parseFloat(goal.target)) : 'sin importe definido'}. Plazo: ${goal.deadline || 'sin fecha definida'}. Notas: ${goal.notes || 'ninguna'}. 
Dime si es realista según mi portafolio actual, qué tengo que hacer para conseguirlo y dame un plan de acción concreto con pasos mensuales.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Define tus objetivos financieros para que el agente los tenga en cuenta</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Nuevo objetivo
        </Button>
      </div>

      {showForm && (
        <Card className="glass-card border-gold/20">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Objetivo</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Alcanzar 50.000€ en inversiones, Vivir de dividendos..."
                  className="bg-muted/30 border-border text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Importe objetivo (€)</label>
                <Input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  placeholder="50000" className="bg-muted/30 border-border text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha límite</label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="bg-muted/30 border-border text-sm [color-scheme:dark]" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notas (tolerancia al riesgo, restricciones...)</label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Perfil conservador, no puedo invertir más de X€/mes..." className="bg-muted/30 border-border text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="border-border text-xs">Cancelar</Button>
              <Button size="sm" onClick={addGoal} disabled={!form.title.trim()} className="bg-gold text-black hover:bg-gold/90 text-xs">Guardar objetivo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {goals.length === 0 && !showForm ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Target className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Sin objetivos definidos</p>
            <p className="text-xs text-muted-foreground/60 mt-1">El agente usará tus objetivos para darte consejos más personalizados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {goals.map(g => (
            <Card key={g.id} className="glass-card hover:border-gold/20 transition-colors">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Flag className="w-3.5 h-3.5 text-gold shrink-0" />
                      <p className="text-sm font-medium text-foreground">{g.title}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {g.target && <span className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmtMoney(parseFloat(g.target))}</span>}
                      {g.deadline && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{g.deadline}</span>}
                    </div>
                    {g.notes && <p className="text-[10px] text-muted-foreground/60 mt-1">{g.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => analyzeGoal(g)} className="p-1.5 text-muted-foreground hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" title="Analizar con IA">
                      <Bot className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteGoal(g.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Carteras Panel ──────────────────────────────────────────────────────────

const PORTFOLIO_TYPES = [
  {
    id: 'conservative',
    name: 'Conservador',
    icon: Shield,
    color: '#34d399',
    risk: 2,
    return_range: '3–6%',
    horizon: '1–3 años',
    description: 'Capital preservado con crecimiento estable. Ideal si necesitas el dinero pronto o tienes poca tolerancia a pérdidas.',
    allocation: [
      { name: 'Bonos gobierno', pct: 40, color: '#34d399' },
      { name: 'Bonos corporativos', pct: 20, color: '#6ee7b7' },
      { name: 'ETF renta variable', pct: 20, color: '#60a5fa' },
      { name: 'Monetario', pct: 15, color: '#a78bfa' },
      { name: 'Oro', pct: 5, color: '#f59e0b' },
    ],
    examples: ['iShares € Govt Bond (IBGE)', 'Vanguard LifeStrategy 20%', 'PIMCO Euro Short Maturity', 'Xtrackers € Money Market'],
  },
  {
    id: 'moderate',
    name: 'Moderado',
    icon: BarChart2,
    color: '#60a5fa',
    risk: 3,
    return_range: '5–9%',
    horizon: '3–7 años',
    description: 'Equilibrio entre crecimiento y estabilidad. El más popular entre inversores particulares a largo plazo.',
    allocation: [
      { name: 'ETF Global (MSCI World)', pct: 40, color: '#60a5fa' },
      { name: 'Bonos mixtos', pct: 25, color: '#34d399' },
      { name: 'ETF Emergentes', pct: 15, color: '#f59e0b' },
      { name: 'REITs', pct: 10, color: '#fb923c' },
      { name: 'Oro/Commodities', pct: 10, color: '#a78bfa' },
    ],
    examples: ['Vanguard FTSE All-World (VWCE)', 'iShares Core MSCI World', 'Vanguard LifeStrategy 60%', 'iShares MSCI EM'],
  },
  {
    id: 'aggressive',
    name: 'Agresivo',
    icon: Zap,
    color: '#f59e0b',
    risk: 4,
    return_range: '8–15%',
    horizon: '7–15 años',
    description: 'Maximizar rentabilidad a largo plazo asumiendo mayor volatilidad. Para inversores con horizonte amplio.',
    allocation: [
      { name: 'ETF Global (MSCI World)', pct: 50, color: '#60a5fa' },
      { name: 'ETF Tecnología/Growth', pct: 20, color: '#a78bfa' },
      { name: 'ETF Emergentes', pct: 20, color: '#f59e0b' },
      { name: 'Small caps', pct: 10, color: '#fb923c' },
    ],
    examples: ['VWCE.DE', 'iShares NASDAQ-100 (CNDX)', 'Xtrackers MSCI Em. Markets', 'SPDR MSCI World Small Cap'],
  },
  {
    id: 'growth',
    name: 'Crecimiento',
    icon: TrendingUp,
    color: '#a78bfa',
    risk: 4,
    return_range: '10–20%',
    horizon: '10+ años',
    description: 'Concentrado en sectores de alto crecimiento: tecnología, IA, salud. Alta volatilidad, alto potencial.',
    allocation: [
      { name: 'Tecnología (NASDAQ)', pct: 35, color: '#a78bfa' },
      { name: 'Salud/Biotech', pct: 20, color: '#34d399' },
      { name: 'IA & Semiconductores', pct: 20, color: '#60a5fa' },
      { name: 'Energía limpia', pct: 15, color: '#f59e0b' },
      { name: 'Crypto (BTC/ETH)', pct: 10, color: '#fb923c' },
    ],
    examples: ['Invesco QQQ (NASDAQ-100)', 'ARK Innovation ETF', 'iShares Global Clean Energy', 'iShares Semiconductor'],
  },
  {
    id: 'dividend',
    name: 'Dividendos',
    icon: Banknote,
    color: '#34d399',
    risk: 2,
    return_range: '4–8% + dividendos',
    horizon: '5–15 años',
    description: 'Ingresos pasivos recurrentes. Empresas consolidadas que reparten dividendos estables. Ideal para libertad financiera.',
    allocation: [
      { name: 'ETF High Dividend', pct: 35, color: '#34d399' },
      { name: 'REITs / Inmobiliario', pct: 25, color: '#60a5fa' },
      { name: 'Utilities / Energía', pct: 20, color: '#f59e0b' },
      { name: 'Financieras europeas', pct: 20, color: '#a78bfa' },
    ],
    examples: ['Vanguard FTSE All-World High Div (VHYL)', 'iShares € Dividend', 'Realty Income (O)', 'Coca-Cola (KO)', 'LVMH'],
  },
  {
    id: 'allweather',
    name: 'All-Weather',
    icon: Globe,
    color: '#fb923c',
    risk: 2,
    return_range: '5–8%',
    horizon: '5+ años',
    description: 'Basada en Ray Dalio. Funciona en cualquier ciclo económico: inflación, deflación, crecimiento, recesión.',
    allocation: [
      { name: 'Acciones globales', pct: 30, color: '#60a5fa' },
      { name: 'Bonos largo plazo', pct: 40, color: '#34d399' },
      { name: 'Bonos medio plazo', pct: 15, color: '#6ee7b7' },
      { name: 'Oro', pct: 7.5, color: '#f59e0b' },
      { name: 'Materias primas', pct: 7.5, color: '#fb923c' },
    ],
    examples: ['VWCE.DE', 'iShares € Govt Bond 7-10yr', 'Xtrackers Physical Gold', 'iShares Commodities'],
  },
];

function RiskDots({ level }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full ${i <= level ? 'bg-gold' : 'bg-muted/40'}`} />
      ))}
    </div>
  );
}

function CarterasPanel({ onGoalChat, goals, positions }) {
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(null);

  const totalValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);

  const generatePersonalized = (type) => {
    setGenerating(type.id);
    const goalsText = goals.length > 0
      ? goals.map(g => `"${g.title}"${g.target ? ` (meta: ${fmtMoney(parseFloat(g.target))})` : ''}${g.deadline ? ` para ${g.deadline}` : ''}`).join(', ')
      : 'sin objetivos definidos';
    onGoalChat(
      `Genera una cartera personalizada de tipo "${type.name}" adaptada exactamente a mi situación. ` +
      `Mis objetivos: ${goalsText}. ` +
      `Portafolio actual: ${totalValue.toFixed(0)}€ en ${positions.length} posiciones. ` +
      `Busca en internet los mejores ETFs y activos para este tipo de cartera en ${new Date().getFullYear()}, con datos de rentabilidad, comisiones (TER) y liquidez actualizados. ` +
      `Dame una lista concreta de activos con porcentaje de asignación, ticker, broker donde comprarlos y por qué los elegiste. ` +
      `También dime qué cambios concretos debería hacer en mi portafolio actual para acercarme a esta cartera.`
    );
    setTimeout(() => setGenerating(null), 1000);
  };

  const compareWithCurrent = () => {
    onGoalChat(
      `Compara mi portafolio actual con los 6 tipos de cartera estándar (Conservador, Moderado, Agresivo, Crecimiento, Dividendos, All-Weather). ` +
      `Busca datos actuales del mercado. Dime: (1) a qué tipo se parece más mi cartera ahora, (2) cuál encaja mejor con mis objetivos, ` +
      `(3) qué ajustes concretos debería hacer para optimizarla, con tickers y porcentajes exactos.`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">Tipos de cartera según perfil de riesgo y objetivos</p>
        {positions.length > 0 && (
          <Button size="sm" onClick={compareWithCurrent}
            className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 text-xs gap-1">
            <BarChart2 className="w-3.5 h-3.5" /> Comparar con mi cartera
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PORTFOLIO_TYPES.map(type => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          return (
            <Card key={type.id}
              className={`glass-card cursor-pointer transition-all hover:border-opacity-60 ${isSelected ? 'border-gold/40 bg-gold/5' : 'hover:border-muted-foreground/30'}`}
              onClick={() => setSelected(isSelected ? null : type.id)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${type.color}20` }}>
                      <Icon className="w-4 h-4" style={{ color: type.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{type.name}</div>
                      <RiskDots level={type.risk} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: type.color }}>{type.return_range}</div>
                    <div className="text-[10px] text-muted-foreground">{type.horizon}</div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{type.description}</p>

                {/* Mini allocation bars */}
                <div className="space-y-1">
                  {type.allocation.map(a => (
                    <div key={a.name} className="flex items-center gap-2">
                      <div className="text-[10px] text-muted-foreground w-28 truncate">{a.name}</div>
                      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${a.pct}%`, backgroundColor: a.color }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground w-7 text-right">{a.pct}%</div>
                    </div>
                  ))}
                </div>

                {/* Expanded: examples + generate */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Ejemplos de activos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {type.examples.map(e => (
                          <Badge key={e} variant="outline" className="text-[10px] border-border text-muted-foreground">{e}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" onClick={(ev) => { ev.stopPropagation(); generatePersonalized(type); }}
                      disabled={generating === type.id}
                      className="w-full text-xs gap-1.5" style={{ backgroundColor: `${type.color}25`, color: type.color, borderColor: `${type.color}40`, border: '1px solid' }}>
                      {generating === type.id
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                        : <><Sparkles className="w-3.5 h-3.5" /> Generar cartera personalizada con IA</>}
                    </Button>
                  </div>
                )}

                {!isSelected && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <ChevronDown className="w-3 h-3" /> Toca para ver más
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {goals.length === 0 && (
        <Card className="glass-card border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-xs text-yellow-500/80">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Define tus objetivos en la pestaña "Objetivos" para que la IA genere carteras más personalizadas.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Nómina Panel ─────────────────────────────────────────────────────────────

const SALARY_RULES = [
  { name: 'Regla 50/30/20', desc: 'Necesidades 50% · Deseos 30% · Ahorro e inversión 20%', icon: BadgePercent },
  { name: 'Regla 70/20/10', desc: 'Gastos 70% · Ahorro 20% · Inversión/donación 10%', icon: Layers },
  { name: 'Pájaro tempranero', desc: 'Invierte primero (10% del bruto nada más cobrar) antes de gastar nada', icon: Star },
];

function NominaPanel({ onGoalChat, transactions, positions }) {
  const [salary, setSalary] = useState(() => {
    const s = localStorage.getItem('finance_salary');
    return s ? JSON.parse(s) : { net_monthly: '', extras: '', freelance: '', rent: '', loans: '' };
  });
  const [savedSalary, setSavedSalary] = useState(false);
  const [activeRule, setActiveRule] = useState(0);

  const saveSalary = () => {
    localStorage.setItem('finance_salary', JSON.stringify(salary));
    setSavedSalary(true);
    setTimeout(() => setSavedSalary(false), 2000);
  };

  const net = parseFloat(salary.net_monthly) || 0;
  const extras = parseFloat(salary.extras) || 0;
  const freelance = parseFloat(salary.freelance) || 0;
  const rent = parseFloat(salary.rent) || 0;
  const loans = parseFloat(salary.loans) || 0;
  const totalMonthly = net + freelance + (extras / 12);
  const fixedExpenses = rent + loans;
  const available = totalMonthly - fixedExpenses;

  // Calculate from transactions
  const recentExpenses = transactions
    .filter(t => t.type === 'expense')
    .slice(0, 100)
    .reduce((s, t) => s + (t.amount || 0), 0);
  const avgMonthlyExpense = transactions.length > 0 ? recentExpenses / Math.max(1, Math.ceil(transactions.length / 30)) : 0;
  const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);

  // 50/30/20 rule breakdown
  const rules = [
    { label: 'Necesidades (50%)', amount: totalMonthly * 0.5, color: '#60a5fa' },
    { label: 'Deseos (30%)', amount: totalMonthly * 0.3, color: '#a78bfa' },
    { label: 'Ahorro/Inversión (20%)', amount: totalMonthly * 0.2, color: '#34d399' },
  ];

  const generatePlan = () => {
    const salaryCtx = net > 0
      ? `Salario neto mensual: ${fmtMoney(net)}. ${extras > 0 ? `Pagas extra: ${fmtMoney(extras)}/año (${fmtMoney(extras/12)}/mes equiv.). ` : ''}${freelance > 0 ? `Ingresos freelance: ${fmtMoney(freelance)}/mes. ` : ''}${rent > 0 ? `Alquiler/hipoteca: ${fmtMoney(rent)}/mes. ` : ''}${loans > 0 ? `Préstamos: ${fmtMoney(loans)}/mes. ` : ''}Disponible tras gastos fijos: ${fmtMoney(available)}/mes.`
      : 'El usuario no ha definido aún su salario. Pregúntaselo.';
    onGoalChat(
      `Crea un plan financiero personalizado y detallado basado en mi nómina. ` +
      salaryCtx +
      ` Total invertido hasta ahora: ${fmtMoney(totalInvested)}. ` +
      `Busca en internet las mejores estrategias de ahorro e inversión para España en ${new Date().getFullYear()}, ` +
      `tipos de interés actuales de depósitos y cuentas remuneradas, y mejores opciones de inversión para mi perfil. ` +
      `El plan debe incluir: (1) distribución mensual óptima de mi nómina, (2) fondo de emergencia recomendado y cómo construirlo, ` +
      `(3) cuánto invertir mensualmente y en qué, (4) simulación a 1, 5 y 10 años con importes concretos, ` +
      `(5) optimización fiscal: deducciones, plan de pensiones, etc. Dame todo con importes en euros, no porcentajes.`
    );
  };

  const generateEmergencyFund = () => {
    onGoalChat(
      `¿Cuánto debería tener en mi fondo de emergencia según mi nómina de ${fmtMoney(net)}/mes y gastos fijos de ${fmtMoney(fixedExpenses)}/mes? ` +
      `¿Dónde es mejor tenerlo ahora mismo en España? Busca en internet las mejores cuentas remuneradas y depósitos a la vista disponibles hoy.`
    );
  };

  const generateTaxPlan = () => {
    onGoalChat(
      `Analiza cómo puedo optimizar mi fiscalidad con una nómina de ${fmtMoney(net)} netos/mes en España. ` +
      `Busca la normativa fiscal actual de ${new Date().getFullYear()}. ` +
      `Dime: deducciones en IRPF, plan de pensiones (¿me conviene?), deducción por vivienda si aplica, ` +
      `fiscalidad de mis inversiones actuales (${fmtMoney(totalInvested)} en cartera), y cómo declarar dividendos y plusvalías.`
    );
  };

  // Simulation data
  const monthlyInvest = totalMonthly * 0.2;
  const simData = monthlyInvest > 0 ? [1,2,3,4,5,6,7,8,9,10].map(y => {
    const base = totalInvested + monthlyInvest * 12 * y;
    const optimistic = totalInvested * Math.pow(1.08, y) + monthlyInvest * 12 * ((Math.pow(1.08, y) - 1) / 0.08);
    return { year: `Año ${y}`, base: +base.toFixed(0), optimistic: +optimistic.toFixed(0) };
  }) : [];

  return (
    <div className="space-y-4">

      {/* Salary input */}
      <Card className="glass-card border-gold/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Banknote className="w-4 h-4 text-gold" /> Mis ingresos y gastos fijos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">Salario neto/mes (€)</label>
              <Input type="number" value={salary.net_monthly}
                onChange={e => setSalary(s => ({ ...s, net_monthly: e.target.value }))}
                placeholder="2500" className="bg-muted/30 border-border text-sm h-9" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">Pagas extra/año (€)</label>
              <Input type="number" value={salary.extras}
                onChange={e => setSalary(s => ({ ...s, extras: e.target.value }))}
                placeholder="5000" className="bg-muted/30 border-border text-sm h-9" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">Freelance/mes (€)</label>
              <Input type="number" value={salary.freelance}
                onChange={e => setSalary(s => ({ ...s, freelance: e.target.value }))}
                placeholder="0" className="bg-muted/30 border-border text-sm h-9" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">Alquiler/hipoteca (€)</label>
              <Input type="number" value={salary.rent}
                onChange={e => setSalary(s => ({ ...s, rent: e.target.value }))}
                placeholder="800" className="bg-muted/30 border-border text-sm h-9" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wide">Préstamos/mes (€)</label>
              <Input type="number" value={salary.loans}
                onChange={e => setSalary(s => ({ ...s, loans: e.target.value }))}
                placeholder="0" className="bg-muted/30 border-border text-sm h-9" />
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={saveSalary} className={`w-full h-9 text-xs gap-1 transition-all ${savedSalary ? 'bg-gym/20 text-gym border-gym/30' : 'bg-gold/20 text-gold border-gold/30 hover:bg-gold/30'} border`}>
                {savedSalary ? <><Check className="w-3.5 h-3.5" /> Guardado</> : 'Guardar datos'}
              </Button>
            </div>
          </div>

          {totalMonthly > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: 'Ingresos/mes', value: fmtMoney(totalMonthly), color: 'text-gym' },
                { label: 'Gastos fijos/mes', value: fmtMoney(fixedExpenses), color: 'text-destructive' },
                { label: 'Disponible/mes', value: fmtMoney(available), color: available > 0 ? 'text-gold' : 'text-destructive' },
              ].map(s => (
                <div key={s.label} className="bg-muted/20 rounded-lg px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reglas financieras */}
      {totalMonthly > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Landmark className="w-4 h-4 text-gold" /> Reglas de distribución del dinero
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {SALARY_RULES.map((r, i) => (
                <button key={r.name} onClick={() => setActiveRule(i)}
                  className={`px-3 py-1.5 rounded-xl border text-xs transition-all ${activeRule === i ? 'bg-gold/20 text-gold border-gold/40' : 'bg-muted/20 border-border text-muted-foreground hover:text-foreground'}`}>
                  {r.name}
                </button>
              ))}
            </div>

            {activeRule === 0 && (
              <div className="space-y-2">
                {rules.map(r => (
                  <div key={r.label} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-xs text-muted-foreground">{r.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{fmtMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {activeRule === 1 && (
              <div className="space-y-2">
                {[
                  { label: 'Gastos totales (70%)', amount: totalMonthly * 0.7, color: '#60a5fa' },
                  { label: 'Ahorro (20%)', amount: totalMonthly * 0.2, color: '#34d399' },
                  { label: 'Inversión/donación (10%)', amount: totalMonthly * 0.1, color: '#f59e0b' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-xs text-muted-foreground">{r.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{fmtMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {activeRule === 2 && (
              <div className="p-3 bg-gold/5 border border-gold/20 rounded-xl text-xs text-muted-foreground space-y-1">
                <p className="text-gold font-medium">💡 Pájaro tempranero</p>
                <p>Nada más cobrar, transfiere <strong className="text-foreground">{fmtMoney(totalMonthly * 0.1)}/mes</strong> (10%) directamente a inversión antes de pagar nada más.</p>
                <p>En 10 años a 8% anual: <strong className="text-gym">{fmtMoney(totalMonthly * 0.1 * 12 * ((Math.pow(1.08, 10) - 1) / 0.08))}</strong></p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Simulation chart */}
      {simData.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" /> Simulación a 10 años (invirtiendo el 20% de la nómina)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1"><div className="w-3 h-1.5 rounded bg-muted-foreground/40" /> Sin rentabilidad</div>
              <div className="flex items-center gap-1"><div className="w-3 h-1.5 rounded bg-gold" /> Con 8% anual</div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={simData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k€`} />
                <ReTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  formatter={(v, n) => [fmtMoney(v), n === 'base' ? 'Sin rentabilidad' : 'Con 8%/año']}
                />
                <Bar dataKey="base" fill="#374151" radius={[3,3,0,0]} />
                <Bar dataKey="optimistic" fill="#f59e0b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          { label: 'Plan financiero completo', desc: 'Distribución de nómina + inversión + simulación', icon: Map, action: generatePlan },
          { label: 'Fondo de emergencia', desc: 'Cuánto y dónde guardarlo ahora en España', icon: Shield, action: generateEmergencyFund },
          { label: 'Optimización fiscal', desc: 'IRPF, plan de pensiones, fiscalidad inversiones', icon: Landmark, action: generateTaxPlan },
        ].map(({ label, desc, icon: Icon, action }) => (
          <button key={label} onClick={action} disabled={net === 0}
            className="flex items-start gap-3 p-3 bg-muted/20 border border-border rounded-xl hover:bg-muted/30 hover:border-gold/30 transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
              <Icon className="w-4 h-4 text-gold" />
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">{label}</div>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">{desc}</div>
            </div>
          </button>
        ))}
      </div>

      {net === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center">Introduce tu salario neto mensual para activar los planes financieros con IA</p>
      )}
    </div>
  );
}

// ─── Main Agent Component ─────────────────────────────────────────────────────

export default function FinanceAIAgent() {
  const [positions, setPositions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [savedEvents, setSavedEvents] = useState(new Set());
  const [activeTab, setActiveTab] = useState('chat');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load all financial data
  useEffect(() => {
    Promise.all([
      base44.entities.InvestmentPosition.list('-created_date', 200),
      base44.entities.FinanceTransaction.list('-date', 500),
      base44.entities.MonthlyBudget.list('-year', 24),
    ]).then(([pos, txs, bud]) => {
      setPositions(pos);
      setTransactions(txs);
      setBudgets(bud);
      setLoadingData(false);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Build full financial context ──────────────────────────────────────────
  const buildContext = useCallback(() => {
    const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
    const totalValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
    const totalGain = totalValue - totalInvested;

    const goals = (() => { try { return JSON.parse(localStorage.getItem('finance_goals') || '[]'); } catch { return []; } })();

    // Last 3 months of transactions summary
    const now = new Date();
    const recentTxs = transactions.slice(0, 200);
    const income = recentTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = recentTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const savedAmount = recentTxs.filter(t => t.type === 'transfer_to_savings').reduce((s, t) => s + (t.amount || 0), 0);

    const posCtx = positions.length > 0
      ? positions.map(p => {
          const val = p.current_value_eur || p.invested_amount_eur || 0;
          const gain = val - (p.invested_amount_eur || 0);
          const gainPct = p.invested_amount_eur ? (gain / p.invested_amount_eur * 100).toFixed(2) : '0';
          const weight = totalValue > 0 ? (val / totalValue * 100).toFixed(1) : '0';
          return `  • ${p.ticker} (${p.name}): valor ${val.toFixed(2)}€ | peso ${weight}% | G/P ${gain >= 0 ? '+' : ''}${gain.toFixed(2)}€ (${gainPct}%) | tipo: ${p.investment_type}${p.sector ? ` | sector: ${p.sector}` : ''}${p.region ? ` | región: ${p.region}` : ''}${p.current_price ? ` | precio: ${p.current_price} ${p.currency}` : ''}`;
        }).join('\n')
      : '  Sin posiciones de inversión';

    const goalsCtx = goals.length > 0
      ? goals.map(g => `  • ${g.title}${g.target ? ` — meta: ${fmtMoney(parseFloat(g.target))}` : ''}${g.deadline ? ` — plazo: ${g.deadline}` : ''}${g.notes ? ` — notas: ${g.notes}` : ''}`).join('\n')
      : '  Sin objetivos definidos';

    return `## DATOS FINANCIEROS PERSONALES DEL USUARIO

### PORTAFOLIO DE INVERSIÓN
Valor total: ${totalValue.toFixed(2)}€ | Invertido: ${totalInvested.toFixed(2)}€ | G/P total: ${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)}€ (${totalInvested > 0 ? (totalGain / totalInvested * 100).toFixed(2) : 0}%) | Posiciones: ${positions.length}

${posCtx}

### FLUJO DE CAJA (datos disponibles)
Ingresos registrados: ${income.toFixed(2)}€ | Gastos registrados: ${expenses.toFixed(2)}€ | Ahorros transferidos: ${savedAmount.toFixed(2)}€

### OBJETIVOS FINANCIEROS
${goalsCtx}`;
  }, [positions, transactions, budgets]);

  // ── Call Gemini API ──────────────────────────────────────────────────────
  const callClaude = async (userMessage, history) => {
    const context = buildContext();
    const goals = (() => { try { return JSON.parse(localStorage.getItem('finance_goals') || '[]'); } catch { return []; } })();

    const systemPrompt = `Eres "Danc Finance", un asesor financiero personal de élite integrado en la app MyLife de Daniel.

${context}

## TUS CAPACIDADES
- Conoces el portafolio completo del usuario y todos sus datos financieros.
- Puedes crear planes financieros personalizados basados en sus datos reales.
- Tu conocimiento llega hasta principios de 2025.

## INSTRUCCIONES DE RESPUESTA
1. Responde SIEMPRE en español, con tono profesional pero cercano.
2. Usa los datos reales del portafolio en tus análisis — menciona tickers específicos, importes concretos.
3. Para calendarios de earnings y dividendos, incluye eventos con este formato EXACTO al final:
   [CALENDARIO: {"title": "AAPL - Resultados Q2 2025", "date": "2025-07-29", "type": "earnings", "ticker": "AAPL"}]
4. Usa formato markdown: ## para secciones, ### para subsecciones, **negrita**, - para listas.
5. Sé directo y concreto. No repitas lo que ya has dicho.
6. Para planificación financiera, crea planes con pasos concretos, fechas y cantidades.

## SOBRE EL USUARIO
${goals.length > 0 ? `Objetivos definidos:\n${goals.map(g => `- ${g.title}${g.target ? ` (meta: ${fmtMoney(parseFloat(g.target))})` : ''}${g.deadline ? ` para ${g.deadline}` : ''}`).join('\n')}` : 'Sin objetivos definidos aún.'}`;

    const reply = await callGeminiChat(history, userMessage, systemPrompt);
    return { text: reply, sources: [] };
  };

    // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (customPrompt) => {
    const text = (customPrompt || input).trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    if (activeTab !== 'chat') setActiveTab('chat');

    const loadingTexts = [
      'Buscando en internet...',
      'Analizando tu portafolio...',
      'Consultando datos del mercado...',
      'Preparando análisis personalizado...',
    ];
    let loadingIdx = 0;
    const loadingMsg = { role: 'assistant', content: '', loading: true, loadingText: loadingTexts[0] };

    setMessages(prev => [...prev, { role: 'user', content: text }, loadingMsg]);

    // Rotate loading text
    const interval = setInterval(() => {
      loadingIdx = (loadingIdx + 1) % loadingTexts.length;
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.loading) copy[copy.length - 1] = { ...last, loadingText: loadingTexts[loadingIdx] };
        return copy;
      });
    }, 2000);

    try {
      const history = messages.filter(m => !m.loading).map(m => ({ role: m.role, content: m.content }));
      const { text: reply, sources } = await callClaude(text, history);
      const calendarEvents = parseCalendarEvents(reply);

      clearInterval(interval);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: reply, sources, calendarEvents },
      ]);
    } catch (err) {
      clearInterval(interval);
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: `Error al conectar con la IA: ${err.message || 'Asegúrate de tener VITE_GEMINI_API_KEY en GitHub Secrets y haber vuelto a hacer deploy.'}`,
          sources: [],
          calendarEvents: [],
        },
      ]);
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleGoalChat = (prompt) => {
    setActiveTab('chat');
    setTimeout(() => handleSend(prompt), 100);
  };

  // ── Save calendar event ───────────────────────────────────────────────────
  const handleSaveEvent = async (ev, key) => {
    try {
      await base44.entities.CalendarEvent.create({
        title: ev.title,
        date: ev.date,
        start_time: ev.date,
        end_time: ev.date,
        all_day: true,
        category: ev.type === 'dividend' ? 'finance' : 'reminder',
        description: `${ev.type === 'dividend' ? '💰 Dividendo' : '📊 Resultados'} · ${ev.ticker || ''}${ev.amount ? ` · ${ev.amount}` : ''}`,
        color: ev.type === 'dividend' ? '#34d399' : '#60a5fa',
      });
      setSavedEvents(prev => new Set([...prev, key]));
    } catch (e) {
      console.error('Error saving calendar event:', e);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const FOLLOW_UPS = [
    '¿Cuáles son los próximos dividendos de mi portafolio?',
    '¿Cómo está el mercado hoy?',
    '¿Qué debería hacer con [activo] ahora mismo?',
    '¿Puedes hacer un plan mensual de ahorro?',
  ];

  return (
    <div className="space-y-4">

      {/* Agent header */}
      <Card className="glass-card border-gold/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center border border-gold/20">
                <Sparkles className="w-5 h-5 text-gold" />
              </div>
              <div>
                <div className="font-grotesk font-bold text-foreground flex items-center gap-2">
                  Danc Finance AI
                  <Badge className="text-[10px] bg-gym/20 text-gym border-gym/30 px-1.5 py-0" variant="outline">
                    🌐 Web Search
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">Asesor financiero personal · Busca en internet en tiempo real</div>
              </div>
            </div>
            {loadingData ? (
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-xs text-right text-muted-foreground">
                <div>{positions.length} posiciones · {(positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0)).toFixed(0)}€</div>
                <div className="text-[10px] text-muted-foreground/50">{transactions.length} transacciones cargadas</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/30 w-full grid grid-cols-5">
          <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Bot className="w-3.5 h-3.5" /><span className="hidden sm:inline">Agente</span>
          </TabsTrigger>
          <TabsTrigger value="news" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Newspaper className="w-3.5 h-3.5" /><span className="hidden sm:inline">Noticias</span>
          </TabsTrigger>
          <TabsTrigger value="goals" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Target className="w-3.5 h-3.5" /><span className="hidden sm:inline">Objetivos</span>
          </TabsTrigger>
          <TabsTrigger value="portfolios" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Briefcase className="w-3.5 h-3.5" /><span className="hidden sm:inline">Carteras</span>
          </TabsTrigger>
          <TabsTrigger value="salary" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Banknote className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nómina</span>
          </TabsTrigger>
        </TabsList>

        {/* ── CHAT TAB ── */}
        <TabsContent value="chat" className="space-y-4 mt-4">

          {/* Quick prompts */}
          {messages.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <button key={label} onClick={() => handleSend(prompt)} disabled={loadingData}
                  className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl hover:bg-muted/30 hover:border-gold/30 transition-all text-left group disabled:opacity-50">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
                    <Icon className="w-4 h-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">{label}</div>
                    <div className="text-[10px] text-muted-foreground/60 truncate">{prompt.slice(0, 60)}...</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-gold/50 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="space-y-5 max-h-[520px] overflow-y-auto pr-1 scroll-smooth">
                  {messages.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} onSaveEvent={handleSaveEvent} savedEvents={savedEvents} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Input */}
          <Card className="glass-card">
            <CardContent className="pt-3 pb-3">
              <div className="flex gap-2">
                <Input ref={inputRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Pregunta sobre tu portafolio, mercado, dividendos, planificación..."
                  className="bg-muted/30 border-border flex-1 text-sm" disabled={sending || loadingData} />
                <Button onClick={() => handleSend()} disabled={sending || !input.trim() || loadingData}
                  className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 shrink-0">
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-gym animate-pulse" />
                  <span className="text-[10px] text-muted-foreground/50">Conectado · Búsqueda web en tiempo real</span>
                </div>
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                    Limpiar chat
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Follow-up suggestions */}
          {messages.length > 0 && !sending && (
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UPS.map(p => (
                <button key={p} onClick={() => handleSend(p)}
                  className="text-xs px-3 py-1.5 bg-muted/20 border border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                  {p}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── NEWS TAB ── */}
        <TabsContent value="news" className="mt-4">
          <NewsPanel positions={positions} />
        </TabsContent>

        {/* ── GOALS TAB ── */}
        <TabsContent value="goals" className="mt-4">
          <GoalsPanel onGoalChat={handleGoalChat} />
        </TabsContent>

        {/* ── PORTFOLIOS TAB ── */}
        <TabsContent value="portfolios" className="mt-4">
          <CarterasPanel
            onGoalChat={handleGoalChat}
            goals={(() => { try { return JSON.parse(localStorage.getItem('finance_goals') || '[]'); } catch { return []; } })()}
            positions={positions}
          />
        </TabsContent>

        {/* ── SALARY TAB ── */}
        <TabsContent value="salary" className="mt-4">
          <NominaPanel
            onGoalChat={handleGoalChat}
            transactions={transactions}
            positions={positions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
