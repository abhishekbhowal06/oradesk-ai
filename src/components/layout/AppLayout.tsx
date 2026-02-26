import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { AIStatusBanner } from './AIStatusBanner';
import { StaffAlertBanner } from '@/components/dashboard/StaffAlertBanner';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary">
      {/* Global Staff Alerts - Persistent across all pages */}
      <StaffAlertBanner />

      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed inset-y-0 z-50">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="md:pl-72 min-h-screen relative flex flex-col">

        {/* Premium Paper Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0 bg-background" />
        <div className="fixed inset-0 pointer-events-none z-0 paper-texture" />
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent opacity-80" />

        <div className="relative z-10 flex flex-col flex-1">
          {/* AI Status Banner */}
          <AIStatusBanner />

          {/* Main Content */}
          <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10">
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {children}
            </div>
          </main>

          {/* Clean Footer - Copyright Only */}
          <footer className="py-6 px-8 border-t border-border/40 text-center md:text-left text-muted-foreground">
            <p className="text-xs font-medium">
              &copy; {new Date().getFullYear()} Dentacore AI. Trusted by top clinics.
            </p>
          </footer>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      <style>{`
        /* Smooth, subtle transitions */
        .fade-enter {
          opacity: 0;
        }
        .fade-enter-active {
          opacity: 1;
          transition: opacity 200ms ease-in;
        }
        .fade-exit {
          opacity: 1;
        }
        .fade-exit-active {
          opacity: 0;
          transition: opacity 200ms ease-in;
        }
      `}</style>
    </div>
  );
}
