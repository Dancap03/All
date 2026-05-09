import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Send, User, TrendingUp, TrendingDown, RefreshCw,
  BarChart2, Globe, Shield, Zap, AlertTriangle, Sparkles,
  ChevronRight, DollarSign, PieChart
} from 'lucide-react';

// ─── Suggested prompts ────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: BarChart2, label: 'Análisis completo', prompt: 'Haz un análisis completo y profesional de mi portafolio de inversión. Evalúa diversificación, riesgo, rentabilidad y dame recomendaciones concretas.' },
  { icon: Shield, label: 'Evaluación de riesgo', prompt: 'Evalúa el riesgo de mi portafolio. ¿Qué activos tienen mayor riesgo? ¿Estoy bien diversificado? ¿Qué debería ajustar?' },
  { icon: Globe, label: 'Diversificación geográfica', prompt: 'Analiza la diversificación geográfica y sectorial de mi portafolio. ¿Hay concentraciones excesivas? ¿Qué regiones o sectores me faltan?' },
  { icon: TrendingUp, label: 'Mejores y peores', prompt: '¿Cuáles son mis mejores y peores inversiones? ¿Debería mantener, aumentar o reducir alguna posición?' },
  { icon: DollarSign, label: 'Optimización', prompt: 'Si tengo dinero nuevo para invertir, ¿cómo debería redistribuirlo entre mis posiciones actuales o añadir nuevas? Dame un plan concreto.' },
  { icon: PieChart, label: 'Benchmark vs mercado', prompt: '¿Cómo compara mi portafolio con el S&P 500 y el MSCI World en términos de rentabilidad y riesgo estimados?' },
];

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-finance/20 text-finance' : 'bg-gold/20 text-gold'}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-finance/10 border border-finance/20 text-foreground rounded-tr-sm'
          : 'bg-muted/20 border border-border text-foreground rounded-tl-sm'
      }`}>
        {msg.loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Analizando tu portafolio...</span>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            {msg.content.split('\n').map((line, i) => {
              // Render markdown-like formatting
              if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{line.slice(3)}</h3>;
              if (line.startsWith('### ')) return <h4 key={i} className="text-xs font-bold text-gold mt-2 mb-1 uppercase tracking-wide">{line.slice(4)}</h4>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-foreground">{line.slice(2, -2)}</p>;
              if (line.startsWith('- ') || line.startsWith('• ')) {
                return (
                  <div key={i} className="flex items-start gap-2 my-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold/60 mt-2 shrink-0" />
                    <span className="text-muted-foreground text-xs">{line.slice(2)}</span>
                  </div>
                );
              }
              if (line.match(/^\d+\./)) {
                return (
                  <div key={i} className="flex items-start gap-2 my-0.5">
                    <span className="text-gold font-bold text-xs w-5 shrink-0">{line.match(/^\d+/)[0]}.</span>
                    <span className="text-muted-foreground text-xs">{line.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                );
              }
              if (line.trim() === '') return <div key={i} className="h-2" />;
              // Bold inline
              const parts = line.split(/\*\*(.*?)\*\*/g);
              if (parts.length > 1) {
                return (
                  <p key={i} className="text-xs text-muted-foreground my-0.5">
                    {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-foreground font-semibold">{p}</strong> : p)}
                  </p>
                );
              }
              return <p key={i} className="text-xs text-muted-foreground my-0.5">{line}</p>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinanceAIAgent() {
  const [positions, setPositions] = useState([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    base44.entities.InvestmentPosition.list('-created_date', 100).then(p => {
      setPositions(p);
      setLoadingPositions(false);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Portfolio summary for context ──────────────────────────────────────────
  const buildPortfolioContext = () => {
    if (positions.length === 0) return 'El usuario no tiene posiciones de inversión aún.';

    const totalInvested = positions.reduce((s, p) => s + (p.invested_amount_eur || 0), 0);
    const totalValue = positions.reduce((s, p) => s + (p.current_value_eur || p.invested_amount_eur || 0), 0);
    const totalGain = totalValue - totalInvested;
    const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    const positionsList = positions.map(p => {
      const current = p.current_value_eur || p.invested_amount_eur || 0;
      const gain = current - (p.invested_amount_eur || 0);
      const gainP = p.invested_amount_eur ? (gain / p.invested_amount_eur) * 100 : 0;
      const weight = totalValue > 0 ? (current / totalValue) * 100 : 0;
      return `- ${p.ticker} (${p.name}): ${current.toFixed(2)}€ (${weight.toFixed(1)}% del portafolio), ganancia: ${gain >= 0 ? '+' : ''}${gainP.toFixed(2)}%, tipo: ${p.investment_type}${p.sector ? `, sector: ${p.sector}` : ''}${p.region ? `, región: ${p.region}` : ''}${p.current_price ? `, precio actual: ${p.current_price} ${p.currency}` : ''}`;
    }).join('\n');

    return `PORTAFOLIO DE INVERSIÓN:
