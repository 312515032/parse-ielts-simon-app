// modules/simon-article-helper.js
import { httpHelper } from "./http-helper.js";

function pickFirst($el, selectors) {
  for (const sel of selectors) {
    const node = $el.find(sel).first();
    if (node && (node.text()?.trim() || node.attr("href") || node.attr("datetime"))) {
      return node;
    }
  }
  return null;
}

async function fetchWithSite(site, startPage, endPage) {
  // site: { hostname, path, subPath }
  return await httpHelper.get({
    startPage,
    endPage,
    hostname: site.hostname,
    path: site.path,
    subPath: site.subPath,
  });
}

export let simonHelper = {
  getPages: async function (configs) {
    // 1) 先試新版站
    const sites = [
      // 新站（多數 WP 站的分頁是 /page/2/ 這種）
      { hostname: "ielts-simon.study", path: "/", subPath: "page/" },
      // 新站的歸檔頁（如果首頁不列全文，可嘗試 archives）
      { hostname: "ielts-simon.study", path: "/archives/", subPath: "page/" },
      // 舊站做為後備
      { hostname: "www.ielts-simon.com", path: "/ielts-help-and-english-pr", subPath: "page/" },
    ];

    let $ = null;
    for (const site of sites) {
      try {
        $ = await fetchWithSite(site, configs.startPage, configs.endPage);
        // 粗略檢查一下頁面是否真的有文章區塊
        if ($("article").length || $(".post").length || $(".entry-title").length) {
          console.log(`Using site: https://${site.hostname}${site.path}`);
          break;
        }
      } catch (e) {
        // 換下一個 site
      }
    }
    if (!$) {
      console.log("Unable to load any site.");
      return [];
    }

    const pages = [];
    const articles = [];

    // 2) 用較泛用的 selector 嘗試抓文章
    // 先找每一篇文章節點
    const articleNodes = $("article").length ? $("article")
                      : $(".post").length ? $(".post")
                      : $(".hentry").length ? $(".hentry")
                      : $(".entry").length ? $(".entry")
                      : $(".content .post, .content article");

    articleNodes.each(function () {
      const $a = $(this);

      const titleNode = pickFirst($a, ["h1 a", "h2 a", "h3 a", ".entry-title a", ".post-title a", "a[rel='bookmark']"]);
      const url = titleNode?.attr("href") || "";
      const title = (titleNode?.text() || "").trim();

      const dateNode = pickFirst($a, ["time[datetime]", "time", ".entry-date", ".post-date"]);
      const date = (dateNode?.attr("datetime") || dateNode?.text() || "").trim();

      // 取內文節錄
      const bodyNode = pickFirst($a, [".entry-content", ".post-content", ".entry", ".content", ".post"]);
      const bodyRaw = (bodyNode?.text() || "").replace(/\s+/g, " ").trim();
      const body = bodyRaw.slice(0, 400);

      // 根據你的 filter（例如需要含有特定圖片檔名才收錄）
      if (configs.filter) {
        const hasImg = $a.find(`img[src*="${configs.filter}"]`).length > 0;
        if (!hasImg) return; // 不符合就跳過
      }

      if (title && url) {
        articles.push({ title, url, date, body });
      }
    });

    console.log(`found ${articles.length} articles.`);

    // 3) 依照你原本的設定，把文章分配到頁面（Writing/Reading/Listening/...）
    configs.pages.forEach((pageCfg) => {
      const page = {
        fileName: pageCfg.fileName,
        pageName: pageCfg.pageName,
        articles: [],
      };

      // 用關鍵字或頁面名稱過濾文章（保守做法：標題或摘要含關鍵詞）
      const keys = (pageCfg.searchText || []).map((s) => s.toLowerCase());
      articles.forEach((a) => {
        const hay = (a.title + " " + a.body).toLowerCase();
        if (keys.length === 0 || keys.some((k) => hay.includes(k))) {
          page.articles.push(a);
        }
      });

      pages.push(page);
    });

    console.log(`grouped into ${pages.length} pages.`);
    return pages;
  },
};
