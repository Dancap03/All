import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play, Square, X, Plus, Trash2, ChevronDown, ChevronUp, Dumbbell, Activity, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { getCategoryLabel, getCategoryColor, getCategoryDotColor, CARDIO_EXERCISES, STRENGTH_EXERCISES, MUSCLE_GROUPS } from '@/lib/gymData';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function WorkoutTracker({ routines, onSaveSession }) {
  const [open, setOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [exercisesLog, setExercisesLog] = useState([]);
  const [cardioValue, setCardioValue] = useState('');
  const [expandedExercise, setExpandedExercise] = useState(null);

  // For adding extra exercises mid-workout
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addMuscle, setAddMuscle] = useState('');

  const handleStart = () => {
    setOpen(true);
    setSelectedRoutine(null);
    setStartTime(null);
    setExercisesLog([]);
    setCardioValue('');
  };

  const handleSelectRoutine = (routine) => {
    setSelectedRoutine(routine);
    setStartTime(new Date());
    if (routine.category === 'strength') {
      setExercisesLog((routine.exercises || []).map(ex => ({
        exercise_id: ex.id,
        exercise_name: ex.name,
        muscle_group: ex.muscle_group,
        sets: [],
      })));
    }
  };

  const handleAddSet = (exerciseIdx) => {
    setExercisesLog(prev => {
      const updated = [...prev];
      updated[exerciseIdx] = {
        ...updated[exerciseIdx],
        sets: [...updated[exerciseIdx].sets, { set_number: updated[exerciseIdx].sets.length + 1, entries: [] }]
      };
      return updated;
    });
  };

  const handleAddEntry = (exerciseIdx, setIdx) => {
    setExercisesLog(prev => {
      const updated = [...prev];
      updated[exerciseIdx].sets[setIdx].entries = [
        ...updated[exerciseIdx].sets[setIdx].entries,
        { reps: '', weight_kg: '' }
      ];
      return updated;
    });
  };

  const handleEntryChange = (exerciseIdx, setIdx, entryIdx, field, value) => {
    setExercisesLog(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated[exerciseIdx].sets[setIdx].entries[entryIdx][field] = value;
      return updated;
    });
  };

  const handleRemoveEntry = (exerciseIdx, setIdx, entryIdx) => {
    setExercisesLog(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated[exerciseIdx].sets[setIdx].entries.splice(entryIdx, 1);
      return updated;
    });
  };

  const handleRemoveSet = (exerciseIdx, setIdx) => {
    setExercisesLog(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      updated[exerciseIdx].sets.splice(setIdx, 1);
      updated[exerciseIdx].sets = updated[exerciseIdx].sets.map((s, i) => ({ ...s, set_number: i + 1 }));
      return updated;
    });
  };

  const handleAddExtraExercise = (exName, muscle) => {
    if (exercisesLog.find(e => e.exercise_name === exName)) return;
    setExercisesLog(prev => [...prev, {
      exercise_id: Date.now().toString(),
      exercise_name: exName,
      muscle_group: muscle,
      sets: [],
    }]);
  };

  const handleFinish = () => {
    const endTime = new Date();
    const durationMinutes = Math.round((endTime - startTime) / 60000);
    const cardioEx = selectedRoutine.category === 'cardio'
      ? CARDIO_EXERCISES.find(c => c.label === selectedRoutine.cardio_type)
      : null;

    const session = {
      routine_id: selectedRoutine.id,
      routine_name: selectedRoutine.name,
      category: selectedRoutine.category,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      date: format(startTime, 'yyyy-MM-dd'),
      duration_minutes: durationMinutes,
      exercises_log: selectedRoutine.category === 'strength' ? exercisesLog : [],
      cardio_value: selectedRoutine.category === 'cardio' ? parseFloat(cardioValue) || 0 : null,
      cardio_unit: selectedRoutine.category === 'cardio' ? (cardioEx?.unit || selectedRoutine.cardio_unit) : null,
      cardio_type: selectedRoutine.category === 'cardio' ? selectedRoutine.cardio_type : null,
      sport_type: selectedRoutine.category === 'sport' ? selectedRoutine.sport_type : null,
    };
    onSaveSession(session);
    setOpen(false);
  };

  const handleCancel = () => setCancelConfirm(true);
  const confirmCancel = () => { setCancelConfirm(false); setOpen(false); setSelectedRoutine(null); };

  const cardioEx = selectedRoutine?.category === 'cardio'
    ? CARDIO_EXERCISES.find(c => c.label === selectedRoutine.cardio_type)
    : null;

  return (
    <>
      <Button onClick={handleStart} className="bg-gym text-primary-foreground hover:bg-gym/90 gap-2">
        <Play className="w-4 h-4" />
        Iniciar entrenamiento
      </Button>

      <Dialog open={open} onOpenChange={() => {}} >
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh]" hideClose>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-foreground font-grotesk">
                {!selectedRoutine ? 'Selecciona una rutina' : (
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-gym" />
                    {selectedRoutine.name}
                    <Badge className={`text-xs ${getCategoryColor(selectedRoutine.category)}`}>
                      {getCategoryLabel(selectedRoutine.category)}
                    </Badge>
                  </div>
                )}
              </DialogTitle>
              {selectedRoutine && (
                <div className="text-xs text-muted-foreground">
                  Inicio: {startTime ? format(startTime, 'HH:mm') : '—'}
                </div>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-2">
            {/* Routine selection */}
            {!selectedRoutine && (
              <div className="space-y-2 py-2">
                {routines.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tienes rutinas creadas aún</p>
                ) : (
                  routines.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRoutine(r)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-all text-left"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryDotColor(r.category) }} />
                      <div>
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{getCategoryLabel(r.category)}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* STRENGTH log */}
            {selectedRoutine?.category === 'strength' && (
              <div className="space-y-3 py-2">
                {exercisesLog.map((ex, ei) => (
                  <div key={ei} className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedExercise(expandedExercise === ei ? null : ei)}
                    >
                      <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-gym" />
                        <span className="font-medium text-foreground text-sm">{ex.exercise_name}</span>
                        <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                          {MUSCLE_GROUPS.find(m => m.id === ex.muscle_group)?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{ex.sets.length} series</span>
                        {expandedExercise === ei ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {expandedExercise === ei && (
                      <div className="p-3 pt-0 space-y-2 border-t border-border">
                        {ex.sets.map((set, si) => (
                          <div key={si} className="bg-card/50 rounded-lg p-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Serie {set.set_number}</span>
                              <button onClick={() => handleRemoveSet(ei, si)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {set.entries.map((entry, eni) => (
                              <div key={eni} className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  placeholder="Reps"
                                  value={entry.reps}
                                  onChange={e => handleEntryChange(ei, si, eni, 'reps', e.target.value)}
                                  className="h-7 text-xs bg-muted/30 border-border w-20"
                                />
                                <span className="text-xs text-muted-foreground">×</span>
                                <Input
                                  type="number"
                                  placeholder="Kg"
                                  value={entry.weight_kg}
                                  onChange={e => handleEntryChange(ei, si, eni, 'weight_kg', e.target.value)}
                                  className="h-7 text-xs bg-muted/30 border-border w-20"
                                />
                                <span className="text-xs text-muted-foreground">kg</span>
                                <button onClick={() => handleRemoveEntry(ei, si, eni)} className="text-muted-foreground hover:text-destructive ml-auto">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground w-full" onClick={() => handleAddEntry(ei, si)}>
                              <Plus className="w-3 h-3 mr-1" /> Añadir peso
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs border-gym/30 text-gym hover:bg-gym/10" onClick={() => handleAddSet(ei)}>
                          <Plus className="w-3 h-3 mr-1" /> Añadir serie
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add extra exercise */}
                {!showAddExercise ? (
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground border border-dashed border-border h-9" onClick={() => setShowAddExercise(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Añadir ejercicio extra
                  </Button>
                ) : (
                  <div className="bg-muted/20 rounded-xl border border-border p-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {MUSCLE_GROUPS.map(mg => (
                        <button
                          key={mg.id}
                          onClick={() => setAddMuscle(addMuscle === mg.id ? '' : mg.id)}
                          className={`px-2 py-1 rounded text-xs border transition-all ${addMuscle === mg.id ? 'bg-gym/20 border-gym/50 text-gym' : 'bg-card border-border text-muted-foreground'}`}
                        >
                          {mg.label}
                        </button>
                      ))}
                    </div>
                    {addMuscle && (
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {(STRENGTH_EXERCISES[addMuscle] || []).map(ex => (
                          <button key={ex} onClick={() => { handleAddExtraExercise(ex, addMuscle); setShowAddExercise(false); setAddMuscle(''); }}
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/40 text-foreground">
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setShowAddExercise(false)}>Cancelar</Button>
                  </div>
                )}
              </div>
            )}

            {/* CARDIO log */}
            {selectedRoutine?.category === 'cardio' && (
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-finance" />
                  <span className="font-medium text-foreground">{selectedRoutine.cardio_type}</span>
                </div>
                <div>
                  <Label className="text-foreground">{cardioEx?.unit ? `Distancia / Cantidad (${cardioEx.unit})` : 'Medida'}</Label>
                  <Input
                    type="number"
                    value={cardioValue}
                    onChange={e => setCardioValue(e.target.value)}
                    placeholder={`Ej: 5`}
                    className="mt-1 bg-muted/30 border-border"
                  />
                  {cardioEx?.unit && <p className="text-xs text-muted-foreground mt-1">Unidad: {cardioEx.unit}</p>}
                </div>
              </div>
            )}

            {/* SPORT log */}
            {selectedRoutine?.category === 'sport' && (
              <div className="py-4 flex flex-col items-center gap-3 text-center">
                <Trophy className="w-12 h-12 text-gold opacity-60" />
                <p className="font-medium text-foreground">{selectedRoutine.sport_type}</p>
                <p className="text-sm text-muted-foreground">Dale a finalizar cuando termines tu sesión</p>
              </div>
            )}
          </ScrollArea>

          {selectedRoutine && (
            <div className="flex justify-between pt-3 border-t border-border">
              <Button variant="outline" onClick={handleCancel} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                <Square className="w-4 h-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={handleFinish} className="bg-gym text-primary-foreground hover:bg-gym/90">
                Finalizar entrenamiento ✓
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Cancelar entrenamiento?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              El entrenamiento no se guardará. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Seguir entrenando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive hover:bg-destructive/90">
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}