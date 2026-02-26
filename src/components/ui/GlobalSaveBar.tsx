import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Undo2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalSaveBarProps {
    isDirty: boolean;
    isSaving: boolean;
    onSave: () => void;
    onRevert: () => void;
}

export function GlobalSaveBar({ isDirty, isSaving, onSave, onRevert }: GlobalSaveBarProps) {
    return (
        <div
            className={cn(
                "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-6 px-6 py-4 bg-[#0d5e5e] text-white rounded-2xl shadow-2xl transition-all duration-300 transform",
                isDirty ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
            )}
        >
            <div className="flex flex-col">
                <span className="text-sm font-bold tracking-wide">You have unsaved changes</span>
                <span className="text-xs text-emerald-100/70 font-medium">Please save or revert your configuration.</span>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRevert}
                    disabled={isSaving}
                    className="border-emerald-700/50 bg-emerald-800/30 text-white hover:bg-emerald-800/50 hover:text-white"
                >
                    <Undo2 className="w-4 h-4 mr-2" />
                    Revert
                </Button>
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving}
                    className="bg-emerald-400 text-teal-950 font-bold hover:bg-emerald-300"
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
