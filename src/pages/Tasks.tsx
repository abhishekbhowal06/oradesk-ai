import { useState } from 'react';
import { ClipboardList, Bot, User, Calendar, CheckCircle, Clock, AlertCircle, Filter, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { useStaffTasks, TaskStatus, TaskPriority } from '@/hooks/useStaffTasks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: typeof CheckCircle; color: string }[] = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-warning' },
  { value: 'in_progress', label: 'In Progress', icon: AlertCircle, color: 'text-info' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-success' },
  { value: 'cancelled', label: 'Cancelled', icon: AlertCircle, color: 'text-muted-foreground' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-muted/20 text-muted-foreground',
  medium: 'bg-info/20 text-info',
  high: 'bg-warning/20 text-warning',
  urgent: 'bg-destructive/20 text-destructive',
};

export default function Tasks() {
  const { tasks, isLoading, isError, createTask, updateStatus, isCreating, isUpdating } = useStaffTasks();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
  });

  const filteredTasks = tasks.filter(task => 
    statusFilter === 'all' || task.status === statusFilter
  );

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const aiGeneratedCount = tasks.filter(t => t.ai_generated).length;

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Staff Tasks
          </h1>
          <p className="text-muted-foreground mt-1">Loading task queue...</p>
        </div>
        <LoadingState variant="list" rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Staff Tasks
          </h1>
        </div>
        <ErrorState 
          title="Failed to Load Tasks"
          description="Unable to retrieve staff tasks. Please try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Staff Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            {pendingCount} pending • {inProgressCount} in progress • {aiGeneratedCount} AI-generated
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gold gap-2">
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Task details..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={!newTask.title.trim() || isCreating}
                  className="flex-1 btn-gold"
                >
                  {isCreating ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-white/5 text-muted-foreground hover:text-foreground'
          )}
        >
          All ({tasks.length})
        </button>
        {STATUS_OPTIONS.map(opt => {
          const count = tasks.filter(t => t.status === opt.value).length;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
                statusFilter === opt.value
                  ? 'bg-white/10 text-foreground'
                  : 'bg-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', opt.color)} />
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          type="tasks"
          title="No Tasks Found"
          description={statusFilter === 'all' 
            ? "No tasks have been created yet. AI escalations and manual tasks will appear here."
            : `No tasks with "${statusFilter}" status.`
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const statusOpt = STATUS_OPTIONS.find(s => s.value === task.status);
            const StatusIcon = statusOpt?.icon || Clock;
            
            return (
              <div
                key={task.id}
                className="glass-card p-5 hover-glow transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  {/* AI Badge */}
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    task.ai_generated ? 'bg-primary/10' : 'bg-white/5'
                  )}>
                    {task.ai_generated ? (
                      <Bot className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-medium text-foreground">
                        {task.title}
                      </h3>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium capitalize',
                        PRIORITY_COLORS[task.priority]
                      )}>
                        {task.priority}
                      </span>
                      {task.ai_generated && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          AI Escalated
                        </span>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {task.patient && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.patient.first_name} {task.patient.last_name}
                        </span>
                      )}
                      {task.due_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(task.due_at).toLocaleDateString()}
                        </span>
                      )}
                      <span>
                        Created: {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Status Selector */}
                  <div className="flex-shrink-0">
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleStatusChange(task.id, value as TaskStatus)}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-[140px]">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={cn('h-4 w-4', statusOpt?.color)} />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className={cn('h-4 w-4', opt.color)} />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
