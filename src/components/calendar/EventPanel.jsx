import React, { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const EVENT_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#e879f9', '#2dd4bf'];

function getEventsForDate(events, date) {
  if (!date) return [];
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

export default function EventPanel({ events, selectedDay, onRefresh, onEditEvent }) {
  const dayEvents = selectedDay ? getEventsForDate(events, selectedDay) : getEventsForDate(events, new Date());
  const displayDay = selectedDay || new Date();

  const handleToggleComplete = async (ev) => {
    await base44.entities.CalendarEvent.update(ev.id, { completed: !ev.completed });
    onRefresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.CalendarEvent.delete(id);
    onRefresh();
  };

  const tasks = dayEvents.filter(e => e.event_type === 'task');
  const eventsOnly = dayEvents.filter(e => e.event_type === 'event');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground capitalize">
          {format(displayDay, "EEEE d MMM", { locale: es })}
        </p>
        <Button size="sm" onClick={() => onEditEvent(null)} className="h-7 text-xs bg-finance/20 text-finance hover:bg-finance/30 border border-finance/30">
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
        </Button>
      </div>

      {dayEvents.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Sin eventos este día</p>
      )}

      {eventsOnly.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Eventos</p>
          {eventsOnly.sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')).map(ev => (
            <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border group">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{ev.title}</div>
                {ev.start_time && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {ev.start_time}{ev.end_time ? ` - ${ev.end_time}` : ''}
                  </div>
                )}
              </div>
              <div className="hidden group-hover:flex gap-1 shrink-0">
                <button onClick={() => onEditEvent(ev)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => handleDelete(ev.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Tareas</p>
          {tasks.map(ev => (
            <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border group">
              <button onClick={() => handleToggleComplete(ev)} className="mt-0.5 shrink-0">
                {ev.completed
                  ? <CheckCircle2 className="w-4 h-4 text-gym" />
                  : <Circle className="w-4 h-4 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${ev.completed ? 'line-through text-muted-foreground' : 'text-foreground'} truncate`}>{ev.title}</div>
                {ev.description && <div className="text-xs text-muted-foreground truncate">{ev.description}</div>}
              </div>
              <div className="hidden group-hover:flex gap-1 shrink-0">
                <button onClick={() => onEditEvent(ev)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => handleDelete(ev.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}