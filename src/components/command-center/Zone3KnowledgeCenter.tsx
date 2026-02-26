import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { BookOpen, UploadCloud, Link as LinkIcon, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export function Zone3KnowledgeCenter() {
    const isHealthy = true;

    return (
        <Card className="h-full border-slate-200 shadow-sm bg-white flex flex-col">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6 flex-none">
                <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-emerald-600" />
                        Knowledge & Training
                    </CardTitle>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {isHealthy ? 'Knowledge Health: Good' : 'Needs Update'}
                    </div>
                </div>
                <CardDescription className="text-slate-500">
                    Train the AI by uploading your clinic's specific FAQs, policies, and documents.
                </CardDescription>
            </CardHeader>

            <CardContent className="p-6 flex-1 flex flex-col space-y-6">

                {/* Upload Area */}
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-6 h-6" />
                    </div>
                    <h4 className="text-slate-800 font-medium mb-1">Upload Documents</h4>
                    <p className="text-sm text-slate-500 mb-4 px-4">PDF, Word, or Text files containing clinic policies or treatment details.</p>
                    <div className="flex gap-2 text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Max 10MB</span>
                    </div>
                </div>

                {/* Alternative Sources */}
                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-auto py-4 flex flex-col items-center justify-center gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300">
                        <LinkIcon className="w-5 h-5 text-slate-500" />
                        <span className="text-sm text-slate-700">Add Website URL</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex flex-col items-center justify-center gap-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300">
                        <FileText className="w-5 h-5 text-slate-500" />
                        <span className="text-sm text-slate-700">Manual FAQ Text</span>
                    </Button>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        <p><strong>Storage:</strong> 2.4 MB / 100 MB used</p>
                        <p><strong>Last trained:</strong> Today, 08:30 AM</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium px-6">
                        Retrain AI
                    </Button>
                </div>

            </CardContent>
        </Card>
    );
}
