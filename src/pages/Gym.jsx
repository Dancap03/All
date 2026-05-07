import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, isSameDay } from 'date-fns';
import GymCalendar from '@/components/gym/GymCalendar';
import RoutinesList from '@/components/gym/RoutinesList';
import RoutineForm from '@/components/gym/RoutineForm';
import WorkoutTracker from '@/components/gym/WorkoutTracker';
import RecordsPanel from '@/components/gym/RecordsPanel';
import SessionDetailModal from '@/components/gym/SessionDetailModal';
import { CARDIO_EXERCISES } from '@/lib/gymData';

export default function Gym() {
  const [sessions, setSessions] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);

  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDaySessions, setSelectedDaySessions] = useState([]);
  const [showDayModal, setShowDayModal] = useState(false);

  const fetchData = async () => {
    const [s, r, rec] = await Promise.all([
      base44.entities.WorkoutSession.list('-date', 200),
      base44.entities.WorkoutRoutine.list('-created_date', 100),
      base44.entities.GymRecord.list('-date', 200),
    ]);
    setSessions(s);
    setRoutines(r);
    setRecords(rec);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDayClick = (day, daySessions) => {
    setSelectedDay(day);
    setSelectedDaySessions(daySessions);
    setShowDayModal(true);
  };

  const handleSaveRoutine = async (data) => {
    if (editingRoutine) {
      await base44.entities.WorkoutRoutine.update(editingRoutine.id, data);
    } else {
      await base44.entities.WorkoutRoutine.create(data);
    }
    setShowRoutineForm(false);
    setEditingRoutine(null);
    fetchData();
  };

  const handleEditRoutine = (routine) => {
    setEditingRoutine(routine);
    setShowRoutineForm(true);
  };

  const handleDeleteRoutine = async (id) => {
    await base44.entities.WorkoutRoutine.delete(id);
    fetchData();
  };

  const handleSaveSession = async (sessionData) => {
    const saved = await base44.entities.WorkoutSession.create(sessionData);

    // Process records for strength
    if (sessionData.category === 'strength' && sessionData.exercises_log) {
      for (const ex of sessionData.exercises_log) {
        let bestWeight = 0;
        let bestReps = 0;
        for (const set of (ex.sets || [])) {
          for (const entry of (set.entries || [])) {
            const w = parseFloat(entry.weight_kg) || 0;
            if (w > bestWeight) {
              bestWeight = w;
              bestReps = parseFloat(entry.reps) || 0;
            }
          }
        }
        if (bestWeight > 0) {
          // Check if record exists and is worse
          const existing = records.find(r => r.category === 'strength' && r.exercise_name === ex.exercise_name);
          if (!existing || bestWeight > existing.weight_kg) {
            if (existing) await base44.entities.GymRecord.delete(existing.id);
            await base44.entities.GymRecord.create({
              category: 'strength',
              exercise_name: ex.exercise_name,
              muscle_group: ex.muscle_group,
              weight_kg: bestWeight,
              reps: bestReps,
              session_id: saved.id,
              date: sessionData.date,
            });
          }
        }
      }
    }

    // Process records for cardio (running types)
    if (sessionData.category === 'cardio') {
      const cardioEx = CARDIO_EXERCISES.find(c => c.label === sessionData.cardio_type);
      if (cardioEx && (cardioEx.unit === 'km') && sessionData.cardio_value > 0) {
        const distKm = parseFloat(sessionData.cardio_value) || 0;
        const durMin = parseFloat(sessionData.duration_minutes) || 0;
        const avgSpeed = durMin > 0 ? (distKm / durMin) * 60 : 0;

        // Fetch fresh records to avoid stale state
        const freshRecords = await base44.entities.GymRecord.list('-date', 200);
        const existingDist = freshRecords.find(r => r.category === 'cardio' && r.cardio_type === sessionData.cardio_type && r.record_type === 'best_distance');
        const existingPace = freshRecords.find(r => r.category === 'cardio' && r.cardio_type === sessionData.cardio_type && r.record_type === 'best_pace');

        const isBestDist = !existingDist || distKm > (existingDist.distance_km || 0);
        const isBestPace = avgSpeed > 0 && (!existingPace || avgSpeed > (existingPace.avg_speed_kmh || 0));

        const recordPayload = {
          category: 'cardio',
          exercise_name: sessionData.cardio_type,
          cardio_type: sessionData.cardio_type,
          cardio_unit: 'km',
          distance_km: distKm,
          duration_minutes: durMin,
          avg_speed_kmh: avgSpeed,
          session_id: saved.id,
          date: sessionData.date,
        };

        if (isBestDist) {
          if (existingDist) await base44.entities.GymRecord.delete(existingDist.id);
          await base44.entities.GymRecord.create({ ...recordPayload, record_type: 'best_distance' });
        }

        if (isBestPace) {
          if (existingPace) await base44.entities.GymRecord.delete(existingPace.id);
          await base44.entities.GymRecord.create({ ...recordPayload, record_type: 'best_pace' });
        }
      }
    }

    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gym/30 border-t-gym rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-grotesk font-bold text-foreground">Gym</h1>
          <p className="text-muted-foreground mt-1">Seguimiento de entrenamientos</p>
        </div>
        <WorkoutTracker routines={routines} onSaveSession={handleSaveSession} />
      </div>

      {/* Calendar + Week summary */}
      <GymCalendar sessions={sessions} onDayClick={handleDayClick} />

      {/* Routines */}
      <RoutinesList
        routines={routines}
        onAdd={() => { setEditingRoutine(null); setShowRoutineForm(true); }}
        onEdit={handleEditRoutine}
        onDelete={handleDeleteRoutine}
      />

      {/* Records */}
      <RecordsPanel records={records} onRecordDeleted={fetchData} />

      {/* Modals */}
      <RoutineForm
        open={showRoutineForm}
        onClose={() => { setShowRoutineForm(false); setEditingRoutine(null); }}
        onSave={handleSaveRoutine}
        initialData={editingRoutine}
      />

      <SessionDetailModal
        sessions={selectedDaySessions}
        day={selectedDay}
        open={showDayModal}
        onClose={() => setShowDayModal(false)}
        onSessionDeleted={async (id) => {
          await base44.entities.WorkoutSession.delete(id);
          fetchData();
          setShowDayModal(false);
        }}
      />
    </div>
  );
}