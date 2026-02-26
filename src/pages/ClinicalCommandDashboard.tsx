import React from 'react';
import { IntelligenceTopbar } from '../components/command-center/IntelligenceTopbar';
import { Zone1BrainCore } from '../components/command-center/Zone1BrainCore';
import { Zone2ClinicConfig } from '../components/command-center/Zone2ClinicConfig';
import { Zone3KnowledgeCenter } from '../components/command-center/Zone3KnowledgeCenter';
import { Zone4Deployment } from '../components/command-center/Zone4Deployment';

export function ClinicalCommandDashboard() {
    return (
        <div className="flex flex-col min-h-screen bg-slate-100 font-sans">

            {/* Sticky Global Topbar */}
            <IntelligenceTopbar />

            {/* Main Grid Layout */}
            <main className="flex-1 p-8">
                <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* LEFT COLUMN: The "Living" AI Core (Sticky) - Zone 1 */}
                    <div className="md:col-span-5 lg:col-span-4 lg:sticky lg:top-24 h-[calc(100vh-120px)] flex flex-col">
                        <Zone1BrainCore />
                    </div>

                    {/* RIGHT COLUMN: Configuration & Integration (Scrollable) */}
                    <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-8 pb-12">

                        {/* Top Row: Zone 2 & 3 */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
                            <div className="flex flex-col">
                                <Zone2ClinicConfig />
                            </div>
                            <div className="flex flex-col">
                                <Zone3KnowledgeCenter />
                            </div>
                        </div>

                        {/* Bottom Row: Zone 4 */}
                        <div className="flex-1 w-full relative z-0">
                            <Zone4Deployment />
                        </div>

                    </div>

                </div>
            </main>

        </div>
    );
}

// Ensure default export if used in lazy loading or routing directly
export default ClinicalCommandDashboard;
