// The resolver is shared with arXiv Hop (JeffryCA/arxiv-hop, resolver.js).
// PDF.js supplies positions and link annotations instead of an HTML bibliography.
import './arxiv-hop-resolver.mjs';

const citePrefix = /^cite[.:]/i;
const { resolveReference, citationTarget, webURL } = globalThis.ArxivHopResolver;

function destinationPosition(destination) {
  if (destination[1]?.name === 'XYZ') {
    return { left: destination[2], top: destination[3] };
  }
  if (['FitH', 'FitBH'].includes(destination[1]?.name)) {
    return { left: null, top: destination[2] };
  }
  return {};
}

function locateEntry(items, destination) {
  const { left, top } = destinationPosition(destination);
  if (!Number.isFinite(top)) {
    return -1;
  }
  let best = -1;
  let distance = Infinity;
  for (const [index, item] of items.entries()) {
    const [, , , , x, y] = item.transform;
    const dy = top - y;
    if (dy < 0 || dy > item.height * 1.9 ||
        (left != null && (x < left - 4 || x > left + 55))) {
      continue;
    }
    const score = dy + (left == null ? 0 : Math.abs(x - left) / 8);
    if (score < distance - 0.2) {
      best = index;
      distance = score;
    } else if (Math.abs(score - distance) <= 0.2 && left == null &&
               best >= 0 && Math.abs(x - items[best].transform[4]) > 150) {
      // No horizontal destination and two candidates at the same height.
      return -1;
    }
  }
  return best;
}

function entryItems(items, start, next) {
  const first = items[start];
  const column = first.transform[4];
  const entry = [first];
  for (let index = start + 1; index < next && index < start + 80; index++) {
    const item = items[index];
    const previous = items[index - 1];
    const [, , , , x, y] = item.transform;
    const dy = previous.transform[5] - y;
    // Stop at a section break, a fresh numbered entry, or a jump to another column.
    if (dy < -3 || dy > first.height * 1.8 ||
        (dy > 3 && (x < column - 8 || x > column + 75 || /^\[\d+\]/.test(item.str)))) {
      break;
    }
    entry.push(item);
  }
  return entry;
}

function entryLinks(entry, annotations) {
  const links = new Set();
  for (const { url, rect } of annotations) {
    const safe = webURL(url);
    if (!url || !safe || !rect) {
      continue;
    }
    const [x1, y1, x2, y2] = rect;
    if (entry.some(({ transform: [, , , , x, y], height, width }) =>
      y + height * 0.3 >= y1 && y + height * 0.3 <= y2 && x < x2 && x + width > x1
    )) {
      links.add(safe.href);
    }
  }
  return [...links];
}

