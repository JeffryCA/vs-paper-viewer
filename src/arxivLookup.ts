const origin = 'https://export.arxiv.org';
const ttl = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; xml: string }>();
let queue = Promise.resolve();
let lastRequest = 0;

export function lookupArxivTitle(href: string): Promise<string | undefined> {
  const url = safeQuery(href);
  if (!url) {
    return Promise.resolve(undefined);
  }

  const result = queue.then(async () => {
    const saved = cache.get(url.href);
    if (saved && Date.now() - saved.at < ttl) {
      return saved.xml;
    }

    const delay = lastRequest + 3000 - Date.now();
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    lastRequest = Date.now();

    const response = await fetch(url, {
      redirect: 'error', signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return undefined;
    }
    const xml = await response.text();
    if (xml.length > 64000 || !xml.includes('</feed>')) {
      return undefined;
    }
    cache.delete(url.href);
    cache.set(url.href, { at: Date.now(), xml });
    if (cache.size > 40) {
      cache.delete(cache.keys().next().value!);
    }
    return xml;
  }).catch(() => undefined);
  queue = result.then(() => undefined);
  return result;
}

function safeQuery(href: string): URL | undefined {
  try {
    const url = new URL(href);
    const query = url.searchParams.get('search_query');
    if (url.origin !== origin || url.pathname !== '/api/query' ||
        !query || query.length > 355 || !/^ti:"[\p{L}\p{N} ]+"$/u.test(query)) {
      return undefined;
    }
    // Rebuild the request with only the arXiv title query and fixed result limits.
    const safe = new URL('/api/query', origin);
    safe.search = new URLSearchParams({
      search_query: query, start: '0', max_results: '10',
    }).toString();
    return safe;
  } catch {
    return undefined;
  }
}
