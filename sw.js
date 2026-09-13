/* AG Autos — service worker
   TROQUE A VERSÃO A CADA PUBLICAÇÃO: é isso que faz o celular baixar o app novo. */
const VERSAO = 'v1.0.0';

const CACHE = 'ag-autos-' + VERSAO;
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png',
  './apple-touch-icon.png', './favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('ag-autos-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* cache primeiro (abre offline), e atualiza por trás para a próxima abertura */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (guardado) { e.waitUntil(rede); return guardado; }
    const res = await rede;
    if (res) return res;
    if (req.mode === 'navigate') {
      const raiz = await cache.match('./index.html');
      if (raiz) return raiz;
    }
    return new Response('Sem conexão e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
