import { CheerioAPI, load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@typings/plugin';
import { Filters } from '@libs/filterInputs';

class DaoSupreme implements Plugin.PluginBase {
  id = 'daosupreme';
  name = 'DaoSupreme';
  icon = 'src/en/daosupreme/icon.png';
  site = 'https://daosupreme.com/';
  version = '1.0.0';
  filters: Filters | undefined = undefined;

  async popularNovels(pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}page/${pageNo}/`;
    const result = await fetchApi(url);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    loadedCheerio('article').each((i, el) => {
      const linkEl = loadedCheerio(el).find('h2.entry-title a, h1.entry-title a, .entry-header a').first();
      const name = linkEl.text().trim();
      const novelUrl = linkEl.attr('href');
      const cover = loadedCheerio(el).find('img').first().attr('src') || '';

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
    const result = await fetchApi(novelUrl);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      url: novelUrl,
      name: loadedCheerio('h1.entry-title').first().text().trim() || 'Untitled',
      cover: loadedCheerio('article img, .post-thumbnail img').first().attr('src') || '',
      summary: loadedCheerio('.entry-content p').first().text().trim(),
      chapters: [],
    };

    const chapters: Plugin.ChapterItem[] = [];
    const pageLinks = new Set<string>();
    pageLinks.add(novelUrl);

    loadedCheerio('a[href*="?cp="]').each((i, el) => {
      const href = loadedCheerio(el).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `${this.site}${href.replace(/^\//, '')}`;
        pageLinks.add(fullUrl);
      }
    });

    let index = 1;
    for (const link of Array.from(pageLinks)) {
      const cpMatch = link.match(/\?cp=(\d+)/);
      const chapterNum = cpMatch ? parseInt(cpMatch[1], 10) : index;
      chapters.push({
        name: `Chapter / Part ${chapterNum}`,
        url: link,
        releaseTime: '',
        chapterNumber: chapterNum,
      });
      index++;
    }

    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    novel.chapters = chapters;

    return novel;
  }

  async parseChapter(chapterUrl: string): Promise<string> {
    const result = await fetchApi(chapterUrl);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    loadedCheerio('.entry-content script, .entry-content style, .entry-content .sharedaddy').remove();
    const chapterText = loadedCheerio('.entry-content').html() || '';

    return chapterText;
  }

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}page/${pageNo}/?s=${encodeURIComponent(searchTerm)}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const loadedCheerio = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    loadedCheerio('article').each((i, el) => {
      const linkEl = loadedCheerio(el).find('h2.entry-title a, .entry-header a').first();
      const name = linkEl.text().trim();
      const novelUrl = linkEl.attr('href');
      const cover = loadedCheerio(el).find('img').first().attr('src') || '';

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
