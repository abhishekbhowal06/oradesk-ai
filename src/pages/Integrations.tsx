import React, { useState } from 'react';
import { useClinic } from '@/contexts/ClinicContext';
import { Loader2 } from 'lucide-react';
import { SystemConnectivityHeader } from '@/components/integrations/SystemConnectivityHeader';
import { IntegrationSidebar } from '@/components/integrations/IntegrationSidebar';
import { IntegrationActivityPanel } from '@/components/integrations/IntegrationActivityPanel';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { INTEGRATION_DATA } from '@/components/integrations/IntegrationData';

const Integrations = () => {
  const { currentClinic } = useClinic();
  const [activeCategory, setActiveCategory] = useState('all');
  const [devMode, setDevMode] = useState(false);

  if (!currentClinic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#0d5e5e]/40" />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Loading Configuration...</span>
      </div>
    );
  }

  // Filter integrations based on selected category in the sidebar
  const filteredIntegrations = INTEGRATION_DATA.filter(int => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'connected') return int.status === 'connected';
    return int.category === activeCategory;
  });

  return (
    <div className="animate-in fade-in duration-700 pb-20">

      {/* Premium Header Status Row */}
      <SystemConnectivityHeader />

      {/* Main 3-Column Layout */}
      <div className="flex flex-col xl:flex-row gap-8">

        {/* Left: Filter Sidebar */}
        <div className="xl:sticky xl:top-8 self-start w-full xl:w-64 shrink-0 z-10">
          <IntegrationSidebar
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            devMode={devMode}
            setDevMode={setDevMode}
          />
        </div>

        {/* Center: Modular Integration Grid */}
        <div className="flex-1">

          {filteredIntegrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed text-center px-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-1">No Active Connections</h3>
              <p className="text-sm font-medium text-slate-500 max-w-sm">
                There are currently no integrations active in this category. Select a provider to begin setup.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredIntegrations.map((integration) => (
                <IntegrationCard key={integration.id} {...integration} />
              ))}
            </div>
          )}

        </div>

        {/* Right: Activity & Event Logs */}
        <div className="xl:sticky xl:top-8 self-start w-full xl:w-80 shrink-0 z-10 hidden lg:block">
          <IntegrationActivityPanel />
        </div>
      </div>
    </div>
  );
};

export default Integrations;
