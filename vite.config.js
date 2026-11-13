import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { DEV_BACKEND_URL } from './src/shared/api/config.js'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// Local HTTPS for testing inside Microsoft Teams (Teams only loads https:// pages) and for browser
// geolocation. Uses the .NET development certificate exported to .certs/ (git-ignored):
//   dotnet dev-certs https --trust
//   dotnet dev-certs https --export-path .certs/localhost.pem --format Pem --no-password
// When those files are absent the dev server falls back to plain http, as before.
const certKey = path.resolve(__dirname, '.certs/localhost.key')
const certPem = path.resolve(__dirname, '.certs/localhost.pem')
const localHttps = fs.existsSync(certKey) && fs.existsSync(certPem)
  ? { key: fs.readFileSync(certKey), cert: fs.readFileSync(certPem) }
  : undefined

// Where the dev server forwards the API to: DEV_BACKEND_URL in src/shared/api/config.js (the one place the URLs are set; change it there, not here).
// The app itself calls its OWN origin (relative /api and /hubs), so no VITE_API_BASE_URL / .env.local is needed, and it behaves exactly like the deployed site,
// where the API serves the built frontend from the same origin.
const API_TARGET = DEV_BACKEND_URL

// A build uses relative file paths, so the same files work at the site root or under a path such as /employee-connect/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  server: {
    port: 5173,
    https: localHttps,
    proxy: {
      '/api':  { target: API_TARGET, changeOrigin: true, secure: false },            // secure:false = accept the local dev certificate
      '/hubs': { target: API_TARGET, changeOrigin: true, secure: false, ws: true },  // SignalR notification hub (WebSocket)
    },
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .jsx, or .js files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
}))
