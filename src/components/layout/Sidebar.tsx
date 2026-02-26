import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  Bot,
  Megaphone,
  CheckSquare,
  LogOut,
  Inbox,
  Smartphone
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    description: 'Overview & KPIs'
  },
  {
    label: 'Conversations',
    icon: Inbox,
    path: '/conversations',
    description: 'Unified Inbox'
  },
  {
    label: 'Patients',
    icon: Users,
    path: '/patients',
    description: 'Clinic CRM'
  },
  {
    label: 'Leads',
    icon: Megaphone,
    path: '/leads',
    description: 'Sales Pipeline'
  },
  {
    label: 'Appointments',
    icon: Calendar,
    path: '/calendar',
    description: 'Schedule Sync'
  },
  {
    label: 'Campaigns',
    icon: Megaphone,
    path: '/campaigns',
    description: 'Recall & Follow-ups'
  },
  {
    label: 'Phone & WhatsApp',
    icon: Smartphone,
    path: '/channels',
    description: 'Connect Lines'
  },
  {
    label: 'AI Agents',
    icon: Bot,
    path: '/agents',
    description: 'Voice & WhatsApp'
  },
  {
    label: 'Integrations',
    icon: CheckSquare,
    path: '/integrations',
    description: 'PMS & APIs'
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    description: 'Clinic Confguration'
  },
];

// New Logo: Rounded + cross symbol + neutral nodes
const MedicalAILogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Soft teal gradient background cross */}
    <defs>
      <linearGradient id="tealGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2FA4A4" />
        <stop offset="1" stopColor="#1F8A8A" />
      </linearGradient>
    </defs>
    <path d="M10 3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V10H21C21.5523 10 22 10.4477 22 11V13C22 13.5523 21.5523 14 21 14H14V21C14 21.5523 13.5523 22 13 22H11C10.4477 22 10 21.5523 10 21V14H3C2.44772 14 2 13.5523 2 13V11C2 10.4477 2.44772 10 3 10H10V3Z" fill="url(#tealGrad)" />

    {/* Neural node dots */}
    <circle cx="12" cy="7" r="1.5" fill="white" opacity="0.9" />
    <circle cx="12" cy="17" r="1.5" fill="white" opacity="0.9" />
    <circle cx="7" cy="12" r="1.5" fill="white" opacity="0.9" />
    <circle cx="17" cy="12" r="1.5" fill="white" opacity="0.9" />
    <circle cx="12" cy="12" r="2.5" fill="white" />
    {/* Connection lines */}
    <line x1="12" y1="8.5" x2="12" y2="9.5" stroke="white" strokeWidth="1" opacity="0.5" />
    <line x1="12" y1="14.5" x2="12" y2="15.5" stroke="white" strokeWidth="1" opacity="0.5" />
    <line x1="8.5" y1="12" x2="9.5" y2="12" stroke="white" strokeWidth="1" opacity="0.5" />
    <line x1="14.5" y1="12" x2="15.5" y2="12" stroke="white" strokeWidth="1" opacity="0.5" />
  </svg>
);

export function Sidebar() {
  const { signOut, user } = useAuth();
  const { currentClinic } = useClinic();
  const location = useLocation();

  return (
    <div className="flex bg-sidebar h-full w-72 flex-col border-r border-sidebar-border z-50 transition-all duration-300">
      {/* Brand Header */}
      <div className="flex h-20 items-center px-6 border-b border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <MedicalAILogo />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-sidebar-foreground group-hover:text-primary transition-colors">
              OraDesk AI
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Clinical OS
            </span>
          </div>
        </div>
      </div>

      {/* Clinic Context */}
      <div className="px-5 py-6">
        <div className="relative overflow-hidden rounded-xl bg-card border border-border shadow-sm p-4 group">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                Active Clinic
              </span>
              <div className="h-2 w-2 rounded-full bg-success/80 shadow-sm" />
            </div>
            <p className="font-semibold text-sm text-foreground truncate pl-0.5">
              {currentClinic?.name || 'Loading...'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 border",
                  isActive
                    ? "bg-white text-primary border-border/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    : "border-transparent text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )
              }
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <div className="flex flex-col">
                <span className={cn("text-sm transition-all duration-150", isActive ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </div>

              {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-sidebar-border p-4 bg-sidebar/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shadow-sm">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold text-foreground truncate">
              {user?.email}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              Administrator
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive group"
        >
          <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
