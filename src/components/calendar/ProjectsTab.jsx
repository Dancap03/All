import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, CheckCircle2, Circle, ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { base44 } from '@/api/base44Client';

const PROJECT_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#e879f9'];

const MiniCalendar = ({ projects }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
  const days = [];
  let d = start;
  while (d <= end) { days.push(d); d = addDays(d, 1); }
  const today = new Date();

  return (
    <Card className="glass-card mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-sm">Calendario de proyectos</CardTitle>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentMonth(m => { const nm = new Date(m); nm.setMonth(nm.getMonth()-1); return nm; })} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs capitalize">{format(currentMonth, 'MMM yyyy', { locale: es })}</span>
            <button onClick={() => setCurrentMonth(m => { const nm = new Date(m); nm.setMonth(nm.getMonth()+1); return nm; })} className="p-1 text-muted-foreground hover:text-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 mb-1">
          {['L','M','X','J','V','S','D'].map(d => <div key={d} className="text-center text-xs text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const dayStr = format(day, 'yyyy-MM-dd');
            const projectsEnding = projects.filter(p => p.end_date === dayStr);
            return (
              <div key={i} className={`min-h-[36px] p-0.5 rounded text-center ${inMonth ? '' : 'opacity-30'}`}>
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="flex justify-center flex-wrap gap-px mt-0.5">
                  {projectsEnding.slice(0, 2).map(p => (
                    <div key={p.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || '#a78bfa' }} title={p.name} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {projects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#a78bfa' }} />
                <span className="text-muted-foreground">{p.name}: {p.end_date ? format(new Date(p.end_date), 'd MMM', { locale: es }) : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', end_date: '', color: PROJECT_COLORS[0] });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskProjectId, setTaskProjectId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ name: '', description: '', due_date: '' });
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);

  const fetchData = async () => {
    const [p, t] = await Promise.all([
      base44.entities.Project.list('-created_date', 100),
      base44.entities.ProjectTask.list('-created_date', 500),
    ]);
    setProjects(p);
    setTasks(t);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveProject = async () => {
    if (!projectForm.name.trim()) return;
    if (editingProject) {
      await base44.entities.Project.update(editingProject.id, projectForm);
    } else {
      await base44.entities.Project.create(projectForm);
    }
    setShowProjectForm(false); setEditingProject(null); fetchData();
  };

  const handleSaveTask = async () => {
    if (!taskForm.name.trim()) return;
    const proj = projects.find(p => p.id === taskProjectId);
    if (editingTask) {
      await base44.entities.ProjectTask.update(editingTask.id, taskForm);
    } else {
      await base44.entities.ProjectTask.create({ ...taskForm, project_id: taskProjectId, project_name: proj?.name });
    }
    setShowTaskForm(false); setEditingTask(null); fetchData();
  };

  const handleToggleTask = async (task) => {
    await base44.entities.ProjectTask.update(task.id, { completed: !task.completed });
    fetchData();
  };

  const handleDeleteProject = async () => {
    await base44.entities.Project.delete(deleteProjectId);
    setDeleteProjectId(null); fetchData();
  };

  const handleDeleteTask = async () => {
    await base44.entities.ProjectTask.delete(deleteTaskId);
    setDeleteTaskId(null); fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  const activeProjects = projects.filter(p => p.status !== 'completed');
  const completedProjects = projects.filter(p => p.status === 'completed');

  return (
    <div className="space-y-4">
      <MiniCalendar projects={activeProjects} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Proyectos activos ({activeProjects.length})</h3>
        <Button size="sm" onClick={() => { setEditingProject(null); setProjectForm({ name: '', description: '', end_date: '', color: PROJECT_COLORS[0] }); setShowProjectForm(true); }} className="h-8 text-xs bg-muted/30 text-foreground hover:bg-muted/50 border border-dashed border-border">
          <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo proyecto
        </Button>
      </div>

      {activeProjects.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">Sin proyectos activos</p>}

      <div className="space-y-2">
        {activeProjects.map(project => {
          const projectTasks = tasks.filter(t => t.project_id === project.id);
          const done = projectTasks.filter(t => t.completed).length;
          const isExpanded = expandedId === project.id;
          return (
            <Card key={project.id} className="glass-card border-border overflow-hidden">
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color || '#a78bfa' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm">{project.name}</div>
                  {project.description && <div className="text-xs text-muted-foreground truncate">{project.description}</div>}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {done}/{projectTasks.length} tareas · Fin: {project.end_date ? format(new Date(project.end_date), 'd MMM yyyy', { locale: es }) : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); base44.entities.Project.update(project.id, { status: 'completed' }).then(fetchData); }} className="p-1 text-muted-foreground hover:text-gym" title="Marcar como completado">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setEditingProject(project); setProjectForm({ name: project.name, description: project.description || '', end_date: project.end_date || '', color: project.color || PROJECT_COLORS[0] }); setShowProjectForm(true); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteProjectId(project.id); }} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-2 bg-muted/10">
                  {projectTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2 group">
                      <button onClick={() => handleToggleTask(task)} className="mt-0.5 shrink-0">
                        {task.completed ? <CheckCircle2 className="w-4 h-4 text-gym" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <div className="flex-1">
                        <div className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.name}</div>
                        {task.description && <div className="text-xs text-muted-foreground">{task.description}</div>}
                        {task.due_date && <div className="text-xs text-muted-foreground">📅 {format(new Date(task.due_date), 'd MMM yyyy', { locale: es })}</div>}
                      </div>
                      <div className="hidden group-hover:flex gap-1 shrink-0">
                        <button onClick={() => { setEditingTask(task); setTaskProjectId(project.id); setTaskForm({ name: task.name, description: task.description || '', due_date: task.due_date || '' }); setShowTaskForm(true); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => setDeleteTaskId(task.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  {projectTasks.length === 0 && <p className="text-xs text-muted-foreground">Sin tareas</p>}
                  <Button size="sm" onClick={() => { setEditingTask(null); setTaskProjectId(project.id); setTaskForm({ name: '', description: '', due_date: '' }); setShowTaskForm(true); }} className="w-full h-7 text-xs bg-muted/30 hover:bg-muted/50 text-muted-foreground border border-dashed border-border mt-2">
                    <Plus className="w-3 h-3 mr-1" /> Añadir tarea
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Completed projects history */}
      {completedProjects.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Historial de proyectos completados ({completedProjects.length})
          </button>
          {showHistory && (
            <div className="space-y-2 mt-2">
              {completedProjects.map(project => {
                const projectTasks = tasks.filter(t => t.project_id === project.id);
                const done = projectTasks.filter(t => t.completed).length;
                return (
                  <div key={project.id} className="p-3 rounded-xl border border-border bg-muted/10 flex items-center gap-3 opacity-70">
                    <CheckCircle2 className="w-4 h-4 text-gym shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm line-through">{project.name}</div>
                      {project.description && <div className="text-xs text-muted-foreground truncate">{project.description}</div>}
                      <div className="text-xs text-muted-foreground">
                        {done}/{projectTasks.length} tareas · Fin: {project.end_date ? format(new Date(project.end_date), 'd MMM yyyy', { locale: es }) : '—'}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => base44.entities.Project.update(project.id, { status: 'active' }).then(fetchData)} className="p-1 text-muted-foreground hover:text-foreground text-xs" title="Reactivar">↩</button>
                      <button onClick={() => setDeleteProjectId(project.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Project form */}
      <Dialog open={showProjectForm} onOpenChange={setShowProjectForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">{editingProject ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Nombre</Label>
              <Input value={projectForm.name} onChange={e => setProjectForm(f => ({...f, name: e.target.value}))} placeholder="Nombre del proyecto..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Descripción (opcional)</Label>
              <Input value={projectForm.description} onChange={e => setProjectForm(f => ({...f, description: e.target.value}))} placeholder="Descripción..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Fecha fin</Label>
              <Input type="date" value={projectForm.end_date} onChange={e => setProjectForm(f => ({...f, end_date: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
            <div>
              <Label className="text-foreground mb-2 block">Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map(c => (
                  <button key={c} onClick={() => setProjectForm(f => ({...f, color: c}))} className={`w-7 h-7 rounded-full border-2 ${projectForm.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowProjectForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveProject} disabled={!projectForm.name.trim()} className="bg-primary text-primary-foreground">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task form */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">{editingTask ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-foreground">Nombre</Label>
              <Input value={taskForm.name} onChange={e => setTaskForm(f => ({...f, name: e.target.value}))} placeholder="Nombre de la tarea..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Descripción (opcional)</Label>
              <Input value={taskForm.description} onChange={e => setTaskForm(f => ({...f, description: e.target.value}))} placeholder="Descripción..." className="mt-1 bg-muted/30 border-border" />
            </div>
            <div>
              <Label className="text-foreground">Fecha límite</Label>
              <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({...f, due_date: e.target.value}))} className="mt-1 bg-muted/30 border-border [color-scheme:dark]" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTaskForm(false)} className="border-border">Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={!taskForm.name.trim()} className="bg-primary text-primary-foreground">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle className="text-foreground">¿Eliminar proyecto?</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground">Se eliminará también con sus tareas.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteProject} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle className="text-foreground">¿Eliminar tarea?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}