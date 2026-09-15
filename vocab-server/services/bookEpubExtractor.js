const path = require('node:path').posix;
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const { SaxesParser } = require('saxes');

function failure(errorCode, message) { const error = new Error(message); error.errorCode = errorCode; return error; }
function safeName(name) { const normalized = path.normalize(`/${name}`).slice(1); return name && normalized === name && !name.includes('\\') && !path.isAbsolute(name); }
function checkBound(signal, deadline) { if (signal?.aborted) throw failure('CANCELLED', 'Extraction cancelled'); if (Date.now() > deadline) throw failure('RESOURCE_BUSY', 'EPUB extraction timed out'); }
function parse(text, contentType, read) { const dom = new JSDOM(text, { contentType }); try { return read(dom.window.document); } finally { dom.window.close(); } }
function xml(text, read) { return parse(text, 'text/xml', read); }
function xhtmlText(source) {
  let insideBody = false; let text = ''; let topLevel;
  const parser = new SaxesParser({ xmlns: true });
  parser.on('opentag', (node) => {
    if (node.local === 'body') insideBody = true;
    else if (insideBody && !topLevel) { if (text) text += ' '; topLevel = node; }
  });
  parser.on('text', (value) => { if (insideBody) text += value; });
  parser.on('closetag', (node) => { if (node.local === 'body') insideBody = false; else if (node === topLevel) topLevel = undefined; });
  try { parser.write(source).close(); } catch (cause) { throw failure('UNSUPPORTED_FORMAT', `Invalid EPUB XHTML: ${cause.message}`); }
  return text.trim();
}
function bodyText(document) {
  const body = document.body || document.getElementsByTagNameNS('*', 'body')[0];
  return body?.textContent.trim() || '';
}
function withoutFragment(href) { return href?.split('#')[0]; }
function tocEntries(document, kind, documentPath) {
  const entries = [];
  if (kind === 'nav') {
    const walk = (list, level) => { for (const li of list?.children || []) { const anchor = [...li.children].find((child) => child.localName === 'a'); if (anchor) entries.push({ href: withoutFragment(anchor.getAttribute('href')), title: anchor.textContent.trim(), level }); const nested = [...li.children].find((child) => child.localName === 'ol'); if (nested) walk(nested, level + 1); } };
    const nav = [...document.getElementsByTagNameNS('*', 'nav')].find((node) => node.getAttribute('epub:type') === 'toc' || node.getAttribute('type') === 'toc') || document.getElementsByTagNameNS('*', 'nav')[0];
    walk(nav?.getElementsByTagNameNS('*', 'ol')[0], 1);
  } else {
    const walk = (parent, level) => { for (const point of [...parent.children].filter((child) => child.localName === 'navPoint')) { entries.push({ href: withoutFragment(point.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('src')), title: point.getElementsByTagNameNS('*', 'text')[0]?.textContent.trim(), level }); walk(point, level + 1); } };
    const map = document.getElementsByTagNameNS('*', 'navMap')[0]; if (map) walk(map, 1);
  }
  const base = path.dirname(documentPath);
  return entries.map((entry, tocOrder) => {
    const resolved = entry.href && path.normalize(path.join(base, entry.href));
    if (!resolved || resolved.startsWith('../') || path.isAbsolute(resolved)) throw failure('UNSUPPORTED_FORMAT', 'EPUB TOC href escapes package');
    return { ...entry, href: resolved, tocOrder };
  });
}

async function inspectAndExtractEpub(bytes, options = {}) {
  const limits = { maxEntries: 5000, maxEntryBytes: 20 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024, maxCompressionRatio: 100, timeoutMs: 120_000, ...options };
  const deadline = Date.now() + limits.timeoutMs; checkBound(limits.signal, deadline);
  let zip; try { zip = await JSZip.loadAsync(bytes); } catch (cause) { throw failure('UNSUPPORTED_FORMAT', `Invalid EPUB: ${cause.message}`); }
  checkBound(limits.signal, deadline);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > limits.maxEntries) throw failure('FILE_TOO_LARGE', 'EPUB entry count exceeds limit');
  let total = 0;
  for (const entry of entries) {
    if (!safeName(entry.name) || entry.unsafeOriginalName && !safeName(entry.unsafeOriginalName)) throw failure('FILE_TOO_LARGE', 'EPUB contains unsafe path');
    const size = entry._data?.uncompressedSize ?? (await entry.async('uint8array')).length; const compressed = entry._data?.compressedSize ?? size; total += size;
    if (size > limits.maxEntryBytes || total > limits.maxTotalBytes || size / Math.max(compressed, 1) > limits.maxCompressionRatio) throw failure('FILE_TOO_LARGE', 'EPUB expansion exceeds limit');
  }
  if (zip.file('META-INF/rights.xml') || zip.file('META-INF/encryption.xml')) throw failure('DRM_PROTECTED', 'DRM protected EPUB');
  const container = zip.file('META-INF/container.xml'); if (!container) throw failure('UNSUPPORTED_FORMAT', 'EPUB container missing');
  const opfPath = xml(await container.async('string'), (document) => document.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path'));
  const opf = opfPath && zip.file(opfPath); if (!opf) throw failure('UNSUPPORTED_FORMAT', 'EPUB package missing');
  const packageData = xml(await opf.async('string'), (document) => {
    const items = [...document.getElementsByTagNameNS('*', 'item')].map((item) => ({ id: item.getAttribute('id'), href: item.getAttribute('href'), properties: item.getAttribute('properties'), mediaType: item.getAttribute('media-type') }));
    const spine = document.getElementsByTagNameNS('*', 'spine')[0];
    return { items, tocId: spine?.getAttribute('toc'), spineIds: [...document.getElementsByTagNameNS('*', 'itemref')].map((item) => item.getAttribute('idref')) };
  });
  const manifest = new Map(packageData.items.map((item) => [item.id, item]));
  const base = path.dirname(opfPath);
  const navItem = packageData.items.find((item) => (item.properties || '').split(/\s+/).includes('nav'));
  const ncxItem = manifest.get(packageData.tocId) || packageData.items.find((item) => item.mediaType === 'application/x-dtbncx+xml');
  let toc = [];
  if (navItem) { const resource = zip.file(path.normalize(path.join(base, navItem.href))); if (resource) toc = parse(await resource.async('string'), 'text/html', (document) => tocEntries(document, 'nav', navItem.href)); }
  else if (ncxItem) { const resource = zip.file(path.normalize(path.join(base, ncxItem.href))); if (resource) toc = xml(await resource.async('string'), (document) => tocEntries(document, 'ncx', ncxItem.href)); }
  const tocByResource = new Map(toc.map((entry) => [entry.href, entry])); const units = [];
  for (const [index, idref] of packageData.spineIds.entries()) {
    checkBound(limits.signal, deadline);
    const item = manifest.get(idref); if (!item || item.mediaType && !['application/xhtml+xml', 'text/html'].includes(item.mediaType)) continue;
    const resource = item.href && zip.file(path.normalize(path.join(base, item.href))); if (!resource) continue;
    const source = await resource.async('string');
    const text = item.mediaType === 'application/xhtml+xml' ? xhtmlText(source) : parse(source, 'text/html', bodyText); if (!text) continue;
    const entry = tocByResource.get(path.normalize(item.href));
    units.push({ text, locator: { kind: 'sequence', unitIndex: index, resource: item.href, ...(entry && { title: entry.title, level: entry.level }) }, flags: entry ? { tocOrder: entry.tocOrder, tocSource: navItem ? 'nav' : 'ncx' } : {} });
  }
  return units;
}
module.exports = { inspectAndExtractEpub };
