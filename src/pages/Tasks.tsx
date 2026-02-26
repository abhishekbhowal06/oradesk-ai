import { useState, useMemo } from 'react';
import {
  ClipboardList,
  Bot,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ShieldAlert,
  Search,
  Zap,
  Target,
  ChevronRight,
  Terminal,
  Activity,
  Cpu,
  Phone,
  CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { useStaffTasks, TaskStatus, TaskPriority, StaffTask } from '@/hooks/useStaffTasks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskDetailSheet } from '@/components/action-center/TaskDetailSheet';
import { format, isToday } from 'date-fns';

const STATUS_OPTIONS: {
  value: TaskStatus;
  label: string;
  icon: typeof CheckCircle;
  color: string;
}[] = [
    { value: 'pending', label: 'Queued', icon: Clock, color: 'text-warning' },
    { value: 'in_progress', label: 'Processing', icon: AlertCircle, color: 'text-primary' },
    { value: 'completed', label: 'Resolved', icon: CheckCircle, color: 'text-success' },
    { value: 'cancelled', label: 'Cancelled', icon: AlertCircle, color: 'text-muted-foreground' },
  ];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'border-border bg-secondary text-muted-foreground',
  medium: 'border-info/30 text-info bg-info/10',
  high: 'border-warning/30 text-warning bg-warning/10',
  urgent: 'border-destructive/40 text-destructive bg-destructive/10 animate-pulse',
};

