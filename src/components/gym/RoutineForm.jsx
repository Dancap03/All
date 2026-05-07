import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Dumbbell, Activity, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

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

  const RecordCard = ({ record }) => (
    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-sm truncate">{record.exercise_name || record.cardio_type}</div>
        {record.category === 'strength' && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gym font-bold">{record.weight_kg} kg</span>
            <span className="text-muted-foreground text-xs">× {record.reps} reps</span>
          </div>
        )}
        {record.category === 'cardio' && record.record_type === 'best_distance' && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-finance font-bold">{record.distance_km} km</span>
            {record.duration_minutes && <span className="text-muted-foreground text-xs">en {record.duration_minutes} min</span>}
          </div>
        )}
        {record.category === 'cardio' && record.record_type === 'best_pace' && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-finance font-bold">{record.avg_speed_kmh?.toFixed(1)} km/h</span>
            <span className="text-muted-foreground text-xs">velocidad media</span>
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
        className="text-muted-foreground hover:text-destructive transition-colors ml-2 p-1"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-gold" />
          Records personales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="strength">
          <TabsList className="bg-muted/30 w-full mb-4">
            <TabsTrigger value="strength" className="flex-1 data-[state=active]:bg-gym/20 data-[state=active]:text-gym text-xs">
              <Dumbbell className="w-3.5 h-3.5 mr-1" /> Fuerza
            </TabsTrigger>
            <TabsTrigger value="distance" className="flex-1 data-[state=active]:bg-finance/20 data-[state=active]:text-finance text-xs">
              <Activity className="w-3.5 h-3.5 mr-1" /> Mayor distancia
            </TabsTrigger>
            <TabsTrigger value="pace" className="flex-1 data-[state=active]:bg-finance/20 data-[state=active]:text-finance text-xs">
              <Activity className="w-3.5 h-3.5 mr-1" /> Mejor ritmo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strength" className="space-y-2 mt-0">
            {strengthRecords.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Sin records de fuerza aún</p>
            ) : (
              strengthRecords.map(r => <RecordCard key={r.id} record={r} />)
            )}
          </TabsContent>

          <TabsContent value="distance" className="space-y-2 mt-0">
            {cardioDistanceRecords.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Sin records de distancia aún</p>
            ) : (
              cardioDistanceRecords.map(r => <RecordCard key={r.id} record={r} />)
            )}
          </TabsContent>

          <TabsContent value="pace" className="space-y-2 mt-0">
            {cardioPaceRecords.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Sin records de ritmo aún</p>
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