import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const VIEW_MODES = ['week', 'month', 'year'];

function getEventsForDate(events, date) {
  return events.filter(ev => {
    const start = new Date(ev.date);
    const dateStr = format(date, 'yyyy-MM-dd');
    if (ev.date === dateStr) return true;
    if (start > date) return false;
    // Check end date / years limit
    const withinEnd = !ev.repeat_end_date || date <= new Date(ev.repeat_end_date);
    if (ev.repeat === 'daily') return withinEnd;
    if (ev.repeat === 'weekly') return withinEnd && start.getDay() === date.getDay();
    if (ev.repeat === 'custom_weekly') {
      const days = ev.repeat_days || [];
      return withinEnd && days.includes(date.getDay());
    }
    if (ev.repeat === 'monthly') return withinEnd && start.getDate() === date.getDate();
    if (ev.repeat === 'yearly') {
      const yearLimit = ev.repeat_years ? start.getFullYear() + ev.repeat_years : null;
      const withinYears = !yearLimit || date.getFullYear() <= yearLimit;
      return withinYears && start.getMonth() === date.getMonth() && start.getDate() === date.getDate();
    }
    return false;
  });
}

export default function CalendarView({ events, onDayClick, viewMode, setViewMode, currentDate, setCurrentDate }) {
  const today = new Date();

  const navigate = (dir) => {
    if (viewMode === 'month') setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else if (viewMode === 'year') setCurrentDate(new Date(currentDate.getFullYear() + dir, 0, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const title = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: es });
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, 'd MMM', { locale: es })} – ${format(we, 'd MMM yyyy', { locale: es })}`;
    }
    if (viewMode === 'year') return currentDate.getFullYear().toString();
    return format(currentDate, 'EEEE, d MMMM yyyy', { locale: es });
  };

  // MONTH VIEW
  const renderMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    return (
      <div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, i) => {
            const dayEvents = getEventsForDate(events, day);
            const isToday = isSameDay(day, today);
            const inMonth = isSameMonth(day, currentDate);
            return (
              <div key={i} onClick={() => onDayClick(day, dayEvents)}
                className={`min-h-[60px] p-1 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-border ${inMonth ? '' : 'opacity-30'} ${isToday ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/30'}`}>
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className="text-xs px-1 py-0.5 rounded truncate text-white"
                      style={{ backgroundColor: ev.color || '#60a5fa', opacity: ev.completed ? 0.5 : 1 }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-xs text-muted-foreground">+{dayEvents.length - 2}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // WEEK VIEW
  const renderWeek = () => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-8 min-w-[600px]">
          <div className="text-xs text-muted-foreground py-2 pr-2 text-right" />
          {days.map((day, i) => (
            <div key={i} className={`text-center py-2 text-xs font-medium ${isSameDay(day, today) ? 'text-primary' : 'text-muted-foreground'}`}>
              <div>{format(day, 'EEE', { locale: es })}</div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto ${isSameDay(day, today) ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-y-auto max-h-[500px]">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 min-w-[600px] border-t border-border/30">
              <div className="text-xs text-muted-foreground py-2 pr-2 text-right">{hour}:00</div>
              {days.map((day, i) => {
                const dayEvs = getEventsForDate(events, day).filter(ev => ev.start_time && parseInt(ev.start_time) === hour);
                return (
                  <div key={i} onClick={() => onDayClick(day, getEventsForDate(events, day))}
                    className={`min-h-[48px] border-l border-border/30 cursor-pointer hover:bg-muted/20 relative p-0.5 ${isSameDay(day, today) ? 'bg-primary/5' : ''}`}>
                    {dayEvs.map(ev => (
                      <div key={ev.id} className="text-xs px-1 py-0.5 rounded text-white mb-0.5 truncate"
                        style={{ backgroundColor: ev.color || '#60a5fa', opacity: ev.completed ? 0.5 : 1 }}>
                        {ev.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // YEAR VIEW
  const renderYear = () => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(currentDate.getFullYear(), i, 1));
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {months.map((month, mi) => {
          const ms = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
          const me = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
          const days = [];
          let d = ms;
          while (d <= me) { days.push(d); d = addDays(d, 1); }
          return (
            <div key={mi} className="border border-border rounded-xl p-2">
              <p className="text-xs font-medium text-foreground mb-2 capitalize">{format(month, 'MMMM', { locale: es })}</p>
              <div className="grid grid-cols-7 gap-px">
                {['L','M','X','J','V','S','D'].map(d => <div key={d} className="text-center text-[9px] text-muted-foreground">{d}</div>)}
                {days.map((day, i) => {
                  const dayEvs = getEventsForDate(events, day);
                  const inMonth = isSameMonth(day, month);
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={i} onClick={() => onDayClick(day, dayEvs)}
                      className={`h-5 w-full rounded-sm flex items-center justify-center cursor-pointer text-[9px] ${inMonth ? '' : 'opacity-20'} ${isToday ? 'bg-primary text-primary-foreground' : dayEvs.length > 0 && inMonth ? 'bg-finance/30' : 'hover:bg-muted/30'}`}>
                      {format(day, 'd')}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // DAY VIEW
  const renderDay = () => {
    const dayEvs = getEventsForDate(events, currentDate);
    return (
      <div className="space-y-2">
        {dayEvs.length === 0 && <p className="text-muted-foreground text-sm text-center py-10">Sin eventos este día</p>}
        {dayEvs.map(ev => (
          <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl border border-border" style={{ borderLeftColor: ev.color, borderLeftWidth: 3 }}>
            <div className="flex-1">
              <div className="font-medium text-foreground text-sm">{ev.title}</div>
              {ev.start_time && <div className="text-xs text-muted-foreground">{ev.start_time}{ev.end_time ? ` - ${ev.end_time}` : ''}</div>}
              {ev.description && <div className="text-xs text-muted-foreground mt-1">{ev.description}</div>}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${ev.color}20`, color: ev.color }}>
              {ev.event_type === 'task' ? 'Tarea' : 'Evento'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-grotesk font-semibold text-foreground text-sm capitalize min-w-[150px] text-center">{title()}</span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border ml-1">Hoy</button>
        </div>
        <div className="flex gap-1">
          {[['week','Semana'],['month','Mes'],['year','Año']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${viewMode === mode ? 'bg-finance/20 text-finance border border-finance/30' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {viewMode === 'month' && renderMonth()}
      {viewMode === 'week' && renderWeek()}
      {viewMode === 'year' && renderYear()}
    </div>
  );
}