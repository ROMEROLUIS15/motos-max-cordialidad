import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const withAlpha = (v: string) => `hsl(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: withAlpha('--border'),
        input: withAlpha('--input'),
        ring: withAlpha('--ring'),
        background: withAlpha('--background'),
        foreground: withAlpha('--foreground'),
        primary: {
          DEFAULT: withAlpha('--primary'),
          foreground: withAlpha('--primary-foreground'),
        },
        secondary: {
          DEFAULT: withAlpha('--secondary'),
          foreground: withAlpha('--secondary-foreground'),
        },
        muted: {
          DEFAULT: withAlpha('--muted'),
          foreground: withAlpha('--muted-foreground'),
        },
        accent: {
          DEFAULT: withAlpha('--accent'),
          foreground: withAlpha('--accent-foreground'),
        },
        destructive: {
          DEFAULT: withAlpha('--destructive'),
          foreground: withAlpha('--destructive-foreground'),
        },
        success: {
          DEFAULT: withAlpha('--success'),
          foreground: withAlpha('--success-foreground'),
        },
        warning: {
          DEFAULT: withAlpha('--warning'),
          foreground: withAlpha('--warning-foreground'),
        },
        card: {
          DEFAULT: withAlpha('--card'),
          foreground: withAlpha('--card-foreground'),
        },
        popover: {
          DEFAULT: withAlpha('--popover'),
          foreground: withAlpha('--popover-foreground'),
        },
        chart: {
          1: withAlpha('--chart-1'),
          2: withAlpha('--chart-2'),
          3: withAlpha('--chart-3'),
          4: withAlpha('--chart-4'),
          5: withAlpha('--chart-5'),
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 hsl(222 47% 11% / 0.04)',
        sm: '0 1px 3px 0 hsl(222 47% 11% / 0.06), 0 1px 2px -1px hsl(222 47% 11% / 0.06)',
        card: '0 1px 2px hsl(222 47% 11% / 0.04), 0 4px 16px -4px hsl(222 47% 11% / 0.08)',
        'card-hover': '0 2px 4px hsl(222 47% 11% / 0.05), 0 12px 28px -6px hsl(222 47% 11% / 0.14)',
        focus: '0 0 0 3px hsl(var(--ring) / 0.35)',
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
        swing: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '10%, 50%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(15deg)' },
          '30%': { transform: 'rotate(-12deg)' },
          '40%': { transform: 'rotate(6deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        swing: 'swing 0.6s ease-in-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
