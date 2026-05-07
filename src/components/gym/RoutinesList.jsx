import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Dumbbell, Activity, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getCategoryLabel, getCategoryColor, getCategoryDotColor, MUSCLE_GROUPS } from '@/lib/gymData';

const CATEGORY_ICONS = { strength: Dumbbell, cardio: Activity, sport: Trophy };

export default function RoutinesList({ routines, onAdd, onEdit, onDelete }) {
  const [deleteId, setDeleteId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const handleDelete = () => {
    onDelete(deleteId);
    setDeleteId(null);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-foreground flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-gym" />
          Mis rutinas
        </CardTitle>
        <Button size="sm" onClick={onAdd} className="bg-gym text-primary-foreground hover:bg-gym/90 gap-1.5">
          <Plus className="w-4 h-4" />
          Nueva rutina
        </Button>
      </CardHeader>
      <CardContent>
        {routines.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tienes rutinas creadas</p>
            <p className="text-xs mt-1">Crea tu primera rutina para empezar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {routines.map(routine => {
              const Icon = CATEGORY_ICONS[routine.category] || Dumbbell;
              const isExpanded = expanded === routine.id;
              return (
                <div key={routine.id} className="bg-muted/20 rounded-xl border border-border overflow-hidden transition-all">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${getCategoryDotColor(routine.category)}20` }}>
                      <Icon className="w-4 h-4" style={{ color: getCategoryDotColor(routine.category) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{routine.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-xs ${getCategoryColor(routine.category)}`}>
                          {getCategoryLabel(routine.category)}
                        </Badge>
                        {routine.category === 'strength' && routine.exercises?.length > 0 && (
                          <span className="text-xs text-muted-foreground">{routine.exercises.length} ejercicios</span>
                        )}
                        {routine.category === 'cardio' && routine.cardio_unit && (
                          <span className="text-xs text-muted-foreground">Medida: {routine.cardio_unit}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {routine.category === 'strength' && routine.exercises?.length > 0 && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : routine.id)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => onEdit(routine)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(routine.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && routine.exercises?.length > 0 && (
                    <div className="border-t border-border px-3 pb-3 pt-2">
                      <div className="flex flex-wrap gap-1.5">
                        {routine.exercises.map((ex, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-1 bg-card rounded-lg text-xs">
                            <span className="text-foreground">{ex.name}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{MUSCLE_GROUPS.find(m => m.id === ex.muscle_group)?.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar rutina?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}