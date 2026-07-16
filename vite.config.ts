import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite';

const require = createRequire(import.meta.url)

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@coral-xyz/anchor": require.resolve("@coral-xyz/anchor/dist/cjs/index.js"),
    },
  },
  plugins: [devtools(), tailwindcss(), nitro(), tanstackStart(), viteReact()]
});

export default config

