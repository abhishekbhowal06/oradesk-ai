import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Phone,
  BarChart3,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Building,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClinic } from '@/contexts/ClinicContext';
import logoIcon from '@/assets/dentacor-logo-icon.png';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Patients', icon: Users, path: '/patients' },
  { label: 'Call History', icon: Phone, path: '/calls' },
  { label: 'Tasks', icon: ClipboardList, path: '/tasks' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentClinic, isLoading } = useClinic();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-out',
        'glass-surface border-r border-white/5',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b border-white/5",
        collapsed ? "justify-center px-2" : "gap-3 px-4"
      )}>
        <img
          src={logoIcon}
          alt="DENTACOR"
          className="h-12 w-12 object-contain flex-shrink-0"
        />
        {!collapsed && (
          <span className="text-lg font-semibold tracking-wide text-foreground">
            DENTACOR
          </span>
        )}
      </div>

      {/* Clinic Info */}
      {!collapsed && currentClinic && (
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground font-medium truncate">
              {currentClinic.name}
            </span>
          </div>
        </div>
      )}

      {/* New Booking Button */}
      <div className="p-4">
        <button
          className={cn(
            'btn-gold w-full flex items-center justify-center gap-2 text-sm',
            collapsed && 'px-3'
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>New Booking</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                    'text-sidebar-foreground hover:text-foreground',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-white/5',
                    collapsed && 'justify-center'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                  {!collapsed && (
                    <span className={cn('text-sm font-medium', isActive && 'text-primary')}>
                      {item.label}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Toggle */}
      <div className="absolute bottom-4 left-0 right-0 px-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl',
            'text-muted-foreground hover:text-foreground hover:bg-white/5',
            'transition-all duration-200'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
