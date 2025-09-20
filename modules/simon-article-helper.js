// 專門處理：從 ielts-simon.study 取分類 → 依分類抓多頁 → 解析文章列表
import { httpHelper } from "./http-helper.js";

// httpHelper.get 可能回傳 $ 或 { $ }；統一轉成可呼叫的 $
function toDollar(res) {
  return typeof res === "function" ? res : (res && res.$ ? res.$ : res);
}
function normUrl(u) {
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://ielts-simon.study${u.startsWith("/") ? "" : "/"}${u}`;
}

// 解析分類列表頁：回傳 [{title,url,date,body}, ...]
function parseListing($) {
  const nodes = $("article, .post, .hentry, .loop-entry, .archive-post");
  const items = [];
  nodes.each((_, el) => {
    const $el = $(el);

    const $t =
      $el.find("h2.entry-title a").first().length ? $el.find("h2.entry-title a").first() :
      $el.find("h1 a").first().length ? $el.find("h1 a").first() :
      $el.find("h2 a").first().length ? $el.find("h2 a").first() :
      $el.find(".post-title a").first().length ? $el.find(".post-title a").first() :
      $el.find("a[rel='bookmark']").first();

    const title = ($t.text() || "").trim();
    const url   = normUrl($t.attr("href") || "");

    const $time =
      $el.find("time[datetime]").first().length ? $el.find("time[datetime]").first() :
      $el.find("time").first();
    const date  = ($time.attr("datetime") || $time.text() || "").trim();

    const $body =
      $el.find(".entry-content").first().length ? $el.find(".entry-content").first() :
      $el.find(".post-content").first().length ? $el.find(".post-content").first() :
      $el.find("p").first();
    const body = ($body.text() || "").replace(/\s+/g, " ").trim().slice(0, 400);

    if (title && url) items.push({ title, url, date, body });
  });
  return items;
}

export let simonHelper = {
  getPages: async function (configs) {
    // 1) 先抓首頁，只為了拿右欄 Index 的分類文字與超連結
    const homeRes = await httpHelper.get({
      startPage: 1, endPage: 1,
      hostname: "ielts-simon.study",
      path: "/", subPath: ""
    });
    const $home = toDollar(homeRes);

    // 建立「分類名稱（小寫） → href」對照
    const catMap = new Map();
    $home.find("a").each((_, a) => {
      const text = ($home(a).text() || "").trim();
      const href = $home(a).attr("href") || "";
      if (!text || !href) return;
      if (/ielts-simon\.study/.test(href) || href.startsWith("/")) {
        catMap.set(text.toLowerCase(), href);
      }
    });

    const pages = [];

    // 2) 只抓 configs.pages 指定的那 5 個分類
    for (const cfg of configs.pages) {
      const key = (cfg.categoryText || "").toLowerCase();
      const href = catMap.get(key);
      if (!href) {
        console.log(`[warn] category not found on homepage: ${cfg.categoryText}`);
        pages.push({ fileName: cfg.fileName, pageName: cfg.pageName, articles: [] });
        continue;
      }

      // 拆 href 為 hostname/path；分頁採用 /page/N/
      const u = new URL(normUrl(href));
      let path = u.pathname;
      if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

      const listRes = await httpHelper.get({
        startPage: configs.startPage,
        endPage: configs.endPage,
        hostname: u.hostname,    // ielts-simon.study
        path: path || "/",       // 例如 /reading、/listening、/writing-task-2 或 /category/xxx
        subPath: "/page/",       // 分頁樣式
      });
      const $ = toDollar(listRes);

      let articles = parseListing($);

      // 可選：關鍵字/圖片過濾（先建議留空以免抓不到）
      if (configs.filter) {
        articles = articles.filter(a =>
          a.title.includes(configs.filter) ||
          a.body.includes(configs.filter)
        );
      }

      pages.push({
        fileName: cfg.fileName,
        pageName: cfg.pageName,
        articles,
      });

      console.log(`category ${cfg.categoryText}: ${articles.length} articles`);
    }

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
