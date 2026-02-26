export function getStatusHtml(status: any): string {
    const { twilio, gemini, database, overallHealthy } = status;

    const getBadgeClass = (healthy: boolean) => healthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const getStatusText = (healthy: boolean) => healthy ? 'OPERATIONAL' : 'DEGRADED';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OraDesk AI | System Status</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .grid-bg { background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 20px 20px; }
    </style>
</head>
<body class="bg-slate-50 grid-bg min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div class="p-6 border-b border-slate-100">
            <div class="flex items-center justify-between mb-2">
                <h1 class="text-xl font-bold text-slate-900">System Status</h1>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${overallHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                    ${overallHealthy ? 'SYSTEMS NORMAL' : 'INCIDENT DETECTED'}
                </span>
            </div>
            <p class="text-slate-500 text-sm">Real-time infrastructure health monitor</p>
        </div>
        
        <div class="p-6 space-y-4">
            <!-- Twilio -->
            <div class="flex items-center justify-between p-3 rounded-lg border border-slate-50 bg-slate-50/50">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${twilio ? 'bg-emerald-500' : 'bg-red-500'}"></div>
                    <span class="text-sm font-medium text-slate-700">Voice Network (Twilio)</span>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider ${twilio ? 'text-emerald-600' : 'text-red-600'}">
                    ${twilio ? 'Operational' : 'Issues'}
                </span>
            </div>
            
            <!-- Gemini -->
            <div class="flex items-center justify-between p-3 rounded-lg border border-slate-50 bg-slate-50/50">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${gemini ? 'bg-emerald-500' : 'bg-red-500'}"></div>
                    <span class="text-sm font-medium text-slate-700">AI Logic (Gemini)</span>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider ${gemini ? 'text-emerald-600' : 'text-red-600'}">
                    ${gemini ? 'Operational' : 'Issues'}
                </span>
            </div>
            
            <!-- Database -->
            <div class="flex items-center justify-between p-3 rounded-lg border border-slate-50 bg-slate-50/50">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${database ? 'bg-emerald-500' : 'bg-red-500'}"></div>
                    <span class="text-sm font-medium text-slate-700">Records Engine (Supabase)</span>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider ${database ? 'text-emerald-600' : 'text-red-600'}">
                    ${database ? 'Operational' : 'Issues'}
                </span>
            </div>
        </div>
        
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
            <span>Refreshed: ${new Date().toLocaleTimeString()}</span>
            <a href="#" class="hover:text-slate-600 transition-colors">Support Center →</a>
        </div>
    </div>
</body>
</html>
  `;
}
