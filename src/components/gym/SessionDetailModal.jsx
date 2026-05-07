import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Dumbbell, Activity, Trophy, Trash2 } from 'lucide-react';
import { getCategoryLabel, getCategoryColor, getCategoryDotColor } from '@/lib/gymData';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function SessionDetailModal({ sessions, day, open, onClose, onSessionDeleted }) {
  const [deleteId, setDeleteId] = useState(null);
  if (!sessions || sessions.length === 0) return null;

  const formatDuration = (minutes) => {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-grotesk">
              {day && format(new Date(day), "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {sessions.map((session, idx) => (
              <div key={idx} className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryDotColor(session.category) }} />
                    <span className="font-semibold text-foreground">{session.routine_name || getCategoryLabel(session.category)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getCategoryColor(session.category)}`}>
                      {getCategoryLabel(session.category)}
                    </Badge>
                    {onSessionDeleted && (
                      <button onClick={() => setDeleteId(session.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {session.start_time ? format(new Date(session.start_time), 'HH:mm') : '—'}
                      {' → '}
                      {session.end_time ? format(new Date(session.end_time), 'HH:mm') : '—'}
                    </span>
                  </div>
                  {session.duration_minutes && (
                    <span className="text-primary">{formatDuration(session.duration_minutes)}</span>
                  )}
                </div>

                {session.category === 'strength' && session.exercises_log && session.exercises_log.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Dumbbell className="w-3.5 h-3.5" />
                      <span>Ejercicios</span>
                    </div>
                    {session.exercises_log.map((ex, ei) => (
                      <div key={ei} className="pl-3 border-l-2 border-gym/30">
                        <div className="text-sm font-medium text-foreground">{ex.exercise_name}</div>
                        {ex.sets && ex.sets.map((set, si) => (
                          <div key={si} className="text-xs text-muted-foreground pl-2">
                            Serie {set.set_number}:{' '}
                            {set.entries?.map((e, ei2) => `${e.reps}rep × ${e.weight_kg}kg`).join(' + ')}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {session.category === 'cardio' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-finance" />
                    <span className="text-foreground">{session.cardio_type}: </span>
                    <span className="text-finance font-semibold">{session.cardio_value} {session.cardio_unit}</span>
                  </div>
                )}

                {session.category === 'sport' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="w-4 h-4 text-gold" />
                    <span className="text-foreground">{session.sport_type}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar entrenamiento?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onSessionDeleted(deleteId); setDeleteId(null); }} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}