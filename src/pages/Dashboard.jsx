import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { Dumbbell, Wallet, CheckCircle2, Circle, StickyNote, CalendarDays } from 'lucide-react';
import UserMenu from '@/components/UserMenu';
import { format, startOfWeek, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

function getEventsForDate(events, date) {
  return events.filter(ev => {
    const start = new Date(ev.date);
    if (ev.date === format(date, 'yyyy-MM-dd')) return true;
    if (start > date) return false;
    const withinEnd = !ev.repeat_end_date || date <= new Date(ev.repeat_end_date);
    if (ev.repeat === 'daily') return withinEnd;
    if (ev.repeat === 'weekly') return withinEnd && start.getDay() === date.getDay();
    if (ev.repeat === 'custom_weekly') { const days = ev.repeat_days || []; return withinEnd && days.includes(date.getDay()); }
    if (ev.repeat === 'monthly') return withinEnd && start.getDate() === date.getDate();
    if (ev.repeat === 'yearly') {
      const yearLimit = ev.repeat_years ? start.getFullYear() + ev.repeat_years : null;
      const withinYears = !yearLimit || date.getFullYear() <= yearLimit;
      return withinYears && start.getMonth() === date.getMonth() && start.getDate() === date.getDate();
    }
    return false;
  });
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [events, setEvents] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [note, setNote] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const m = today.getMonth() + 1;
  const y = today.getFullYear();
  const ws = startOfWeek(today, { weekStartsOn: 1 });
  const we = endOfWeek(today, { weekStartsOn: 1 });

  useEffect(() => {
    Promise.all([
      base44.entities.WorkoutSession.list('-date', 100),
      base44.entities.FinanceTransaction.filter({ month: m, year: y }),
      base44.entities.MonthlyBudget.filter({ month: m, year: y }),
      base44.entities.CalendarEvent.list('-date', 500),
      base44.entities.ProjectTask.list('-created_date', 200),
      base44.entities.Note.list('-created_date', 1),
    ]).then(([s, t, b, ev, pt, notes]) => {
      setSessions(s);
      setTransactions(t);
      setBudgets(b);
      setEvents(ev);
      setProjectTasks(pt);
      if (notes[0]) { setNote(notes[0].content); setNoteId(notes[0].id); }
      setLoading(false);
    });
  }, []);

  // Stats
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return isWithinInterval(d, { start: ws, end: we });
  }).length;

  const totalIncome = transactions.filter(t => ['income', 'transfer_from_savings', 'transfer_from_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const totalOut = transactions.filter(t => ['expense', 'other', 'transfer_to_savings', 'transfer_to_investment'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const budget = budgets[0];
  const totalBudgetExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const budgetLeft = budget ? budget.amount - totalBudgetExpense : null;

  // Today's tasks (calendar + project tasks due today)
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayCalEvents = getEventsForDate(events, today).filter(e => e.event_type === 'task');
  const todayProjectTasks = projectTasks.filter(t => t.due_date === todayStr && !t.completed);

  // Week calendar
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(ws.getDate() + i);
    return d;
  });

  const handleNoteChange = (val) => {
    setNote(val);
  };

  const handleNoteSave = async () => {
    setNoteSaving(true);
    if (noteId) {
      await base44.entities.Note.update(noteId, { content: note });
    } else {
      const created = await base44.entities.Note.create({ content: note });
      setNoteId(created.id);
    }
    setNoteSaving(false);
  };

  const handleToggleCalTask = async (ev) => {
    await base44.entities.CalendarEvent.update(ev.id, { completed: !ev.completed });
    const evs = await base44.entities.CalendarEvent.list('-date', 500);
    setEvents(evs);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <UserMenu pageName="Dashboard" />
      <p className="text-muted-foreground text-sm capitalize -mt-2">{format(today, "EEEE d 'de' MMMM", { locale: es })}</p>

      {/* Top 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gym this week */}
        <Card className="glass-card border-gym/20 glow-green">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-gym" /> Gym esta semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-grotesk font-bold text-gym">{weekSessions}</p>
            <p className="text-xs text-muted-foreground mt-1">Entrenamientos registrados</p>
          </CardContent>
        </Card>

        {/* Budget left */}
        <Card className="glass-card border-finance/20 glow-blue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-finance" /> Presupuesto mensual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgetLeft !== null ? (
              <>
                <p className={`text-3xl font-grotesk font-bold ${budgetLeft >= 0 ? 'text-finance' : 'text-destructive'}`}>{budgetLeft.toFixed(0)}€</p>
                <p className="text-xs text-muted-foreground mt-1">Restante de {budget.amount}€</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-grotesk font-bold text-finance">—</p>
                <p className="text-xs text-muted-foreground mt-1">Sin presupuesto asignado</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's tasks */}
        <Card className="glass-card border-gold/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold" /> Tareas de hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-grotesk font-bold text-gold">{todayCalEvents.filter(e => !e.completed).length + todayProjectTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendientes hoy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today tasks detail */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold" /> Pendientes de hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayCalEvents.length === 0 && todayProjectTasks.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">¡Todo al día!</p>
            )}
            {todayCalEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-2">
                <button onClick={() => handleToggleCalTask(ev)}>
                  {ev.completed ? <CheckCircle2 className="w-4 h-4 text-gym" /> : <Circle className="w-4 h-4 text-gold" />}
                </button>
                <span className={`text-sm ${ev.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{ev.title}</span>
                <span className="text-xs text-muted-foreground ml-auto">📅 Tarea</span>
              </div>
            ))}
            {todayProjectTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-gold" />
                <span className="text-sm text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">📁 {t.project_name}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notepad */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-gold" /> Notas importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={note}
              onChange={e => handleNoteChange(e.target.value)}
              onBlur={handleNoteSave}
              placeholder="Escribe aquí lo que no quieres olvidar..."
              className="w-full h-36 bg-muted/20 border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {noteSaving && <p className="text-xs text-muted-foreground mt-1">Guardando...</p>}
          </CardContent>
        </Card>
      </div>

      {/* Weekly calendar */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-finance" /> Semana actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 overflow-x-auto min-w-0">
            {weekDays.map((day, i) => {
              const dayEvents = getEventsForDate(events, day);
              const daySessions = sessions.filter(s => s.date === format(day, 'yyyy-MM-dd'));
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className={`p-1 sm:p-2 rounded-xl border ${isToday ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE', { locale: es })}
                  </div>
                  <div className={`text-sm font-bold mb-1.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  {daySessions.length > 0 && <div className="w-2 h-2 rounded-full bg-gym mb-1" title="Entrenamiento" />}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div key={ev.id} className="text-[10px] px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: ev.color || '#60a5fa', opacity: ev.completed ? 0.4 : 1 }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
