import React from 'react';
import { motion } from 'framer-motion';

interface HologramOrbProps {
    amplitude?: number; // 0 to 255
    idle?: boolean;
}

export function HologramOrb({ amplitude = 0, idle = true }: HologramOrbProps) {
    // Map raw audio amplitude (0 to 255) to scale factor (1.0 to 1.3)
    const scaleTarget = idle ? 1 : 1 + (amplitude / 255) * 0.3;
    // Map to background opacity
    const opacityTarget = idle ? 0.6 : 0.6 + (amplitude / 255) * 0.4;

    return (
        <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Base clinical blue/emerald soft gradient */}
            <motion.div
                animate={{
                    scale: idle ? [1, 1.05, 1] : scaleTarget,
                    opacity: opacityTarget
                }}
                transition={{
                    duration: idle ? 4 : 0.1,
                    ease: idle ? "easeInOut" : "linear",
                    repeat: idle ? Infinity : 0
                }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-100 to-blue-200"
                style={{
                    boxShadow: idle
                        ? '0 0 30px rgba(16, 185, 129, 0.1)'
                        : `0 0 ${40 + amplitude * 0.5}px rgba(16, 185, 129, 0.2)`
                }}
            />
            {/* Inner stable core */}
            <div className="w-32 h-32 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-inner z-10" />
        </div>
    );
}
