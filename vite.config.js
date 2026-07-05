import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' にしておくと GitHub Pages のサブパス配信
// （https://chiyoko-san.github.io/kakarisan/）でもそのまま動く。
// 後で Netlify / Cloudflare Pages に移してもこのままでOK。
export default defineConfig({
  plugins: [react()],
  base: './',
})
