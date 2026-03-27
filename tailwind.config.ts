import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // TilePOS specific
        pos: {
          surface: "hsl(var(--pos-surface))",
          "surface-container": "hsl(var(--pos-surface-container))",
          "surface-low": "hsl(var(--pos-surface-container-low))",
          "surface-high": "hsl(var(--pos-surface-container-high))",
          "surface-highest": "hsl(var(--pos-surface-container-highest))",
          "surface-lowest": "hsl(var(--pos-surface-container-lowest))",
          "on-surface": "hsl(var(--pos-on-surface))",
          "on-surface-variant": "hsl(var(--pos-on-surface-variant))",
          secondary: "hsl(var(--pos-secondary))",
          "secondary-dim": "hsl(var(--pos-secondary-dim))",
          "secondary-container": "hsl(var(--pos-secondary-container))",
          "on-secondary-container": "hsl(var(--pos-on-secondary-container))",
          tertiary: "hsl(var(--pos-tertiary))",
          "tertiary-container": "hsl(var(--pos-tertiary-container))",
          "on-tertiary-container": "hsl(var(--pos-on-tertiary-container))",
          error: "hsl(var(--pos-error))",
          "error-container": "hsl(var(--pos-error-container))",
          "on-error-container": "hsl(var(--pos-on-error-container))",
          "primary-container": "hsl(var(--pos-primary-container))",
          "on-primary-container": "hsl(var(--pos-on-primary-container))",
          outline: "hsl(var(--pos-outline))",
          "outline-variant": "hsl(var(--pos-outline-variant))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
