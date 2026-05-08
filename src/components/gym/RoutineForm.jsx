import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Dumbbell, Activity, Trophy, Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategoryLabel, getCategoryColor, MUSCLE_GROUPS, STRENGTH_EXERCISES, CARDIO_EXERCISES, SPORTS, EXERCISE_IMAGES, CARDIO_IMAGES, SPORT_IMAGES } from '@/lib/gymData';

const CATEGORIES = [
  { id: 'strength', label: 'Fuerza / Pesas', icon: Dumbbell },
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
  const [searchQuery, setSearchQuery] = useState('');
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
    setSearchQuery('');
  }, [initialData, open]);

  // Auto-set name for cardio/sport when type is selected
  const handleCardioTypeChange = (v) => {
    const ex = CARDIO_EXERCISES.find(c => c.label === v);
    setForm(f => ({ ...f, cardio_type: v, cardio_unit: ex?.unit || '', name: v }));
  };

  const handleSportTypeChange = (v) => {
    setForm(f => ({ ...f, sport_type: v, name: v }));
  };

  const handleAddExercise = (name, muscleGroup) => {
    if (form.exercises.find(e => e.name === name)) return;
    setForm(f => ({
      ...f,
      exercises: [...f.exercises, { id: Date.now().toString(), name, muscle_group: muscleGroup }],
    }));
  };

  const handleRemoveExercise = (id) => {
    setForm(f => ({ ...f, exercises: f.exercises.filter(e => e.id !== id) }));
  };

  const handleSave = () => {
    const finalName = form.name.trim() ||
      (form.category === 'cardio' ? form.cardio_type : '') ||
      (form.category === 'sport' ? form.sport_type : '');
    if (!finalName) return;
    onSave({ ...form, name: finalName });
  };

  const canSave = form.name.trim() ||
    (form.category === 'cardio' && form.cardio_type) ||
    (form.category === 'sport' && form.sport_type);

  // Search logic across all muscle groups
  const searchResults = searchQuery.trim().length >= 2
    ? Object.entries(STRENGTH_EXERCISES).flatMap(([muscle, exercises]) =>
        exercises
          .filter(ex => ex.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(ex => ({ name: ex, muscle_group: muscle }))
      )
    : [];

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
          {/* Category */}
          <div>
            <Label className="text-foreground mb-2 block">Categoría</Label>
            <div className="flex gap-2">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setForm(f => ({ ...f, category: id, exercises: [], cardio_type: '', sport_type: '', name: '' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                    form.category === id
                      ? 'bg-gym/20 text-gym border-gym/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{id === 'strength' ? 'Fuerza' : id === 'cardio' ? 'Cardio' : 'Deporte'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name - only required for strength */}
          {form.category === 'strength' && (
            <div>
              <Label className="text-foreground">Nombre de la rutina</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Push Day, Piernas..."
                className="mt-1 bg-muted/30 border-border"
              />
            </div>
          )}

          {/* STRENGTH: exercise list + search */}
          {form.category === 'strength' && (
            <div className="space-y-3">
              <Label className="text-foreground">Ejercicios</Label>

              {/* Selected exercises */}
              {form.exercises.length > 0 && (
                <div className="space-y-1.5">
                  {form.exercises.map(ex => {
                    const imgKey = ex.name;
                    const imgEmoji = EXERCISE_IMAGES[imgKey] || '🏋️';
                    return (
                      <div key={ex.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{imgEmoji}</span>
                          <div>
                            <span className="text-sm text-foreground">{ex.name}</span>
                            <div className="text-xs text-muted-foreground">
                              {MUSCLE_GROUPS.find(m => m.id === ex.muscle_group)?.label}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleRemoveExercise(ex.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Search bar */}
              <div className="border border-dashed border-border rounded-xl p-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setAddingMuscle(''); }}
                    placeholder="Buscar ejercicio..."
                    className="pl-8 h-8 text-xs bg-muted/30 border-border"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Search results */}
                {searchQuery.trim().length >= 2 && (
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {searchResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
                    ) : (
                      searchResults.map(({ name, muscle_group }) => {
                        const emoji = EXERCISE_IMAGES[name] || '🏋️';
                        const mgLabel = MUSCLE_GROUPS.find(m => m.id === muscle_group)?.label || '';
                        const alreadyAdded = !!form.exercises.find(e => e.name === name);
                        return (
                          <button
                            key={name}
                            onClick={() => !alreadyAdded && handleAddExercise(name, muscle_group)}
                            disabled={alreadyAdded}
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/40 text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <span className="text-base">{emoji}</span>
                            <div>
                              <div>{name}</div>
                              <div className="text-muted-foreground text-[10px]">{mgLabel}</div>
                            </div>
                            {alreadyAdded && <span className="ml-auto text-gym text-[10px]">✓ Añadido</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Browse by muscle group */}
                {!searchQuery && (
                  <>
                    <p className="text-xs text-muted-foreground">O elige por grupo muscular:</p>
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
                      <div className="max-h-44 overflow-y-auto space-y-0.5 mt-1">
                        {(STRENGTH_EXERCISES[addingMuscle] || []).map(ex => {
                          const emoji = EXERCISE_IMAGES[ex] || '🏋️';
                          const alreadyAdded = !!form.exercises.find(e => e.name === ex);
                          return (
                            <button
                              key={ex}
                              onClick={() => !alreadyAdded && handleAddExercise(ex, addingMuscle)}
                              disabled={alreadyAdded}
                              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/40 text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <span className="text-base">{emoji}</span>
                              <span>{ex}</span>
                              {alreadyAdded && <span className="ml-auto text-gym text-[10px]">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* CARDIO */}
          {form.category === 'cardio' && (
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Tipo de cardio</Label>
                <Select value={form.cardio_type} onValueChange={handleCardioTypeChange}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border">
                    <SelectValue placeholder="Selecciona tipo..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-60">
                    {CARDIO_EXERCISES.map(c => (
                      <SelectItem key={c.label} value={c.label}>
                        <span className="flex items-center gap-2">
                          <span>{CARDIO_IMAGES[c.id] || '🏃'}</span>
                          <span>{c.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.cardio_type && (
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                  <span className="text-3xl">{CARDIO_IMAGES[CARDIO_EXERCISES.find(c => c.label === form.cardio_type)?.id] || '🏃'}</span>
                  <div>
                    <div className="font-medium text-foreground text-sm">{form.cardio_type}</div>
                    {cardioEx && <div className="text-xs text-muted-foreground">Medida en: {cardioEx.unit}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPORT */}
          {form.category === 'sport' && (
            <div className="space-y-3">
              <div>
                <Label className="text-foreground">Deporte</Label>
                <Select value={form.sport_type} onValueChange={handleSportTypeChange}>
                  <SelectTrigger className="mt-1 bg-muted/30 border-border">
                    <SelectValue placeholder="Selecciona deporte..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-60">
                    {SPORTS.map(s => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span>{SPORT_IMAGES[s] || '🏅'}</span>
                          <span>{s}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.sport_type && (
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                  <span className="text-3xl">{SPORT_IMAGES[form.sport_type] || '🏅'}</span>
                  <div className="font-medium text-foreground">{form.sport_type}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-gym text-primary-foreground hover:bg-gym/90"
          >
            {initialData ? 'Guardar cambios' : 'Crear rutina'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
