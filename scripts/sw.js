// 构建时注入版本和资源清单。所有 URL 都相对于应用的安装目录。
const scope = self.registration.scope
const prefix = `50days:${scope}:`
const cacheName = prefix + '__VERSION__'
const assets = JSON.parse('__ASSETS__').map((path) => new URL(path, scope).href)
const assetSet = new Set(assets)
const startPage = new URL('index.html', scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) =>
    cache.addAll(assets.map((url) => new Request(url, { cache: 'reload' }))).then(() => self.skipWaiting()),
  ))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith(prefix) && key !== cacheName) || key === '50days-v1') await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName)
      return await cache.match(startPage, { ignoreVary: true }) ?? Response.error()
    }))
  } else if (assetSet.has(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName)
      // 预缓存请求和模块加载的 Origin 请求头可能不同。资源清单只包含构建生成的静态文件。
      return await cache.match(request.url, { ignoreVary: true }) ?? fetch(request)
    })())
  }
})
