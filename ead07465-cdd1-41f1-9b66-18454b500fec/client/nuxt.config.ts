// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: false
  },
  modules: [
    '@pinia/nuxt'
  ],
  pinia: {
    storesDirs: ['./stores/**']
  },
  css: [
    'maplibre-gl/dist/maplibre-gl.css',
    '~/assets/css/main.css'
  ],
  app: {
    head: {
      title: '水务管网漏损监测与抢修指挥调度系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f172a' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:5000/api',
      signalRHub: 'http://localhost:5000/hubs/dispatch',
      mapStyle: 'https://demotiles.maplibre.org/style.json',
      mapCenter: [116.404, 39.915] as [number, number],
      mapZoom: 12
    }
  },
  vite: {
    server: {
      proxy: {
        '/api': 'http://localhost:5000',
        '/hubs': {
          target: 'http://localhost:5000',
          ws: true
        }
      }
    }
  }
})
