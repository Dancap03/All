import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import CalendarView from '@/components/calendar/CalendarView';
import EventPanel from '@/components/calendar/EventPanel';
import EventForm from '@/components/calendar/EventForm';
import ProjectsTab from '@/components/calendar/ProjectsTab';
import GoalsTab from '@/components/calendar/GoalsTab';
import { Calendar, FolderOpen, Target } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Inicio', icon: Calendar },
  { id: 'projects', label: 'Proyectos', icon: FolderOpen },
  { id: 'goals', label: 'Metas', icon: Target },
];

export default function Calendario() {
  const [activeTab, setActiveTab] = useState('home');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const fetchEvents = async () => {
    const evs = await base44.entities.CalendarEvent.list('-date', 500);
    setEvents(evs);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleDayClick = (day, dayEvents) => {
    setSelectedDay(day);
  };

  const handleEditEvent = (ev) => {
    setEditingEvent(ev);
    setShowEventForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-3xl font-grotesk font-bold text-foreground">Calendario</h1>
        <p className="text-muted-foreground mt-1">Organiza tu tiempo y metas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit border border-border">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Home tab */}
      {activeTab === 'home' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar - large */}
          <div className="lg:col-span-2">
            <Card className="glass-card">
              <CardContent className="pt-4">
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-finance/30 border-t-finance rounded-full animate-spin" /></div>
                ) : (
                  <CalendarView
                    events={events}
                    onDayClick={handleDayClick}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel: add button + day events */}
          <div>
            <Card className="glass-card">
              <CardContent className="pt-4">
                <EventPanel
                  events={events}
                  selectedDay={selectedDay}
                  onRefresh={fetchEvents}
                  onEditEvent={handleEditEvent}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'projects' && <ProjectsTab />}
      {activeTab === 'goals' && <GoalsTab />}

      <EventForm
        open={showEventForm}
        onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
        onSaved={fetchEvents}
        editingEvent={editingEvent}
        defaultDate={selectedDay || currentDate}
      />
    </div>
  );
}