export function readReferences({ items, annotations, destinations }) {
  const textItems = items.filter((item) => item.str?.trim() && item.height > 0);
  const starts = destinations
    .map(([name, destination]) => [name, locateEntry(textItems, destination)])
    .filter(([, index]) => index >= 0)
    .sort(([, a], [, b]) => a - b);
  const references = new Map();
  for (const [index, [name, start]] of starts.entries()) {
    const previous = starts[index - 1]?.[1];
    const next = starts[index + 1]?.[1] ?? textItems.length;
    if (start === previous || start === next) {
      continue;
    }
    const entry = entryItems(textItems, start, next);
    const text = entry.map(({ str }) => str).join(' ').replace(/\s+([.,;:])/g, '$1');
    const links = entryLinks(entry, annotations);
    // A few TeX styles print a URL without adding a link annotation.
    for (const [url] of text.matchAll(/https?:\/\/[^\s<>"”]+/gi)) {
      const candidate = url.replace(/[.,;]+$/, '');
      if (webURL(candidate) && !links.some((link) => link.startsWith(candidate))) {
        links.push(candidate);
      }
    }
    const result = resolveReference({ text, links });
    if (result.kind !== 'search' || result.ambiguous) {
      references.set(name, result);
      continue;
    }
    // Match a title only when a citation has a recognizable author/title/venue
    // boundary. The host requires one exact normalized result before opening it.
    const title = text.match(/\.\s+([^.!?]{12,300})[.!?]\s+(?:In\s|arXiv\b|Proceedings\b)/i)?.[1];
    if (title) {
      references.set(name, { ...result, title });
    }
  }
  return references;
}

export function installCitationHops(app, { destination, lookupTitle, openExternal }) {
  const container = app.appConfig.viewerContainer;
  const nativeNavigate = app.pdfLinkService.goToDestination.bind(app.pdfLinkService);
  let currentDocument;
  let destinationIndex;
  const pages = new Map();
  let request = 0;

  async function getReference(pdf, name) {
    if (currentDocument !== pdf) {
      currentDocument = pdf;
      pages.clear();
      destinationIndex = pdf.getDestinations();
    }
    const destinations = await destinationIndex;
    const target = destinations.get(name);
    if (!target || !Number.isFinite(destinationPosition(target).top)) {
      return null;
    }
    const ref = target[0];
    const key = typeof ref === 'number' ? ref : `${ref.num}:${ref.gen}`;
    if (currentDocument !== pdf) {
      return null;
    }
    if (!pages.has(key)) {
      const load = async () => {
        const pageIndex = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
        const page = await pdf.getPage(pageIndex + 1);
        const [{ items }, annotations] = await Promise.all([
          page.getTextContent(), page.getAnnotations({ intent: 'display' }),
        ]);
        const entries = [...destinations].filter(([label, dest]) => {
          const pageRef = dest[0];
          return citePrefix.test(label) &&
            (pageRef === ref || (typeof ref === 'object' && pageRef?.num === ref.num && pageRef.gen === ref.gen));
        });
        return readReferences({ items, annotations, destinations: entries });
      };
      pages.set(key, load());
    }
    return (await pages.get(key)).get(name);
  }

  container.addEventListener('click', async (event) => {
    const link = event.target.closest('.linkAnnotation[data-internal-link] a');
    const hash = link?.hash;
    const pdf = app.pdfDocument;
    if (!hash || !pdf || event.defaultPrevented) {
      return;
    }
    const id = ++request;
    if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }
    // PDF.js builds named destination hashes with escape(), including %uXXXX.
    const name = unescape(hash.slice(1));
    if (!citePrefix.test(name)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    let result;
    try {
      result = await getReference(pdf, name);
      if (result?.title && result.kind === 'search' && id === request && pdf === app.pdfDocument) {
        const match = await lookupTitle(result.title);
        if (match) {
          result = resolveReference({ identifiers: [match] });
        }
      }
    } catch {
      // A missing destination, text layer, or lookup falls back to the PDF link.
    }
    if (id !== request || pdf !== app.pdfDocument) {
      return;
    }
    if (result && result.kind !== 'search') {
      openExternal(citationTarget(result, destination).url);
    } else {
      await nativeNavigate(name);
    }
  }, true);
}

export function installTitleLookup(vscode) {
  const { titleQuery, matchTitle } = globalThis.ArxivHopResolver;
  const pending = new Map();
  let nextId = 1;
  window.addEventListener('message', ({ data }) => {
    if (data?.type === 'citationLookupResult') {
      pending.get(data.requestId)?.(data.xml);
    }
  });

  return async (title) => {
    const url = titleQuery(title);
    if (!url) {
      return null;
    }
    const requestId = nextId++;
    const xml = await new Promise((resolve) => {
      const finish = (result) => {
        clearTimeout(timer);
        pending.delete(requestId);
        resolve(result);
      };
      const timer = setTimeout(finish, 7000);
      pending.set(requestId, finish);
      vscode.postMessage({ type: 'lookupCitation', requestId, url });
    });
    if (!xml) {
      return null;
    }
    const feed = new DOMParser().parseFromString(xml, 'application/xml');
    if (feed.querySelector('parsererror')) {
      return null;
    }
    const atom = 'http://www.w3.org/2005/Atom';
    const field = (node, name) => node.getElementsByTagNameNS(atom, name)[0]?.textContent;
    const entries = Array.from(feed.getElementsByTagNameNS(atom, 'entry'), (entry) => ({
      id: field(entry, 'id'), title: field(entry, 'title'),
    }));
    const count = feed.getElementsByTagNameNS('http://a9.com/-/spec/opensearch/1.1/', 'totalResults')[0]?.textContent;
    return matchTitle(title, entries, count?.trim() ? Number(count) : NaN)?.id;
  };
}
