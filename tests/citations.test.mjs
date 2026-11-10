import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installCitationHops, readReferences } from '../lib/citations.mjs';

const line = (str, x, y, width = 150) => ({
  str, width, height: 10, transform: [10, 0, 0, 10, x, y],
});
const destination = (name, x, y) => [name, [0, { name: 'XYZ' }, x, y]];

test('extracts a wrapped arXiv citation without borrowing its neighbor’s DOI', () => {
  const refs = readReferences({
    items: [
      line('A. Author. First entry.', 50, 689),
      line('arXiv preprint arXiv:2411.12633v2, 2025.', 60, 678),
      line('B. Author. Second entry. doi: 10.1234/other.', 50, 661),
    ],
    annotations: [],
    destinations: [destination('cite.b', 50, 672), destination('cite.a', 50, 700)],
  });
  assert.equal(refs.get('cite.a').id, '2411.12633v2');
  assert.equal(refs.get('cite.b').url, 'https://doi.org/10.1234/other');
});

test('keeps links in two columns separate and ignores the previous entry', () => {
  const refs = readReferences({
    items: [
      line('First entry in the left column.', 40, 680),
      line('Continued', 50, 669),
      line('Second entry in the right column.', 310, 680),
      line('Continued', 320, 669),
    ],
    annotations: [
      { url: 'https://example.com/left', rect: [60, 666, 100, 676] },
      { url: 'https://arxiv.org/abs/2501.12345', rect: [330, 666, 380, 676] },
      { url: 'https://example.com/above', rect: [320, 690, 390, 700] },
    ],
    destinations: [destination('cite.a', 40, 691), destination('cite.b', 310, 691)],
  });
  assert.equal(refs.get('cite.a').url, 'https://example.com/left');
  assert.equal(refs.get('cite.b').id, '2501.12345');
});

test('leaves unresolved or ambiguous links available for bibliography navigation', () => {
  const refs = readReferences({
    items: [
      line('A. Author. arXiv:2411.12633 and arXiv:2501.12345.', 40, 680),
      line('B. Author. A reference with no explicit identifier.', 40, 660),
    ],
    annotations: [],
    destinations: [destination('cite.a', 40, 691), destination('cite.b', 40, 671)],
  });
  assert.equal(refs.get('cite.a').ambiguous, true);
  assert.equal(refs.has('cite.b'), false);
});

test('supports a FitH bibliography destination and rejects an unknown destination', () => {
  const refs = readReferences({
    items: [line('Example entry. arXiv:2411.12633.', 40, 680)],
    annotations: [],
    destinations: [
      ['cite.a', [0, { name: 'FitH' }, 690]],
      ['cite.b', [0, { name: 'Fit' }]],
    ],
  });
  assert.equal(refs.get('cite.a').id, '2411.12633');
  assert.equal(refs.has('cite.b'), false);
});

test('linked citations open externally, with native navigation as the fallback', async () => {
  const bibliography = {
    getTextContent: async () => ({
      items: [
        line('A. Author. First entry. arXiv:2411.12633.', 40, 680),
        line('B. Author. Unresolved entry.', 40, 660),
      ],
    }),
    getAnnotations: async () => [],
  };
  let click;
  const jumps = [];
  const opened = [];
  const app = {
    appConfig: { viewerContainer: { addEventListener: (type, listener) => { click = listener; } } },
    pdfLinkService: { goToDestination: (name) => jumps.push(name) },
    pdfDocument: {
      getDestinations: async () => new Map([destination('cite.a', 40, 691), destination('cite.b', 40, 671)]),
      getPage: async () => bibliography,
    },
  };
  installCitationHops(app, {
    destination: 'abstract',
    lookupTitle: async () => null,
    openExternal: (url) => opened.push(url),
  });
  async function follow(name, altKey = false) {
    let intercepted = false;
    await click({
      target: { closest: () => ({ hash: '#' + name }) },
      altKey,
      preventDefault: () => { intercepted = true; },
      stopImmediatePropagation: () => {},
    });
    return intercepted;
  }
  assert.equal(await follow('cite.a'), true);
  assert.equal(await follow('cite.a', true), false);
  assert.equal(await follow('figure.1'), false);
  assert.equal(await follow('cite.b'), true);
  assert.deepEqual(opened, ['https://arxiv.org/abs/2411.12633']);
  assert.deepEqual(jumps, ['cite.b']);
});
