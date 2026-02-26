import React from 'react';
import { Database, RefreshCcw, Eye, FileText, Globe, Bot, Send, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface KnowledgeTabProps {
    isTestKnowledgeLoading: boolean;
    setIsTestKnowledgeLoading: (loading: boolean) => void;
    knowledgeTestResult: string | null;
    setKnowledgeTestResult: (result: string | null) => void;
    toast: any;
}

export default function KnowledgeTab({
    isTestKnowledgeLoading,
    setIsTestKnowledgeLoading,
    knowledgeTestResult,
    setKnowledgeTestResult,
    toast,
}: KnowledgeTabProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Knowledge Base Overview */}
            <div className="xl:col-span-8 space-y-6">
                <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
                    <div className="relative h-24 w-24 rounded-full border-4 border-emerald-100 flex items-center justify-center shrink-0">
                        <div className="absolute inset-0 rounded-full border-4 border-[#0d5e5e] border-l-transparent border-b-transparent rotate-45"></div>
                        <div className="text-center">
                            <div className="text-xl font-black text-[#0d5e5e]">92%</div>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-foreground">Knowledge Coverage</h3>
                        <p className="text-sm text-slate-500 mt-1 mb-4">
                            The AI has high confidence in understanding clinic pricing, insurance, and scheduling
                            based on provided data.
                        </p>
                        <div className="flex gap-4">
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                                <Database className="h-3 w-3 mr-1" /> 24 Indexed Docs
                            </Badge>
                            <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                                <RefreshCcw className="h-3 w-3 mr-1" /> Trained 2h ago
                            </Badge>
                        </div>
                    </div>
                    <Button className="bg-[#0d5e5e] hover:bg-[#093e3e] shadow-md rounded-xl font-bold shrink-0" onClick={() => toast({ title: 'KB_RETRAINING_STARTED', description: 'Triggering background embedding job.' })}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Retrain AI Model
                    </Button>
                </div>

                <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <CardTitle className="text-lg font-bold">Document Vectors</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4">Source Name</th>
                                    <th className="p-4">Type & Size</th>
                                    <th className="p-4">Confidence Score</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-blue-500" /> oradesk.com/pricing
                                    </td>
                                    <td className="p-4 text-slate-500">Web Scrape • 45 pages</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Progress value={95} className="w-16 h-1.5" />{' '}
                                            <span className="text-xs font-bold text-emerald-600">95%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-orange-500" /> FAQ_Manual_2026.pdf
                                    </td>
                                    <td className="p-4 text-slate-500">PDF • 2.4 MB</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Progress value={88} className="w-16 h-1.5" />{' '}
                                            <span className="text-xs font-bold text-emerald-600">88%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {/* Simulator & Uploder */}
            <div className="xl:col-span-4 space-y-6">
                <Card className="rounded-[2rem] border-slate-200 shadow-sm bg-slate-900 border-none overflow-hidden relative">
                    <div className="absolute top-0 inset-x-0 h-1bg-gradient-to-r from-emerald-400 to-blue-500" />
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                            <Bot className="h-5 w-5 text-emerald-400" /> Test AI Knowledge
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-slate-800 p-4 rounded-xl min-h-[120px] text-sm text-slate-300 font-mono relative">
                            {isTestKnowledgeLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <RefreshCcw className="h-5 w-5 animate-spin text-emerald-400" />
                                </div>
                            ) : knowledgeTestResult ? (
                                <span>
                                    <span className="text-emerald-400 font-bold">[AI]:</span> {knowledgeTestResult}
                                </span>
                            ) : (
                                <span className="opacity-50">
                                    Ask a question to see how the AI responds based on its training data...
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="e.g. Do you accept Delta Dental?"
                                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsTestKnowledgeLoading(true);
                                        setTimeout(() => {
                                            setKnowledgeTestResult(
                                                'Yes, we are in-network with Delta Dental Premier. Would you like me to verify your specific benefits?',
                                            );
                                            setIsTestKnowledgeLoading(false);
                                        }, 1000);
                                    }
                                }}
                            />
                            <Button size="icon" className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                                <Send className="h-4 w-4 text-slate-900" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div
                    className="bg-slate-50 border border-dashed border-slate-300 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer group"
                    onClick={() => toast({ title: 'UPLOAD_INITIALIZED', description: 'Opening secure file upload portal.' })}
                >
                    <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-[#0d5e5e]" />
                    </div>
                    <h3 className="font-bold text-foreground">Ingest New Data</h3>
                    <p className="text-xs text-slate-500 mt-2">
                        Drag & drop PDFs or click to browse. Max 50MB per file.
                    </p>
                </div>
            </div>
        </div>
    );
}