Valor total: ${totalValue.toFixed(2)}€
Total invertido: ${totalInvested.toFixed(2)}€
Ganancia/Pérdida total: ${totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)}€ (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%)
Número de posiciones: ${positions.length}

POSICIONES:
${positionsList}`;
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async (customPrompt) => {
    const text = customPrompt || input.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text };
    const loadingMsg = { role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setSending(true);

    // Build conversation history for multi-turn
    const history = messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.content }));

    const portfolioContext = buildPortfolioContext();

    const systemPrompt = `Eres un asesor financiero profesional especializado en análisis de portafolios de inversión. Tu nombre es "Danc Finance AI".

Tienes acceso al portafolio actual del usuario:

${portfolioContext}

Directrices:
- Responde siempre en español
- Sé directo, profesional y concreto. No des rodeos.
- Usa datos reales del portafolio para fundamentar tus análisis
- Cuando identifiques riesgos o oportunidades, sé específico (menciona tickers concretos)
- Usa formato estructurado con encabezados (##), bullets (-) y negritas (**texto**) para mayor claridad
- Siempre añade un disclaimer al final si das recomendaciones de compra/venta
- Si el portafolio está vacío, sugiere cómo empezar a invertir
- Puedes hacer comparaciones con índices de referencia (S&P 500, MSCI World, etc.)
- Considera el contexto macroeconómico actual cuando sea relevante`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            ...history,
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await response.json();
      const reply = data?.content?.[0]?.text || 'No se pudo obtener respuesta. Verifica que tienes configurada la API key de Anthropic.';

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: reply },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Error de conexión con la IA. Asegúrate de que tienes configurada la variable `VITE_ANTHROPIC_API_KEY` en GitHub Secrets y que el build incluye las variables de entorno.' },
      ]);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleClear = () => { setMessages([]); };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <Card className="glass-card border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gold" />
              </div>
              <div>
                <div className="font-grotesk font-bold text-foreground flex items-center gap-2">
                  Danc Finance AI
                  <Badge className="text-[10px] bg-gold/20 text-gold border-gold/30 px-1.5 py-0" variant="outline">BETA</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Análisis profesional de tu portafolio con IA</div>
              </div>
            </div>
            {loadingPositions ? (
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-xs text-muted-foreground">
                {positions.length} posición{positions.length !== 1 ? 'es' : ''} en portafolio
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Portafolio vacío warning */}
      {!loadingPositions && positions.length === 0 && (
        <Card className="glass-card border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-xs text-yellow-500/80">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Sin posiciones en portafolio. El agente puede igualmente responder preguntas generales de inversión.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick prompts — solo si no hay conversación */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium px-1">Análisis rápidos:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
              <button key={label} onClick={() => handleSend(prompt)}
                className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl hover:bg-muted/30 hover:border-gold/30 transition-all text-left group">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
                  <Icon className="w-4 h-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">{label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{prompt.slice(0, 55)}...</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-gold/60 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      {messages.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
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
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Pregunta sobre tu portafolio, estrategia, riesgos..."
              className="bg-muted/30 border-border flex-1 text-sm"
              disabled={sending}
            />
            <Button onClick={() => handleSend()} disabled={sending || !input.trim()}
              className="bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 shrink-0">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {messages.length > 0 && (
            <div className="flex items-center justify-between mt-2">
              <button onClick={handleClear} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Limpiar conversación
              </button>
              <p className="text-[10px] text-muted-foreground/40">
                ⚠️ No es asesoramiento financiero oficial
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up prompts si hay conversación */}
      {messages.length > 0 && !sending && (
        <div className="flex flex-wrap gap-2">
          {[
            '¿Qué activos debería vender?',
            '¿Cómo reducir la volatilidad?',
            '¿Qué ETF me recomendarías añadir?',
            'Explícame más sobre el riesgo de concentración',
          ].map(p => (
            <button key={p} onClick={() => handleSend(p)}
              className="text-xs px-3 py-1.5 bg-muted/20 border border-border rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
