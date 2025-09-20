import { httpHelper } from "./http-helper.js";

/**
 * 這版改成抓 https://ielts-simon.study 的首頁分頁 /page/N
 * 並用多組 CSS 選擇器 fallback 解析標題 / 連結 / 日期 / 摘要。
 * 另外加入對 configs.filter 的過濾（標題或內文包含該字串才保留）。
 */
export let simonHelper = {
  getPages: async function (configs) {
    // 先抓首頁分頁；若之後發現站上是 /archives/page/N，只要把 path 換成 "/archives" 即可
    const $ = await httpHelper.get({
      startPage: configs.startPage,
      endPage: configs.endPage,
      hostname: "ielts-simon.study",
      path: "",
      subPath: "/page/",
    });

    const pages = [];

    // 先把所有文章收集到四個陣列
    const articleDates = [];
    const articleHeaders = [];
    const articleUrls = [];
    const articleBodies = [];

    // 多種常見 WordPress 文章容器
    const nodes = $("article, .post, .hentry, .archive-post, .post-card, .loop-entry");
    nodes.each((i, el) => {
      const $el = $(el);

      // 標題與連結（多個 fallback）
      const aEl =
        $el.find("h2.entry-title a").first().length ? $el.find("h2.entry-title a").first() :
        $el.find("h2 a").first().length ? $el.find("h2 a").first() :
        $el.find(".post-title a").first().length ? $el.find(".post-title a").first() :
        $el.find("a").first();

      const title = (aEl.text() || "").trim();
      let url = (aEl.attr("href") || "").trim();
      if (url && !/^https?:\/\//i.test(url)) url = `https://ielts-simon.study${url}`;

      // 日期（可能沒有）
      const timeEl =
        $el.find("time[datetime]").first().length ? $el.find("time[datetime]").first() :
        $el.find("time").first();
      const date = (timeEl.text() || "").trim();

      // 內文 / 摘要
      const bodyEl =
        $el.find(".entry-content").first().length ? $el.find(".entry-content").first() :
        $el.find(".post-content").first().length ? $el.find(".post-content").first() :
        $el.find(".entry-summary").first().length ? $el.find(".entry-summary").first() :
        $el.find("p").first();
      const body = (bodyEl.text() || "").trim();

      // 基本欄位不齊就跳過
      if (!title || !url) return;

      // 若有設定 filter，只保留標題或內文包含 filter 的文章
      if (configs.filter) {
        const hit = title.includes(configs.filter) || body.includes(configs.filter);
        if (!hit) return;
      }

      articleHeaders.push(title);
      articleUrls.push(url);
      articleDates.push(date);
      articleBodies.push(body);
    });

    console.log(`found ${articleHeaders.length} articles.`);

    // 依 index.js 的 pages 設定把文章分組
    configs.pages.forEach((cfg) => {
      const page = { fileName: cfg.fileName, pageName: cfg.pageName, articles: [] };

      for (let i = 0; i < articleHeaders.length; i++) {
        const combined = `${articleHeaders[i]} ${articleBodies[i]}`;
        const matched = cfg.searchText.some((kw) => combined.includes(kw));
        if (matched) {
          page.articles.push({
            date: articleDates[i],
            title: articleHeaders[i],
            url: articleUrls[i],
            body: articleBodies[i],
          });
        }
      }

      pages.push(page);
    });

    console.log(`grouped into ${pages.length} pages.`);
    return pages;
  },
};



/**
import { httpHelper } from "./http-helper.js";

export let simonHelper = {
  getPages: async function (configs) {
    const $ = await httpHelper.get({
      startPage: configs.startPage,
      endPage: configs.endPage,
      hostname: "www.ielts-simon.com",
      path: "/ielts-help-and-english-pr",
      subPath: "/page/",
    });

    const pages = [];
    const articleDates = [];
    const articleHeaders = [];
    const articleUrls = [];
    const articleBodies = [];

    let articleCount = 0;

    $.forEach((page) => {
      let headers = page("*").find(".entry-header > a");
      articleCount += headers.length;

      headers.each(function (index, header) {
        articleHeaders.push(page(header).html());
        articleUrls.push(page(header).attr("href"));
      });

      let dates = page("body").find(".date-header");

      dates.each(function (index, date) {
        articleDates.push(page(date).html());
      });

      let bodies = page("*").find(".entry-body");

      bodies.each(function (index, body) {
        articleBodies.push(page(body).html());
      });
    });

    console.log(`found ${articleCount} articles.`);

    configs.pages.forEach((pageConfig) => {
      let page = {
        fileName: pageConfig.fileName,
        pageName: pageConfig.pageName,
        articles: [],
      };

      for (let index = 0; index < articleCount; index++) {
        if (
          pageConfig.searchText.length > 0 &&
          pageConfig.searchText.every(
            (text) => !articleHeaders[index].includes(text)
          )
        )
          continue;

        page.articles.push({
          date: articleDates[index],
          title: articleHeaders[index],
          url: articleUrls[index],
          body: articleBodies[index],
        });
      }

      pages.push(page);
    });

    console.log(`grouped into ${pages.length} pages.`);

    return pages;
  },
};
*/
