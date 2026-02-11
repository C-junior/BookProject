import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
<<<<<<< HEAD
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.png', 'codex_logo.png'],
            manifest: {
                name: 'Codex',
                short_name: 'Codex',
                description: 'The friendliest e-book reader',
                theme_color: '#1a1a2e',
                background_color: '#1a1a2e',
                display: 'standalone',
                orientation: 'portrait-primary',
                scope: '/',
                start_url: '/',
                categories: ['books', 'education'],
                icons: [
                    {
                        src: 'favicon.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'codex_logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    }
                ],
                share_target: {
                    action: '/share-target',
                    method: 'POST',
                    enctype: 'multipart/form-data',
                    params: {
                        title: 'title',
                        text: 'text',
                        url: 'url',
                        files: [
                            {
                                name: 'file',
                                accept: ['application/epub+zip', '.epub', 'application/pdf', '.pdf']
                            }
                        ]
                    }
                } as any
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mjs}'],
                cleanupOutdatedCaches: true,

                // SPA navigation fallback — loads app shell offline for any route
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//, /\.\w+$/],

                runtimeCaching: [
                    // Google Fonts stylesheets
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    // Google Fonts font files
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    // Supabase storage — cache downloaded book files for offline reading
                    {
                        urlPattern: /supabase.*\/storage\/v1\/object\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'supabase-book-files',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    // Supabase cover images
                    {
                        urlPattern: /supabase.*\.(jpg|jpeg|png|webp|gif)/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'supabase-images',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    optimizeDeps: {
        exclude: ['pdfjs-dist']
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                    'vendor-dexie': ['dexie'],
                    'epub': ['epubjs']
                }
            }
        }
    },
    server: {
        // Headers removed to allow browser defaults and avoid conflicts with tracking prevention
    }
})
=======
  plugins: [
    createHtmlPlugin(),
    visualizer(),
    VitePWA({
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ]
});
>>>>>>> b97ef68380ca972ae25f66dd185f2da6d055f8a9
