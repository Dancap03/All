import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const TERM_CONFIG = {
  short: { label: 'Corto plazo', color: '#34d399', desc: '< 3 meses' },
  medium: { label: 'Medio plazo', color: '#60a5fa', desc: '3-12 meses' },
  long: { label: 'Largo plazo', color: '#fbbf24', desc: '> 1 año' },
};

export default function GoalsTab() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', term: 'short' });

  const fetchData = async () => {
    const g = await base44.entities.Goal.list('-created_date', 200);
    setGoals(g);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    await base44.entities.Goal.create({ ...form, completed: false });
    setShowForm(false);
    setForm({ title: '', description: '', term: 'short' });
    fetchData();
  };

  const handleToggle = async (goal) => {
    await base44.entities.Goal.update(goal.id, {
      completed: !goal.completed,
      completed_date: !goal.completed ? format(new Date(), 'yyyy-MM-dd') : null,
    });
    fetchData();
  };

  const handleDelete = async (id) => {
    await base44.entities.Goal.delete(id);
    fetchData();
  };

  const pending = goals.filter(g => !g.completed);
  const done = goals.filter(g => g.completed);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Metas</h3>
          <p className="text-xs text-muted-foreground">{pending.length} por conseguir · {done.length} conseguidas</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="h-8 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir meta
        </Button>
      </div>

      {/* Pending by term */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(TERM_CONFIG).map(([term, cfg]) => {
          const termGoals = pending.filter(g => g.term === term);
          return (
            <Card key={term} className="glass-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <CardTitle className="text-foreground text-sm">{cfg.label}</CardTitle>
                  <span className="text-xs text-muted-foreground ml-auto">{cfg.desc}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs" style={{ color: cfg.color }}>{termGoals.length} pendientes</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {termGoals.length === 0 && <p className="text-xs text-muted-foreground py-2">Sin metas</p>}
                {termGoals.map(goal => (
                  <div key={goal.id} className="flex items-start gap-2 group">
                    <button onClick={() => handleToggle(goal)} className="mt-0.5 shrink-0">
                      <Circle className="w-4 h-4" style={{ color: cfg.color }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground font-medium">{goal.title}</div>
                      {goal.description && <div className="text-xs text-muted-foreground">{goal.description}</div>}
                    </div>
                    <button onClick={() => handleDelete(goal.id)} className="hidden group-hover:block p-0.5 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <Card className="glass-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Metas conseguidas ({done.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {done.map(goal => {
              const cfg = TERM_CONFIG[goal.term] || TERM_CONFIG.short;
              return (
                <div key={goal.id} className="flex items-start gap-2 group opacity-60">
                  <button onClick={() => handleToggle(goal)} className="mt-0.5 shrink-0">
                    <CheckCircle2 className="w-4 h-4" style={{ color: cfg.color }} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-muted-foreground line-through">{goal.title}</div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                      {goal.completed_date && <span className="text-xs text-muted-foreground">· {format(new Date(goal.completed_date), 'd MMM yyyy', { locale: es })}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(goal.id)} className="hidden group-hover:block p-0.5 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Nueva meta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="¿Qué quieres conseguir?" className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Descripción (opcional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Detalles..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Plazo</Label>
              <Select value={form.term} onValueChange={v => setForm(f => ({...f, term: v}))}>
                <SelectTrigger className="mt-1 bg-muted/30 border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(TERM_CONFIG).map(([v, cfg]) => (
                    <SelectItem key={v} value={v}>{cfg.label} ({cfg.desc})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()} className="bg-primary text-primary-foreground">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}