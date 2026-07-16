import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite';

const externalAnchor = ["@coral-xyz/anchor"]

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  ssr: { external: externalAnchor },
  plugins: [
    devtools(),
    tailwindcss(),
    nitro({
      preset: process.env.VERCEL ? "vercel" : undefined,
      rolldownConfig: { external: externalAnchor },
    }),
    tanstackStart(),
    viteReact(),
  ]
});

export default config

