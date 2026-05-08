import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCategoryDotColor } from '@/lib/gymData';

export default function GymCalendar({ sessions, onDayClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date()); 

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(new Date(d));
    d = addDays(d, 1);
  }

  const today = new Date();

  const sessionsByDate = {};
  sessions.forEach(s => {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  });

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekSessionCount = weekDays.filter(d => sessionsByDate[format(d, 'yyyy-MM-dd')]?.length > 0).length;

  const monthSessions = sessions.filter(s => {
    const sd = new Date(s.date);
    return isSameMonth(sd, currentMonth);
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground font-grotesk">
            Calendario de entrenamientos
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <span><span className="font-bold text-gym">{weekSessionCount}</span> esta semana</span>
              <span><span className="font-bold text-gym">{monthSessions.length}</span> este mes</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-foreground capitalize w-28 text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 mb-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySessions = sessionsByDate[dateStr] || [];
            const hasSessions = daySessions.length > 0;
            const isToday = isSameDay(day, today);
            const inMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={i}
                onClick={() => hasSessions && onDayClick(day, daySessions)}
                className={[
                  'relative min-h-[44px] p-1.5 rounded-xl text-left transition-all',
                  !inMonth ? 'opacity-25' : '',
                  isToday ? 'ring-1 ring-primary/40 bg-primary/5' : '',
                  hasSessions ? 'cursor-pointer hover:bg-muted/20' : 'cursor-default',
                ].join(' ')}
              >
                <div className={[
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                ].join(' ')}>
                  {format(day, 'd')}
                </div>

                {hasSessions && (
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {daySessions.slice(0, 3).map((s, idx) => (
                      <div
                        key={idx}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getCategoryDotColor(s.category) }}
                        title={s.routine_name || s.category}
                      />
                    ))}
                    {daySessions.length > 3 && (
                      <div className="text-[9px] text-muted-foreground">+{daySessions.length - 3}</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#34d399' }} />
            Fuerza
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#60a5fa' }} />
            Cardio
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
            Deporte
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-5 h-5 rounded-full border border-primary/40 bg-primary/5 flex items-center justify-center text-[9px] text-primary">H</div>
            Hoy
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
