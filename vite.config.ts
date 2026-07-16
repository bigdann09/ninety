import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  // Allows the Telegram bot's ngrok tunnel (URL rotates on every restart) to reach
  // this dev server for local testing.
  server: { allowedHosts: [".ngrok-free.app"] },
});

export default config

