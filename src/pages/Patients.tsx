import { useState } from 'react';
import { Search, User, Phone, Calendar, FileText, AlertCircle, CheckCircle, XCircle, Plus, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { usePatients, Patient, CreatePatientInput } from '@/hooks/usePatients';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CallPatientButton } from '@/components/patients/CallPatientButton';

export default function Patients() {
  const { patients, isLoading, isError, createPatient, isCreating } = usePatients();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'unreachable'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPatient, setNewPatient] = useState<Partial<CreatePatientInput>>({
    status: 'active',
  });

  const filteredPatients = patients.filter((patient) => {
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      patient.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: Patient['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'inactive':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'unreachable':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: Patient['status']) => {
    switch (status) {
      case 'active':
        return 'Active Patient';
      case 'inactive':
        return 'No recent visits';
      case 'unreachable':
        return 'Contact information may be outdated';
    }
  };

  const handleCreatePatient = () => {
    if (!newPatient.first_name || !newPatient.last_name || !newPatient.phone) return;
    
    createPatient({
      first_name: newPatient.first_name,
      last_name: newPatient.last_name,
      phone: newPatient.phone,
      email: newPatient.email || null,
      date_of_birth: newPatient.date_of_birth || null,
      notes: newPatient.notes || null,
      status: newPatient.status || 'active',
      last_visit: null,
    });
    
    setNewPatient({ status: 'active' });
    setIsDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Patient Registry
            </h1>
            <p className="text-muted-foreground mt-1">Loading patient records...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Patient Registry
          </h1>
        </div>
        <ErrorState 
          title="Failed to Load Patients"
          description="Unable to retrieve patient records. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const activeCount = patients.filter(p => p.status === 'active').length;
  const inactiveCount = patients.filter(p => p.status === 'inactive').length;
  const unreachableCount = patients.filter(p => p.status === 'unreachable').length;

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Patient Registry
          </h1>
          <p className="text-muted-foreground mt-1">
            {patients.length} patients enrolled • {activeCount} active
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="btn-gold w-full md:w-auto flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Register New Patient
            </button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10">
            <DialogHeader>
              <DialogTitle>Register New Patient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={newPatient.first_name || ''}
                    onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={newPatient.last_name || ''}
                    onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={newPatient.phone || ''}
                  onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newPatient.email || ''}
                  onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                  placeholder="patient@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={newPatient.date_of_birth || ''}
                  onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newPatient.status}
                  onValueChange={(value) => setNewPatient({ ...newPatient, status: value as Patient['status'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="unreachable">Unreachable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newPatient.notes || ''}
                  onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                  placeholder="Any relevant notes..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePatient}
                  disabled={!newPatient.first_name || !newPatient.last_name || !newPatient.phone || isCreating}
                  className="flex-1 btn-gold"
                >
                  {isCreating ? 'Creating...' : 'Register Patient'}
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
          All ({patients.length})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
            statusFilter === 'active'
              ? 'bg-success/20 text-success'
              : 'bg-white/5 text-muted-foreground hover:text-foreground'
          )}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Active ({activeCount})
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
            statusFilter === 'inactive'
              ? 'bg-warning/20 text-warning'
              : 'bg-white/5 text-muted-foreground hover:text-foreground'
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Inactive ({inactiveCount})
        </button>
        <button
          onClick={() => setStatusFilter('unreachable')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
            statusFilter === 'unreachable'
              ? 'bg-destructive/20 text-destructive'
              : 'bg-white/5 text-muted-foreground hover:text-foreground'
          )}
        >
          <XCircle className="h-3.5 w-3.5" />
          Unreachable ({unreachableCount})
        </button>
      </div>

      {/* Search */}
      <div className="glass-surface p-1">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full bg-transparent py-3 pl-12 pr-4 text-foreground',
              'placeholder:text-muted-foreground focus:outline-none'
            )}
          />
        </div>
      </div>

      {/* Patients Grid */}
      {filteredPatients.length === 0 ? (
        <EmptyState
          type="patients"
          title="No Patients Found"
          description={searchQuery 
            ? `No patients match "${searchQuery}". Try adjusting your search criteria.`
            : 'No patients match the selected filter. Adjust filters to view records.'
          }
          action={searchQuery ? { label: 'Clear Search', onClick: () => setSearchQuery('') } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => setSelectedPatient(patient.id)}
              className="glass-card hover-glow p-5 text-left transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-medium text-foreground truncate">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <SystemTooltip content={getStatusLabel(patient.status)}>
                      {getStatusIcon(patient.status)}
                    </SystemTooltip>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{patient.phone}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Last visit: {formatDate(patient.last_visit)}</span>
                </div>
                {patient.notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                    {patient.notes}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (() => {
        const patient = patients.find((p) => p.id === selectedPatient);
        if (!patient) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedPatient(null)}
          >
            <div
              className="glass-card w-full max-w-lg p-6 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-foreground">
                      {patient.first_name} {patient.last_name}
                    </h3>
                    <SystemTooltip content={getStatusLabel(patient.status)}>
                      {getStatusIcon(patient.status)}
                    </SystemTooltip>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Patient Record</p>
                </div>
              </div>

              {patient.status === 'unreachable' && (
                <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive font-medium">Contact Verification Required</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI was unable to reach this patient. Please verify contact information.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm text-foreground">{patient.phone}</p>
                  </div>
                </div>
                
                {patient.email && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm text-foreground">{patient.email}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Visit</p>
                    <p className="text-sm text-foreground">{formatDate(patient.last_visit)}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02]">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Clinical Notes</p>
                    <p className="text-sm text-foreground">{patient.notes || 'No notes recorded'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="py-2.5 px-4 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
                <div className="flex-1" />
                <CallPatientButton
                  patientId={patient.id}
                  patientName={`${patient.first_name} ${patient.last_name}`}
                  phoneNumber={patient.phone}
                  callType="confirmation"
                />
                <button className="btn-gold text-sm">
                  Schedule Appointment
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
