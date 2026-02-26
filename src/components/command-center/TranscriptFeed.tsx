import React from 'react';

export function TranscriptFeed() {
    // Placeholder for real-time transcript data
    const transcripts = [
        { id: '1', role: 'ai', content: 'Good morning, this is the OraDesk AI at Dr. Smith\'s clinic. How can I help you today?' },
        { id: '2', role: 'user', content: 'Hi, I need to schedule a cleaning.' },
        { id: '3', role: 'ai', content: 'I can help with that. Are you an existing patient, or is this your first visit?' },
    ];

    return (
        <div className="flex flex-col h-[300px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {transcripts.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user'
                                ? 'bg-slate-100 text-slate-800 rounded-tr-none'
                                : 'bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-tl-none'
                            }`}
                    >
                        <span className="block text-[10px] font-medium opacity-50 mb-1 uppercase tracking-wider">
                            {msg.role === 'ai' ? 'AI Assistant' : 'Patient'}
                        </span>
                        {msg.content}
                    </div>
                </div>
            ))}
        </div>
    );
}
