import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { optionPricesApiMiddleware } from './server/apiMiddleware'

const optionPricesApiPlugin = (): Plugin => ({
  name: 'option-prices-api',
  configureServer: (server) => {
    server.middlewares.use(optionPricesApiMiddleware)
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(optionPricesApiMiddleware)
  },
})

export default defineConfig({
  plugins: [react(), optionPricesApiPlugin()],
})
