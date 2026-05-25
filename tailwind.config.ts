import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
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
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			score: {
  				e: 'hsl(var(--score-e))',
  				p: 'hsl(var(--score-p))',
  				c: 'hsl(var(--score-c))',
  				f: 'hsl(var(--score-f))',
  				d: 'hsl(var(--score-d))',
  				r: 'hsl(var(--score-r))'
  			},
  			severity: {
  				leve: 'hsl(var(--severity-leve))',
  				moderado: 'hsl(var(--severity-moderado))',
  				severo: 'hsl(var(--severity-severo))',
  				critico: 'hsl(var(--severity-critico))',
  				extremo: 'hsl(var(--severity-extremo))'
  			},
  			identidade: {
  				DEFAULT: 'hsl(var(--identidade))',
  				light: 'hsl(var(--identidade-light))',
  				foreground: 'hsl(var(--identidade-foreground))',
  				muted: 'hsl(var(--identidade-muted))'
  			},
  			studio: {
  				DEFAULT: 'hsl(var(--studio))',
  				light: 'hsl(var(--studio-light))',
  				foreground: 'hsl(var(--studio-foreground))',
  				muted: 'hsl(var(--studio-muted))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		fontFamily: {
			sans: [
				'Inter',
				'ui-sans-serif',
				'system-ui',
				'-apple-system',
				'BlinkMacSystemFont',
				'Segoe UI',
				'Roboto',
				'Helvetica Neue',
				'Arial',
				'Noto Sans',
				'sans-serif'
			],
			mono: [
				'ui-monospace',
				'SFMono-Regular',
				'Menlo',
				'Monaco',
				'Consolas',
				'Liberation Mono',
				'Courier New',
				'monospace'
			],
		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'slide-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'pulse-ring': {
  				'0%, 100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				},
  				'50%': {
  					transform: 'scale(1.05)',
  					opacity: '0.8'
  				}
  			},
  			'score-reveal': {
  				from: {
  					transform: 'scale(0.8)',
  					opacity: '0'
  				},
  				to: {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			},
  			'shimmer': {
  				'100%': { transform: 'translateX(100%)' }
  			},
  			'confetti-fall': {
  				'0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
  				'100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' }
  			},
  			'pulse-urgent': {
  				'0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--destructive) / 0.55)' },
  				'50%': { boxShadow: '0 0 0 8px hsl(var(--destructive) / 0)' }
  			},
  			'pulse-soft': {
  				'0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--warning) / 0.45)' },
  				'50%': { boxShadow: '0 0 0 6px hsl(var(--warning) / 0)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'slide-in': 'slide-in 0.3s ease-out',
  			'fade-in': 'fade-in 0.4s ease-out',
  			'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
  			'pulse-urgent': 'pulse-urgent 1.4s ease-in-out infinite',
  			'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
  			'score-reveal': 'score-reveal 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
