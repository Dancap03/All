import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Dumbbell, Activity, Trophy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategoryLabel, getCategoryColor, MUSCLE_GROUPS, STRENGTH_EXERCISES, CARDIO_EXERCISES, SPORTS } from '@/lib/gymData';

const CATEGORIES = [
  { id: 'strength', label: 'Fuerza', icon: Dumbbell },
  { id: 'cardio', label: 'Cardio', icon: Activity },
  { id: 'sport', label: 'Deporte', icon: Trophy },
];

const defaultForm = () => ({
  name: '',
  category: 'strength',
  exercises: [],
  cardio_type: '',
  cardio_unit: '',
  sport_type: '',
});

export default function RoutineForm({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(defaultForm());
  const [addingMuscle, setAddingMuscle] = useState('');

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        category: initialData.category || 'strength',
        exercises: initialData.exercises || [],
        cardio_type: initialData.cardio_type || '',
        cardio_unit: initialData.cardio_unit || '',
        sport_type: initialData.sport_type || '',
      });
    } else {
      setForm(defaultForm());
    }
    setAddingMuscle('');
  }, [initialData, open]);

  const handleAddExercise = (name, muscleGroup) => {
    if (form.exercises.find(e => e.name === name)) return;
    setForm(f => ({
      ...f,
      exercises: [...f.exercises, { id: Date.now().toString(), name, muscle_group: muscleGroup }],
    }));
    setAddingMuscle('');
  };

  const handleRemoveExercise = (id) => {
    setForm(f => ({ ...f, exercises: f.exercises.filter(e => e.id !== id) }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  const cardioEx = CARDIO_EXERCISES.find(c => c.label === form.cardio_type);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-grotesk">
            {initialData ? 'Editar rutina' : 'Nueva rutina'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label className="text-foreground">Nombre de la rutina</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Push Day, Cardio mañana..."
              className="mt-1 bg-muted/30 border-border"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-foreground mb-2 block">Categoría</Label>
            <div className="flex gap-2">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setForm(f => ({ ...f, category: id, exercises: [], cardio_type: '', sport_type: '' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                    form.category === id
                      ? 'bg-gym/20 text-gym border-gym/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* STRENGTH: exercise list */}
          {form.category === 'strength' && (
            <div className="space-y-3">
              <Label className="text-foreground">Ejercicios</Label>
              {form.exercises.length > 0 && (
                <div className="space-y-1.5">
                  {form.exercises.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg border border-border">
                      <div>
                        <span className="text-sm text-foreground">{ex.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {MUSCLE_GROUPS.find(m => m.id === ex.muscle_group)?.label}
                        </span>
                      </div>
                      <button onClick={() => handleRemoveExercise(ex.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add exercise by muscle group */}
              <div className="border border-dashed border-border rounded-xl p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Añadir ejercicio por grupo muscular:</p>
                <div className="flex flex-wrap gap-1.5">
                  {MUSCLE_GROUPS.map(mg => (
                    <button
                      key={mg.id}
                      onClick={() => setAddingMuscle(addingMuscle === mg.id ? '' : mg.id)}
                      className={`px-2 py-1 rounded-lg text-xs border transition-all ${
                        addingMuscle === mg.id
                          ? 'bg-gym/20 border-gym/50 text-gym'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mg.label}
                    </button>
                  ))}
                </div>
                {addingMuscle && (
                  <div className="max-h-40 overflow-y-auto space-y-0.5 mt-2">
                    {(STRENGTH_EXERCISES[addingMuscle] || []).map(ex => (
                      <button
                        key={ex}
                        onClick={() => handleAddExercise(ex, addingMuscle)}
                        disabled={!!form.exercises.find(e => e.name === ex)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/40 text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CARDIO */}
          {form.category === 'cardio' && (
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Tipo de cardio</Label>
                <Select value={form.cardio_type} onValueChange={v => {
                  const ex = CARDIO_EXERCISES.find(c => c.label === v);
                  setForm(f => ({ ...f, cardio_type: v, cardio_unit: ex?.unit || '' }));
                }}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border">
                    <SelectValue placeholder="Selecciona tipo..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CARDIO_EXERCISES.map(c => (
                      <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cardioEx && (
                  <p className="text-xs text-muted-foreground mt-1">Medida en: {cardioEx.unit}</p>
                )}
              </div>
            </div>
          )}

          {/* SPORT */}
          {form.category === 'sport' && (
            <div>
              <Label className="text-foreground">Deporte</Label>
              <Select value={form.sport_type} onValueChange={v => setForm(f => ({ ...f, sport_type: v }))}>
                <SelectTrigger className="mt-1 bg-muted/30 border-border">
                  <SelectValue placeholder="Selecciona deporte..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {SPORTS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="bg-gym text-primary-foreground hover:bg-gym/90"
          >
            {initialData ? 'Guardar cambios' : 'Crear rutina'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
