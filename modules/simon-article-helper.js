// 直接用原生 fetch + cheerio，不再依賴 httpHelper，避免 $ 不是 function 的問題
import { load as cheerioLoad } from "cheerio";

/** 小工具：保證路徑末尾有 / */
function ensureTrailingSlash(s) {
  if (!s) return "/";
  return s.endsWith("/") ? s : s + "/";
}

/** 以 Cheerio 取得 DOM（$） */
async function fetchCheerio(url) {
  const res = await fetch(url, {
    headers: {
      // 伪装浏览器，避免某些主机拒绝
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  return cheerioLoad(html); // 這裡回來的一定是「可呼叫的」$
}

/** 解析分類列表頁：回傳 [{title,url,date,body}, ...] */
function parseListing($) {
  // 加強版 selector，涵蓋常見 WP 主題
  const nodes = $("article, .post, .hentry, .loop-entry, .archive-post, .entry");
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
    let url = ($t.attr("href") || "").trim();

    // 相對連結轉絕對（若主題給的是相對路徑）
    if (url && !/^https?:\/\//i.test(url)) {
      // 嘗試從當前頁的 <base> 或 window.location
      const base = $("base[href]").attr("href") || "";
      if (base) {
        try {
          url = new URL(url, base).href;
        } catch (_) {}
      }
    }

    const $time =
      $el.find("time[datetime]").first().length ? $el.find("time[datetime]").first() :
      $el.find("time").first();
    const date = ($time.attr("datetime") || $time.text() || "").trim();

    const $body =
      $el.find(".entry-content").first().length ? $el.find(".entry-content").first() :
      $el.find(".post-content").first().length ? $el.find(".post-content").first() :
      $el.find(".content").first().length ? $el.find(".content").first() :
      $el.find("p").first();

    const body = ($body.text() || "").replace(/\s+/g, " ").trim().slice(0, 400);

    if (title && url) items.push({ title, url, date, body });
  });

  return items;
}

export let simonHelper = {
  /**
   * 依 configs.pages 的 categoryUrl 抓取多頁文章
   * configs: { startPage, endPage, pages: [{ fileName, pageName, categoryUrl }] }
   */
  getPages: async function (configs) {
    const pages = [];

    for (const cfg of configs.pages) {
      const categoryUrl = cfg.categoryUrl;
      if (!categoryUrl) {
        pages.push({ fileName: cfg.fileName, pageName: cfg.pageName, articles: [] });
        continue;
      }

      try {
        const u = new URL(categoryUrl);
        const origin = `${u.protocol}//${u.host}`;
        let basePath = ensureTrailingSlash(u.pathname);

        const collected = [];
        const seen = new Set(); // 依 URL 去重

        // 逐頁抓：第 1 頁為原路徑；第 2+ 頁為 /page/N/
        for (let p = configs.startPage; p <= configs.endPage; p++) {
          const pagePath = p === 1 ? basePath : `${ensureTrailingSlash(basePath)}page/${p}/`;
          const url = origin + pagePath;

          // 取 DOM
          const $ = await fetchCheerio(url);

          // 解析列表
          const list = parseListing($);

          // 收集（去重）
          for (const item of list) {
            if (!seen.has(item.url)) {
              seen.add(item.url);
              collected.push(item);
            }
          }

          // 若本頁已經沒有文章，提早停止（常見於到底）
          if (list.length === 0) break;
        }

        // 可選：過濾（目前先不限制，避免抓不到）
        let articles = collected;
        if (configs.filter) {
          const key = String(configs.filter).toLowerCase();
          articles = articles.filter(a =>
            (a.title || "").toLowerCase().includes(key) ||
            (a.body || "").toLowerCase().includes(key)
          );
        }

        pages.push({
          fileName: cfg.fileName,
          pageName: cfg.pageName,
          articles,
        });

        console.log(`category ${cfg.pageName}: ${articles.length} articles`);
      } catch (err) {
        console.warn(`[warn] fetch failed for ${cfg.pageName}: ${err?.message || err}`);
        pages.push({ fileName: cfg.fileName, pageName: cfg.pageName, articles: [] });
      }
    }

    console.log(`grouped into ${pages.length} pages.`);
    return pages;
  },
};




/*
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
    $home("a").each((_, el) => {
      const $a   = $home(el);
      const text = ($a.text() || "").trim();
      const href = $a.attr("href") || "";
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

