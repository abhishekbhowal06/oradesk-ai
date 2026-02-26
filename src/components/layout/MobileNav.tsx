import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Phone, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Patients', icon: Users, path: '/patients' },
  { label: 'Calls', icon: Phone, path: '/calls' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass-surface border-t border-white/5 px-2 py-2 safe-area-pb">
        <ul className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
