const { test } = require('node:test');
const assert = require('node:assert');
const {
    extractDetailLinks,
    extractMaxPage,
    extractDownloadUrl
} = require('../scraper');

const LISTING_HTML = `
<html><body>
<a title="Recent Wallpapers" href="/" aria-label="Recent">Recent</a>
<a title="Mountain Landscape Wallpaper" itemprop="url" data-ripples class="wallpapers__canvas_image"
   href="https://4kwallpapers.com/nature/mountain-landscape-26973.html">
  <img itemprop="thumbnail" src="https://4kwallpapers.com/images/walls/thumbs/26973.png"
       srcset="https://4kwallpapers.com/images/walls/thumbs/26973.png 400w,https://4kwallpapers.com/images/walls/thumbs_2t/26973.png 800w">
</a>
<a title="Braided river Wallpaper" itemprop="url" data-ripples class="wallpapers__canvas_image"
   href="/nature/braided-river-26974.html">
  <img itemprop="thumbnail" src="https://4kwallpapers.com/images/walls/thumbs/26974.jpg">
</a>
<a href="?page=2">2</a>
<a href="?page=3">3</a>
<a href="?page=86">86</a>
<a href="/most-popular-4k-wallpapers/">Popular</a>
</body></html>`;

const DETAIL_HTML = `
<html><body>
<a title="Download Mountain Landscape Layers 1080x1920 wallpaper" href="/images/wallpapers/mountain-landscape-1080x1920-26973.png">Phone</a>
<a title="Download Mountain Landscape Layers 4K Wallpaper" href="/images/wallpapers/mountain-landscape-3840x2160-26973.png"
   class="current" id="resolution" target="_blank">Download in 4K (3840x2160)</a>
<a title="Download Mountain Landscape Layers Original Wallpaper" href="/images/wallpapers/mountain-landscape-4800x3600-26973.png"
   class="current" id="resolution" target="_blank">Download Original (4800x3600)</a>
<img src="https://4kwallpapers.com/images/walls/thumbs/18548.jpg">
</body></html>`;

test('extractDetailLinks collects canvas image links with slug and id', () => {
    const links = extractDetailLinks(LISTING_HTML);
    assert.strictEqual(links.length, 2);

    assert.deepStrictEqual(links[0], {
        url: 'https://4kwallpapers.com/nature/mountain-landscape-26973.html',
        slug: 'mountain-landscape',
        id: '26973',
        title: 'Mountain Landscape'
    });
    // Relative hrefs are resolved against the site root
    assert.strictEqual(links[1].url, 'https://4kwallpapers.com/nature/braided-river-26974.html');
    assert.strictEqual(links[1].id, '26974');
});

test('extractDetailLinks ignores non-wallpaper anchors', () => {
    const links = extractDetailLinks(LISTING_HTML);
    assert.ok(links.every(l => /\.html$/.test(l.url)));
});

test('extractDetailLinks returns empty array for pages without wallpapers', () => {
    assert.deepStrictEqual(extractDetailLinks('<html><body><p>nothing here</p></body></html>'), []);
});

test('extractMaxPage finds the highest page number', () => {
    assert.strictEqual(extractMaxPage(LISTING_HTML), 86);
});

test('extractMaxPage defaults to 1 when unpaginated', () => {
    assert.strictEqual(extractMaxPage(DETAIL_HTML), 1);
});

test('extractDownloadUrl prefers the 3840x2160 rendition', () => {
    const url = extractDownloadUrl(DETAIL_HTML);
    assert.strictEqual(url, 'https://4kwallpapers.com/images/wallpapers/mountain-landscape-3840x2160-26973.png');
});

test('extractDownloadUrl falls back to the widest rendition', () => {
    // No exact-4K link present: should pick the widest remaining (Original over phone)
    const html = DETAIL_HTML.replace(/3840x2160/g, '2560x1440');
    const url = extractDownloadUrl(html);
    assert.ok(/4800x3600/.test(url));
});

test('extractDownloadUrl resolves relative URLs', () => {
    const url = extractDownloadUrl(DETAIL_HTML);
    assert.ok(url.startsWith('https://4kwallpapers.com/'));
});

test('extractDownloadUrl returns null without download links', () => {
    assert.strictEqual(extractDownloadUrl(LISTING_HTML), null);
});
