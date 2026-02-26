/**
 * ORADESK — ANIMATED COUNT-UP COMPONENT
 *
 * Displays a number that smoothly counts up from previous value to new value.
 * Uses requestAnimationFrame with ease-out cubic.
 * Triggers a subtle glow on value increase.
 *
 * Props:
 *   value     — target number
 *   prefix    — e.g. '$', '₹'
 *   suffix    — e.g. '%', 'h'
 *   duration  — count-up duration in ms (default 800)
 *   decimals  — decimal places (default 0)
 *   glowColor — CSS color for value-change glow
 */

import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { animateCountUp, prefersReducedMotion } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface AnimatedCountUpProps {
    value: number;
    prefix?: string;
    suffix?: string;
    duration?: number;
    decimals?: number;
    className?: string;
    glowColor?: string;
    /** If true, shows a brief glow when value changes */
    enableGlow?: boolean;
    /** Format with locale separators */
    localeFormat?: boolean;
}

export const AnimatedCountUp = memo(function AnimatedCountUp({
    value,
    prefix = '',
    suffix = '',
    duration = 800,
    decimals = 0,
    className,
    glowColor = 'rgba(16, 185, 129, 0.15)',
    enableGlow = true,
    localeFormat = true,
}: AnimatedCountUpProps) {
    const [displayed, setDisplayed] = useState(value);
    const prevValue = useRef(value);
    const [isGlowing, setIsGlowing] = useState(false);
    const cancelRef = useRef<(() => void) | null>(null);

    const formatNumber = useCallback(
        (n: number) => {
            if (localeFormat) {
                return n.toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                });
            }
            return n.toFixed(decimals);
        },
        [decimals, localeFormat],
    );

    useEffect(() => {
        // Skip animation if no change or reduced motion
        if (value === prevValue.current) return;
        if (prefersReducedMotion()) {
            setDisplayed(value);
            prevValue.current = value;
            return;
        }

        // Cancel any in-progress animation
        cancelRef.current?.();

        const from = prevValue.current;
        const isIncrease = value > from;

        // Trigger glow on increase
        if (isIncrease && enableGlow) {
            setIsGlowing(true);
            setTimeout(() => setIsGlowing(false), 2000);
        }

        cancelRef.current = animateCountUp(
            from,
            value,
            duration,
            (current) => setDisplayed(current),
            () => {
                prevValue.current = value;
            },
        );

        return () => {
            cancelRef.current?.();
        };
    }, [value, duration, enableGlow]);

    return (
        <motion.span
            className={cn(
                'inline-block tabular-nums transition-shadow duration-500',
                className,
            )}
            style={{
                boxShadow: isGlowing
                    ? `0 0 20px 6px ${glowColor}`
                    : '0 0 0px 0px transparent',
                borderRadius: '6px',
                padding: '0 2px',
            }}
            aria-live="polite"
            aria-atomic="true"
        >
            {prefix}
            {formatNumber(displayed)}
            {suffix}
        </motion.span>
    );
});
