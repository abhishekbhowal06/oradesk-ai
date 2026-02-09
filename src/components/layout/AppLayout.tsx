import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { AIStatusBanner } from './AIStatusBanner';
import { StaffAlertBanner } from '@/components/dashboard/StaffAlertBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Global Staff Alerts - Persistent across all pages */}
      <StaffAlertBanner />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="md:ml-64 min-h-screen pb-20 md:pb-0">
        {/* AI Status Banner */}
        <AIStatusBanner />

        {/* Main Content */}
        <main>
          <div className="max-w-[1400px] mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
