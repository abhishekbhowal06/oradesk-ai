import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { PlusCircle, MapPin, Globe, Building2, Phone } from 'lucide-react';

export function Zone2ClinicConfig() {
    const completionPercent = 40;

    return (
        <Card className="h-full border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6">
                <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                        Clinic Configuration
                    </CardTitle>
                    <span className="text-sm font-medium text-slate-500">{completionPercent}% Setup</span>
                </div>
                <Progress value={completionPercent} className="h-2 bg-slate-100" />
                <CardDescription className="mt-2 text-slate-500">
                    Define how the AI represents your practice, handles pricing, and escalates emergencies.
                </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                    {/* Identity */}
                    <AccordionItem value="identity" className="border-slate-100 px-6">
                        <AccordionTrigger className="hover:no-underline py-4 text-slate-700 font-medium">
                            <div className="flex items-center justify-between w-full pr-4">
                                <span>1. Clinic Identity</span>
                                <div className="w-2 h-2 rounded-full bg-emerald-500" /> {/* Status dot */}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                            <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="clinic-name" className="text-slate-600 text-xs uppercase tracking-wider">Practice Name</Label>
                                        <Input id="clinic-name" defaultValue="Smith Dental Excellence" className="border-slate-200 focus-visible:ring-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="doctor-name" className="text-slate-600 text-xs uppercase tracking-wider">Lead Doctor(s)</Label>
                                        <Input id="doctor-name" defaultValue="Dr. Sarah Smith, DDS" className="border-slate-200 focus-visible:ring-emerald-500" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-600 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <MapPin className="w-3 h-3" /> Address
                                    </Label>
                                    <Input defaultValue="123 Medical Plaza, Suite 400" className="border-slate-200 focus-visible:ring-emerald-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <Phone className="w-3 h-3" /> External Phone
                                        </Label>
                                        <Input defaultValue="(555) 123-4567" className="border-slate-200 focus-visible:ring-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <Globe className="w-3 h-3" /> Website
                                        </Label>
                                        <Input defaultValue="https://smithdental.com" className="border-slate-200 focus-visible:ring-emerald-500" />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Save Identity</Button>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Services & Pricing */}
                    <AccordionItem value="services" className="border-slate-100 px-6">
                        <AccordionTrigger className="hover:no-underline py-4 text-slate-700 font-medium">
                            <div className="flex items-center justify-between w-full pr-4">
                                <span>2. Services & Pricing</span>
                                <div className="w-2 h-2 rounded-full bg-slate-300" />
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                            <div className="space-y-4 pt-2">
                                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-medium text-slate-800 text-sm">Routine Cleaning</h4>
                                        <span className="text-emerald-700 font-semibold bg-emerald-100 px-2 py-1 rounded text-xs">Standard</span>
                                    </div>
                                    <div className="flex gap-4 text-sm text-slate-500">
                                        <span>Duration: 45 min</span>
                                        <span>Starting: $120</span>
                                    </div>
                                </div>
                                <div className="p-4 border border-emerald-200 rounded-lg bg-emerald-50/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-medium text-emerald-900 text-sm">Invisalign Consultation</h4>
                                        <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                                            High Value
                                        </span>
                                    </div>
                                    <div className="flex gap-4 text-sm text-slate-600">
                                        <span>Duration: 30 min</span>
                                        <span>Starting: $0 (Free)</span>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                    <PlusCircle className="w-4 h-4" /> Add Treatment
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* AI Safety */}
                    <AccordionItem value="safety" className="border-slate-100 px-6">
                        <AccordionTrigger className="hover:no-underline py-4 text-slate-700 font-medium">
                            <div className="flex items-center justify-between w-full pr-4">
                                <span>3. AI Safety & Escalation</span>
                                <div className="w-2 h-2 rounded-full bg-slate-300" />
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                            <div className="space-y-6 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-slate-800">Medical Disclaimer Mode</Label>
                                        <p className="text-xs text-slate-500">AI will explicitly state it is not a doctor and cannot diagnose.</p>
                                    </div>
                                    <Switch defaultChecked className="data-[state=checked]:bg-emerald-600" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-slate-800">HIPAA Data Anonymization</Label>
                                        <p className="text-xs text-slate-500">Redact PII from transcripts before storage.</p>
                                    </div>
                                    <Switch defaultChecked className="data-[state=checked]:bg-emerald-600" />
                                </div>
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    <Label className="text-slate-800">Escalation Hand-off Number</Label>
                                    <Input placeholder="e.g. Front desk or answering service" />
                                    <p className="text-xs text-slate-500">Calls transfer here when AI confidence drops or patient requests human.</p>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </CardContent>
        </Card>
    );
}
