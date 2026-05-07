import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const EVENT_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#e879f9', '#2dd4bf', '#f97316'];
const WEEK_DAYS = [
  { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 },
];

const defaultForm = (defaultDate) => ({
  title: '', description: '', event_type: 'event',
  date: format(defaultDate || new Date(), 'yyyy-MM-dd'),
  start_time: '', end_time: '', color: '#60a5fa',
  repeat: 'none', repeat_days: [], repeat_end_date: '', repeat_years: '', all_day: false,
});

export default function EventForm({ open, onClose, onSaved, editingEvent, defaultDate }) {
  const [form, setForm] = useState(defaultForm(defaultDate));

  useEffect(() => {
    if (editingEvent) {
      setForm({
        title: editingEvent.title || '',
        description: editingEvent.description || '',
        event_type: editingEvent.event_type || 'event',
        date: editingEvent.date || format(new Date(), 'yyyy-MM-dd'),
        start_time: editingEvent.start_time || '',
        end_time: editingEvent.end_time || '',
        color: editingEvent.color || '#60a5fa',
        repeat: editingEvent.repeat || 'none',
        repeat_days: editingEvent.repeat_days || [],
        repeat_end_date: editingEvent.repeat_end_date || '',
        repeat_years: editingEvent.repeat_years || '',
        all_day: editingEvent.all_day || false,
      });
    } else {
      setForm(defaultForm(defaultDate));
    }
  }, [editingEvent, open, defaultDate]);

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      repeat_days: f.repeat_days.includes(day)
        ? f.repeat_days.filter(d => d !== day)
        : [...f.repeat_days, day],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const data = {
      ...form,
      repeat_end_date: form.repeat_end_date || null,
      repeat_years: form.repeat_years ? parseInt(form.repeat_years) : null,
    };
    if (editingEvent) {
      await base44.entities.CalendarEvent.update(editingEvent.id, data);
    } else {
      await base44.entities.CalendarEvent.create(data);
    }
    onSaved();
    onClose();
  };

  const showEndDate = ['daily', 'weekly', 'custom_weekly', 'monthly'].includes(form.repeat);
  const showRepeatYears = form.repeat === 'yearly';
  const showRepeatDays = form.repeat === 'custom_weekly';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{editingEvent ? 'Editar' : 'Nuevo'} {form.event_type === 'task' ? 'tarea' : 'evento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-foreground">Tipo</Label>
            <div className="flex gap-2 mt-1">
              {[['event','Evento'],['task','Tarea']].map(([v, l]) => (
                <button key={v} onClick={() => setForm(f => ({...f, event_type: v}))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.event_type === v ? 'bg-finance/20 text-finance border-finance/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-foreground">Título</Label>
            <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Nombre del evento..." className="mt-1 bg-muted/30 border-border" />
          </div>
          <div>
            <Label className="text-foreground">Descripción (opcional)</Label>
            <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Descripción..." className="mt-1 bg-muted/30 border-border" />
          </div>
          <div>
            <Label className="text-foreground">Fecha</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
          </div>
          {form.event_type === 'event' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Hora inicio</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({...f, start_time: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
              </div>
              <div>
                <Label className="text-foreground">Hora fin</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({...f, end_time: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
              </div>
            </div>
          )}

          {/* Repeat */}
          <div>
            <Label className="text-foreground">Repetir</Label>
            <Select value={form.repeat} onValueChange={v => setForm(f => ({...f, repeat: v, repeat_days: [], repeat_end_date: '', repeat_years: ''}))}>
              <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="none">No repetir</SelectItem>
                <SelectItem value="daily">Cada día</SelectItem>
                <SelectItem value="weekly">Cada semana</SelectItem>
                <SelectItem value="custom_weekly">Días personalizados</SelectItem>
                <SelectItem value="monthly">Cada mes</SelectItem>
                <SelectItem value="yearly">Cada año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom weekly days */}
          {showRepeatDays && (
            <div>
              <Label className="text-foreground mb-2 block">Días de la semana</Label>
              <div className="flex gap-2">
                {WEEK_DAYS.map(({ label, value }) => (
                  <button key={value} onClick={() => toggleDay(value)}
                    className={`w-8 h-8 rounded-full text-xs font-medium border transition-all ${form.repeat_days.includes(value) ? 'bg-finance/20 text-finance border-finance/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End date for repeating events */}
          {showEndDate && (
            <div>
              <Label className="text-foreground">Hasta (opcional, vacío = siempre)</Label>
              <Input type="date" value={form.repeat_end_date} onChange={e => setForm(f => ({...f, repeat_end_date: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
          )}

          {/* Yearly: number of years or forever */}
          {showRepeatYears && (
            <div>
              <Label className="text-foreground">Número de años (vacío = siempre)</Label>
              <Input type="number" min="1" value={form.repeat_years} onChange={e => setForm(f => ({...f, repeat_years: e.target.value}))} placeholder="Ej: 5 (vacío = siempre)" className="mt-1 bg-muted/30 border-border" />
            </div>
          )}

          <div>
            <Label className="text-foreground mb-2 block">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.title.trim()} className="bg-finance text-white hover:bg-finance/90">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}