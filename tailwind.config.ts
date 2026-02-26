import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
        '2xl': '1rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(43 67% 52% / 0.4)' },
          '50%': { boxShadow: '0 0 20px 5px hsl(43 67% 52% / 0.2)' },
        },
        /* Reward System Keyframes */
        'value-glow': {
          '0%': { boxShadow: '0 0 0px 0px rgba(16, 185, 129, 0)' },
          '40%': { boxShadow: '0 0 16px 4px rgba(16, 185, 129, 0.12)' },
          '100%': { boxShadow: '0 0 0px 0px rgba(16, 185, 129, 0)' },
        },
        'revenue-glow': {
          '0%': { boxShadow: '0 0 0px 0px rgba(13, 94, 94, 0)' },
          '40%': { boxShadow: '0 0 20px 6px rgba(13, 94, 94, 0.1)' },
          '100%': { boxShadow: '0 0 0px 0px rgba(13, 94, 94, 0)' },
        },
        'risk-relief': {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.08)' },
          '50%': { backgroundColor: 'rgba(16, 185, 129, 0.06)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'count-settle': {
          '0%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'badge-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'pulse-gold': 'pulse-gold 2s infinite',
        /* Reward System Animations */
        'value-glow': 'value-glow 2s cubic-bezier(0.33, 1, 0.68, 1)',
        'revenue-glow': 'revenue-glow 2s cubic-bezier(0.33, 1, 0.68, 1)',
        'risk-relief': 'risk-relief 1.5s cubic-bezier(0.33, 1, 0.68, 1)',
        'soft-pulse': 'soft-pulse 2s ease-in-out infinite',
        'count-settle': 'count-settle 0.22s cubic-bezier(0.33, 1, 0.68, 1)',
        'badge-pop': 'badge-pop 0.28s cubic-bezier(0.33, 1, 0.68, 1)',
      },
      boxShadow: {
        glass: 'inset 0 1px 1px rgba(255, 255, 255, 0.06), 0 4px 24px rgba(0, 0, 0, 0.3)',
        'glass-hover': 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.4)',
        gold: '0 4px 16px hsl(43 67% 52% / 0.3)',
        'gold-hover': '0 6px 24px hsl(43 67% 52% / 0.4)',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '48px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