export default function Tasks() {
  const { tasks, isLoading, isError, createTask, updateStatus, isCreating } =
    useStaffTasks();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
  });

  type DateFilter = 'today' | 'all';
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (dateFilter === 'today') {
        const taskDate = task.due_at ? new Date(task.due_at) : new Date(task.created_at);
        if (!isToday(taskDate)) return false;
      }

      if (statusFilter !== 'all' && task.status !== statusFilter) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          task.title.toLowerCase().includes(term) ||
          task.patient?.first_name.toLowerCase().includes(term) ||
          task.patient?.last_name.toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [tasks, dateFilter, statusFilter, searchTerm]);

  const todayCount = useMemo(() => {
    return tasks.filter((t) => {
      const d = t.due_at ? new Date(t.due_at) : new Date(t.created_at);
      return isToday(d);
    }).length;
  }, [tasks]);

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedToday = tasks.filter((t) => t.status === 'completed').length;

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;
    createTask({
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
    });
    setNewTask({ title: '', description: '', priority: 'medium' });
    setIsDialogOpen(false);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateStatus({ id: taskId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Action Center
          </h1>
          <p className="text-muted-foreground text-sm animate-pulse">Syncing task queue...</p>
        </div>
        <LoadingState variant="list" rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Action Center
          </h1>
        </div>
        <ErrorState
          title="Connection Interrupted"
          description="Unable to establish a secure connection with the task database."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">

      {/* Header */}
      <div className="relative border-b border-border/40 pb-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Action Center
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Real-time central hub for manual follow-ups, AI escalations, and clinic staff directives.
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12 px-6 bg-primary text-white hover:bg-primary/90 font-semibold tracking-wide rounded-xl shadow-sm">
                <Plus className="h-5 w-5 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border border-border rounded-2xl p-0 overflow-hidden sm:max-w-md shadow-lg">
              <DialogTitle className="sr-only">Create New Task</DialogTitle>
              <div className="bg-secondary/50 border-b border-border/50 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-foreground">New Task Directive</span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Task Title</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="bg-background border-border h-11 text-sm text-foreground focus:ring-primary/20 transition-all rounded-lg"
                    placeholder="Patient follow-up..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description Details</Label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="bg-background border-border min-h-[100px] text-sm text-foreground focus:ring-primary/20 transition-all rounded-lg resize-none"
                    placeholder="Expand on the requirements..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority Level</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask({ ...newTask, priority: value as TaskPriority })}
                  >
                    <SelectTrigger className="bg-background border-border h-11 text-sm text-foreground focus:ring-primary/20 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-xl shadow-sm">
                      <SelectItem value="low" className="font-medium focus:bg-secondary">Low Priority</SelectItem>
                      <SelectItem value="medium" className="text-info font-medium focus:bg-info/10">Standard Priority</SelectItem>
                      <SelectItem value="high" className="text-warning font-medium focus:bg-warning/10">High Priority</SelectItem>
                      <SelectItem value="urgent" className="text-destructive font-medium focus:bg-destructive/10">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 pt-4 border-t border-border/50">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 rounded-xl h-11 text-sm font-semibold border-border hover:bg-secondary transition-colors">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTask}
                    disabled={!newTask.title.trim() || isCreating}
                    className="flex-1 bg-primary text-white hover:bg-primary/90 h-11 rounded-xl text-sm font-semibold transition-all"
                  >
                    {isCreating ? 'Processing...' : 'Create Task'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border shadow-sm rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Search className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Filter Queue</h3>
            </div>

            <div className="space-y-5">
              <div className="relative">
                <Input
                  placeholder="Search tasks..."
                  className="bg-background border-border h-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-primary/20 pl-10 rounded-xl transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex bg-secondary p-1 rounded-xl border border-border/50">
                  <button
                    onClick={() => setDateFilter('today')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-wide",
                      dateFilter === 'today'
                        ? "bg-card shadow-sm text-primary"
                        : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                    )}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Today ({todayCount})
                  </button>
                  <button
                    onClick={() => setDateFilter('all')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-wide",
                      dateFilter === 'all'
                        ? "bg-card shadow-sm text-primary"
                        : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                    )}
                  >
                    All ({tasks.length})
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200",
                      statusFilter === 'all'
                        ? "bg-primary/5 border-primary/30 text-primary"
                        : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide">All Status</span>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", statusFilter === 'all' ? "bg-primary/10" : "bg-secondary")}>{filteredTasks.length}</span>
                  </button>
                  {STATUS_OPTIONS.map((opt) => {
                    const count = tasks.filter((t) => t.status === opt.value).length;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200",
                          statusFilter === opt.value
                            ? "bg-card shadow-sm border-border text-foreground"
                            : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide">{opt.label}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", statusFilter === opt.value ? cn("bg-primary/5", opt.color) : "bg-secondary")}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/50 pb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Zap className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Task Overview</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-xl relative overflow-hidden group">
                <span className="text-xs text-primary font-semibold tracking-wide">In Progress</span>
                <span className="text-2xl font-bold text-primary">{inProgressCount}</span>
                <Cpu className="absolute -right-2 -bottom-2 h-16 w-16 text-primary/5 group-hover:text-primary/10 transition-colors" />
              </div>
              <div className="flex items-center justify-between p-4 bg-success/5 border border-success/10 rounded-xl">
                <span className="text-xs text-success font-semibold tracking-wide">Resolved Today</span>
                <span className="text-xl font-bold text-success">{completedToday}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-warning/5 border border-warning/10 rounded-xl">
                <span className="text-xs text-warning font-semibold tracking-wide">Pending</span>
                <span className="text-xl font-bold text-warning">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border shadow-sm rounded-2xl p-8 min-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-8 border-b border-border/50 pb-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-foreground">Operational Queue</h3>
                  <p className="text-xs font-medium text-muted-foreground capitalize">{statusFilter} Records</p>
                </div>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  title="Queue is Empty"
                  description={statusFilter === 'all' ? 'The queue is currently clear of escalations.' : `No pending records matching current filters.`}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map((task) => {
                  const statusOpt = STATUS_OPTIONS.find((s) => s.value === task.status);
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        "group relative bg-background border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col md:flex-row md:items-center gap-6",
                        task.status === 'in_progress' ? "border-primary/30" : "border-border"
                      )}
                    >
                      <div className={cn(
                        "absolute left-0 top-0 h-full w-[3px]",
                        task.status === 'in_progress' ? "bg-primary animate-pulse" :
                          task.status === 'completed' ? "bg-success" :
                            task.status === 'pending' ? "bg-warning" : "bg-border"
                      )} />

                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className={cn(
                          "h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-full border transition-colors",
                          task.ai_generated ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border/60 text-muted-foreground group-hover:bg-card"
                        )}>
                          {task.ai_generated ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-wide",
                              PRIORITY_STYLES[task.priority]
                            )}>
                              {task.priority} Priority
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">#{task.id.substring(0, 6)}</span>
                          </div>
                          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {task.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:border-l border-border/50 md:pl-6 min-w-[200px]">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Target className="h-3 w-3" /> Subject</p>
                          <p className="text-sm font-semibold text-foreground">{task.patient ? `${task.patient.first_name} ${task.patient.last_name}` : 'Unassigned'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Clock className="h-3 w-3" /> Time</p>
                          <p className="text-sm font-semibold text-foreground">{format(new Date(task.created_at), 'MMM d, h:mm a')}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 ml-auto h-full pl-2">
                        {task.patient?.phone && task.status !== 'completed' && (
                          <a
                            href={`tel:${task.patient.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success hover:bg-success/20 rounded-md transition-colors text-xs font-bold uppercase tracking-wide"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call
                          </a>
                        )}
                        <div className={cn(
                          "px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wide transition-colors",
                          statusOpt?.color,
                          "bg-secondary border-border/50"
                        )}>
                          {statusOpt?.label}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdateStatus={handleStatusChange}
      />
    </div>
  );
}
