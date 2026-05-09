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
  ExternalLink, Map, Flag
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Constants ────────────────────────────────────────────────────────────────

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

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
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1200,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Busca en internet las últimas noticias sobre "${item}" (empresa, ETF, sector o índice). 
Dame las 6 noticias más recientes, incluyendo noticias no solo relevantes sino también del día a día de la empresa/sector.
Responde SOLO con JSON válido:
[{"title":"título","summary":"resumen 1-2 frases","date":"fecha o hace X días","sentiment":"positive|negative|neutral","source":"nombre medio","url":"url si tienes"}]`
          }],
        }),
      });
      const d = await res.json();
      const text = d.content?.map(b => b.type === 'text' ? b.text : '').join('') || '[]';
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

  // ── Call Claude API with web search ──────────────────────────────────────
  const callClaude = async (userMessage, history) => {
    const context = buildContext();
    const goals = (() => { try { return JSON.parse(localStorage.getItem('finance_goals') || '[]'); } catch { return []; } })();

    const systemPrompt = `Eres "Danc Finance", un asesor financiero personal de élite integrado en la app MyLife de Daniel. Tienes acceso completo a sus datos financieros en tiempo real.

${context}

## TUS CAPACIDADES
- Tienes acceso a internet mediante web_search. ÚSALO SIEMPRE que necesites datos actuales: precios, noticias, earnings, dividendos, análisis de mercado.
- Conoces el portafolio completo del usuario y todos sus datos financieros.
- Puedes crear planes financieros personalizados basados en sus datos reales.

## INSTRUCCIONES DE RESPUESTA
1. Responde SIEMPRE en español, con tono profesional pero cercano.
2. Usa los datos reales del portafolio en tus análisis — menciona tickers específicos, importes concretos.
3. Usa web_search para obtener datos actuales: cotizaciones, noticias, fechas de earnings, dividendos, análisis de mercado.
4. Para calendarios de earnings y dividendos: cuando encuentres fechas, inclúyelas con este formato EXACTO al final del mensaje (no en medio del texto):
   [CALENDARIO: {"title": "AAPL - Resultados Q2 2025", "date": "2025-07-29", "type": "earnings", "ticker": "AAPL"}]
   [CALENDARIO: {"title": "MSFT - Dividendo", "date": "2025-06-12", "type": "dividend", "amount": "0.75$/acción", "ticker": "MSFT"}]
5. Usa formato markdown: ## para secciones, ### para subsecciones, **negrita**, - para listas.
6. Sé directo y concreto. No repitas lo que ya has dicho. No pongas disclaimers largos.
7. Si el usuario menciona objetivos financieros, tenlos en cuenta en todos tus análisis.
8. Cuando hagas análisis del portafolio, siempre: (a) busca noticias actuales de los principales activos, (b) da recomendaciones accionables con importes concretos.
9. Para planificación financiera, crea planes con pasos concretos, fechas y cantidades.

## SOBRE EL USUARIO
${goals.length > 0 ? `Objetivos definidos:\n${goals.map(g => `- ${g.title}${g.target ? ` (meta: ${fmtMoney(parseFloat(g.target))})` : ''}${g.deadline ? ` para ${g.deadline}` : ''}`).join('\n')}` : 'Sin objetivos definidos aún.'}`;

    const messagesPayload = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    // Agentic loop for tool use
    let allSources = [];
    let currentMessages = messagesPayload;

    for (let iteration = 0; iteration < 5; iteration++) {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          system: systemPrompt,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: currentMessages,
        }),
      });

      const data = await res.json();
      if (!data.content) throw new Error('No content in response');

      const textBlocks = data.content.filter(b => b.type === 'text');
      const toolBlocks = data.content.filter(b => b.type === 'tool_use');

      // Extract sources from web results
      data.content.forEach(block => {
        if (block.type === 'tool_result' || (block.type === 'tool_use' && block.name === 'web_search')) {
          // Sources come from tool_result in the next turn
        }
      });

      if (data.stop_reason === 'end_turn' || toolBlocks.length === 0) {
        const finalText = textBlocks.map(b => b.text).join('');

        // Extract sources from any web_search results in the conversation
        const toolResults = currentMessages
          .filter(m => Array.isArray(m.content))
          .flatMap(m => m.content)
          .filter(b => b.type === 'tool_result');

        toolResults.forEach(tr => {
          if (Array.isArray(tr.content)) {
            tr.content.forEach(c => {
              if (c.type === 'text') {
                try {
                  const parsed = JSON.parse(c.text);
                  if (parsed.results) {
                    parsed.results.forEach(r => {
                      if (r.url && r.title) allSources.push({ url: r.url, title: r.title });
                    });
                  }
                } catch {}
              }
            });
          }
        });

        return { text: finalText, sources: allSources.slice(0, 5) };
      }

      // Handle tool use — add assistant message and tool results
      const assistantMsg = { role: 'assistant', content: data.content };
      const toolResults = toolBlocks.map(tb => ({
        type: 'tool_result',
        tool_use_id: tb.id,
        content: tb.input?.query ? `Búsqueda realizada: ${tb.input.query}` : 'Búsqueda completada',
      }));

      // Extract real search results from the response if available
      const webResultsMsg = { role: 'user', content: toolResults };
      currentMessages = [...currentMessages, assistantMsg, webResultsMsg];

      // Actually process tool results - the search happens server-side with web_search_20250305
      // The next iteration will have the results in the context
    }

    const finalRes = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: currentMessages,
      }),
    });
    const finalData = await finalRes.json();
    const finalText = (finalData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return { text: finalText, sources: allSources.slice(0, 5) };
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
          content: 'Error al conectar con la IA. Asegúrate de tener `VITE_ANTHROPIC_API_KEY` configurada en GitHub Secrets.',
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
        <TabsList className="bg-muted/30 w-full grid grid-cols-3">
          <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Bot className="w-3.5 h-3.5" /> Agente IA
          </TabsTrigger>
          <TabsTrigger value="news" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Newspaper className="w-3.5 h-3.5" /> Noticias
          </TabsTrigger>
          <TabsTrigger value="goals" className="text-xs data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1">
            <Target className="w-3.5 h-3.5" /> Objetivos
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
      </Tabs>
    </div>
  );
}
