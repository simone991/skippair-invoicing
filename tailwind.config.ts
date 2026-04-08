import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}','./src/components/**/*.{js,ts,jsx,tsx,mdx}','./src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { fontFamily: { sans: ['var(--font-dm-sans)','DM Sans','system-ui','sans-serif'], mono: ['var(--font-dm-mono)','DM Mono','monospace'] } } },
  plugins: [],
}
export default config
