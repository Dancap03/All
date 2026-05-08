import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Dumbbell, Activity, Trash2, Zap } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { base44 } from '@/api/base44Client'; 
import { EXERCISE_IMAGES, CARDIO_IMAGES, CARDIO_EXERCISES } from '@/lib/gymData';

export default function RecordsPanel({ records, onRecordDeleted }) {
  const [deleteId, setDeleteId] = useState(null);

  const strengthRecords = records.filter(r => r.category === 'strength');
  const cardioDistanceRecords = records.filter(r => r.category === 'cardio' && r.record_type === 'best_distance');
  const cardioPaceRecords = records.filter(r => r.category === 'cardio' && r.record_type === 'best_pace');

  const handleDelete = async () => {
    await base44.entities.GymRecord.delete(deleteId);
    setDeleteId(null);
    onRecordDeleted();
  };

  const getCardioEmoji = (cardioType) => {
    const ex = CARDIO_EXERCISES.find(c => c.label === cardioType);
    return ex ? (CARDIO_IMAGES[ex.id] || '🏃') : '🏃';
  };

  const RecordCard = ({ record }) => {
    const emoji = record.category === 'strength'
      ? (EXERCISE_IMAGES[record.exercise_name] || '🏋️')
      : getCardioEmoji(record.cardio_type || record.exercise_name);

    return (
      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border hover:bg-muted/30 transition-colors">
        <span className="text-xl flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground text-sm truncate">
            {record.exercise_name || record.cardio_type}
          </div>

          {record.category === 'strength' && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-gym font-bold text-sm">{record.weight_kg} kg</span>
              <span className="text-muted-foreground text-xs">× {record.reps} reps</span>
            </div>
          )}

          {record.category === 'cardio' && record.record_type === 'best_distance' && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-blue-400 font-bold text-sm">{record.distance_km} km</span>
              {record.duration_minutes > 0 && (
                <span className="text-muted-foreground text-xs">en {record.duration_minutes} min</span>
              )}
            </div>
          )}

          {record.category === 'cardio' && record.record_type === 'best_pace' && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-blue-400 font-bold text-sm">
                {record.avg_speed_kmh?.toFixed(1)} km/h
              </span>
              <span className="text-muted-foreground text-xs">
                ({record.distance_km} km en {record.duration_minutes} min)
              </span>
            </div>
          )}

          {record.date && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(record.date), "d MMM yyyy", { locale: es })}
            </div>
          )}
        </div>
        <button
          onClick={() => setDeleteId(record.id)}
          className="text-muted-foreground hover:text-destructive transition-colors p-1 flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Records personales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="strength">
          <TabsList className="bg-muted/30 w-full mb-4 h-auto">
            <TabsTrigger value="strength" className="flex-1 data-[state=active]:bg-gym/20 data-[state=active]:text-gym text-xs py-2 px-1">
              <Dumbbell className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Fuerza</span>
              <span className="sm:hidden ml-1">💪</span>
            </TabsTrigger>
            <TabsTrigger value="distance" className="flex-1 data-[state=active]:bg-blue-400/20 data-[state=active]:text-blue-400 text-xs py-2 px-1">
              <Activity className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Distancia</span>
              <span className="sm:hidden ml-1">📏</span>
            </TabsTrigger>
            <TabsTrigger value="pace" className="flex-1 data-[state=active]:bg-blue-400/20 data-[state=active]:text-blue-400 text-xs py-2 px-1">
              <Zap className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Ritmo</span>
              <span className="sm:hidden ml-1">⚡</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strength" className="space-y-2 mt-0">
            {strengthRecords.length === 0 ? (
              <div className="text-center py-8">
                <Dumbbell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground text-sm">Sin records de fuerza aún</p>
                <p className="text-xs text-muted-foreground mt-1">Registra una sesión de fuerza para ver tus records</p>
              </div>
            ) : (
              strengthRecords.map(r => <RecordCard key={r.id} record={r} />)
            )}
          </TabsContent>

          <TabsContent value="distance" className="space-y-2 mt-0">
            {cardioDistanceRecords.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground text-sm">Sin records de distancia aún</p>
                <p className="text-xs text-muted-foreground mt-1">Registra sesiones de cardio con km para ver tus records</p>
              </div>
            ) : (
              cardioDistanceRecords.map(r => <RecordCard key={r.id} record={r} />)
            )}
          </TabsContent>

          <TabsContent value="pace" className="space-y-2 mt-0">
            {cardioPaceRecords.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground text-sm">Sin records de ritmo aún</p>
                <p className="text-xs text-muted-foreground mt-1">
                  El ritmo se calcula automáticamente al registrar distancia en km.
                  Requiere tanto distancia como duración de la sesión.
                </p>
              </div>
            ) : (
              cardioPaceRecords.map(r => <RecordCard key={r.id} record={r} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar record?</AlertDialogTitle>
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
