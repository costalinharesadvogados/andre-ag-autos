/* AG Autos — service worker
   TROQUE A VERSÃO A CADA PUBLICAÇÃO: é isso que faz o celular baixar o app novo.
   O app não pede confirmação: assim que a versão nova é instalada, ela assume
   e a página recarrega sozinha uma vez. */
const VERSAO = 'v1.1.0';

const CACHE = 'ag-autos-' + VERSAO;
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './icon-192-maskable.png', './icon-512-maskable.png',
  './apple-touch-icon.png', './favicon-32.png'
];

/* instala buscando tudo da REDE (cache:'reload'), senão o navegador
   devolveria a cópia velha e gravaria ela dentro do cache novo */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('ag-autos-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data.type === 'VERSAO' && e.ports && e.ports[0]) e.ports[0].postMessage({ versao: VERSAO });
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* a página em si vem pela REDE primeiro — é o que garante ver o app novo.
     O cache entra só quando não há conexão. */
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const copia = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(req, copia)));
        }
        return res;
      } catch (err) {
        const cache = await caches.open(CACHE);
        return (await cache.match(req, { ignoreSearch: true }))
            || (await cache.match('./index.html'))
            || new Response('Sem conexão e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  /* ícones e demais arquivos: cache primeiro, atualizando por trás */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (guardado) { e.waitUntil(rede); return guardado; }
    return (await rede) || new Response('', { status: 504 });
  })());
});
