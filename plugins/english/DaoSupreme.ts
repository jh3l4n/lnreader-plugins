import { load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { Filters } from '@libs/filterInputs';

class DaoSupreme implements Plugin.PluginBase {
  id = 'daosupreme';
  name = 'DaoSupreme';
  icon = 'src/en/divinedaolibrary/icon.png';
  site = 'https://daosupreme.com/';
  version = '1.0.7';
  filters: Filters | undefined = undefined;

  private toFullUrl(pathOrUrl: string): string {
    if (!pathOrUrl) return this.site;
    if (pathOrUrl.startsWith('http')) return pathOrUrl;
    return `${this.site}${pathOrUrl.replace(/^\//, '')}`;
  }

  async popularNovels(pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = pageNo === 1 ? this.site : `${this.site}page/${pageNo}/`;
    const result = await fetchApi(url);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    loadedCheerio('article').each((i, el) => {
      const linkEl = loadedCheerio(el).find('h2 a, h1 a, h3 a, .entry-title a').first();
      const name = linkEl.text().trim();
      const novelUrl = linkEl.attr('href');
      const imgEl = loadedCheerio(el).find('img').first();
      const cover = imgEl.attr('data-src') || imgEl.attr('src') || '';

      if (name && novelUrl) {
        novels.push({
          name,
          url: novelUrl,
          cover,
        });
      }
    });

    return novels;
  }

  async parseNovel(novelUrl: string): Promise<Plugin.SourceNovel> {
    const fullUrl = this.toFullUrl(novelUrl).replace(/\?.*$/, '');
    const result = await fetchApi(fullUrl);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const title =
      loadedCheerio('h1').first().text().trim() ||
      'DaoSupreme Novel';

    const coverEl = loadedCheerio('article img, .entry-content img, main img').first();
    const cover = coverEl.attr('data-src') || coverEl.attr('src') || '';

    const summary = loadedCheerio('.entry-content p, article p')
      .filter((i, el) => !loadedCheerio(el).text().includes('Page 1 of'))
      .slice(0, 3)
      .map((i, el) => loadedCheerio(el).text().trim())
      .get()
      .join('\n\n');

    const novel: Plugin.SourceNovel = {
      url: novelUrl,
      name: title,
      cover,
      summary,
      chapters: [],
    };

    const pageText = loadedCheerio('body').text();
    const pageMatch = pageText.match(/Page\s+\d+\s+of\s+(\d+)/i);
    const totalPages = pageMatch
      ? parseInt(pageMatch.join(',').replace(/^.*?,/, ''), 10) || 1
      : 1;

    const chapters: Plugin.ChapterItem[] = [];
    const seenUrls = new Set<string>();

    const extractChaptersFromPage = ($: ReturnType<typeof parseHTML>) => {
      $('.entry-content a, article a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        if (
          href &&
          !href.includes('?cp=') &&
          !href.includes('#') &&
          text &&
          /chapter/i.test(text) &&
          !seenUrls.has(href)
        ) {
          seenUrls.add(href);
          chapters.push({
            name: text,
            url: this.toFullUrl(href),
            releaseTime: '',
          });
        }
      });
    };

    extractChaptersFromPage(loadedCheerio);

    for (let p = 2; p <= totalPages; p++) {
      try {
        const pageRes = await fetchApi(`${fullUrl}?cp=${p}`);
        const pageHtml = await pageRes.text();
        extractChaptersFromPage(parseHTML(pageHtml));
      } catch (e) {
        // Skip failed page
      }
    }

    novel.chapters = chapters.reverse();
    return novel;
  }

  async parseChapter(chapterUrl: string): Promise<string> {
    const fullUrl = this.toFullUrl(chapterUrl);
    const result = await fetchApi(fullUrl);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const content = loadedCheerio('.entry-content, article .post-content, main article').first();
    content.find('script, style, ins, .sharedaddy, .code-block, nav, .page-links, .wp-block-buttons').remove();

    return content.html() || '<p>No text found. Try opening in WebView.</p>';
  }

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}page/${pageNo}/?s=${encodeURIComponent(searchTerm)}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    loadedCheerio('article').each((i, el) => {
      const linkEl = loadedCheerio(el).find('h2 a, h1 a, h3 a, .entry-title a').first();
      const name = linkEl.text().trim();
      const novelUrl = linkEl.attr('href');
      const imgEl = loadedCheerio(el).find('img').first();
      const cover = imgEl.attr('data-src') || imgEl.attr('src') || '';

      if (name && novelUrl) {
        novels.push({
          name,
          url: novelUrl,
          cover,
        });
      }
    });

    return novels;
  }
}

export default new DaoSupreme();
