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
    const sites = [
      { hostname: "ielts-simon.study", path: "/",         subPath: "page/" },
      { hostname: "ielts-simon.study", path: "/archives/", subPath: "page/" },
      { hostname: "www.ielts-simon.com", path: "/ielts-help-and-english-pr", subPath: "page/" },
    ];

    let $ = null;
    for (const site of sites) {
      try {
        $ = await fetchWithSite(site, configs.startPage, configs.endPage);
        if ($("article").length || $(".post").length || $(".entry-title").length) {
          console.log(`Using site: https://${site.hostname}${site.path}`);
          break;
        }
      } catch (e) {
        // ignore and try next
      }
    }
    if (!$) {
      console.log("Unable to load any site.");
      return [];
    }

    const pages = [];
    const articles = [];

    const articleNodes =
      $("article").length ? $("article") :
      $(".post").length ? $(".post") :
      $(".hentry").length ? $(".hentry") :
      $(".entry").length ? $(".entry") :
      $(".content .post, .content article");

    articleNodes.each(function () {
      const $a = $(this);

      const titleNode = pickFirst($a, [
        "h1 a","h2 a","h3 a",".entry-title a",".post-title a","a[rel='bookmark']",
      ]);
      const url = titleNode?.attr("href") || "";
      const title = (titleNode?.text() || "").trim();

      const dateNode = pickFirst($a, ["time[datetime]","time",".entry-date",".post-date"]);
      const date = (dateNode?.attr("datetime") || dateNode?.text() || "").trim();

      const bodyNode = pickFirst($a, [".entry-content",".post-content",".entry",".content",".post"]);
      const bodyRaw = (bodyNode?.text() || "").replace(/\s+/g, " ").trim();
      const body = bodyRaw.slice(0, 400);

      // 若有設定 filter：圖片 src/標題/內文命中才保留
      if (configs.filter) {
        const hasImg = $a.find(`img[src*="${configs.filter}"]`).length > 0;
        const hitTxt = title.includes(configs.filter) || body.includes(configs.filter);
        if (!hasImg && !hitTxt) return;
      }

      if (title && url) {
        const fixedUrl = /^https?:\/\//i.test(url) ? url : `https://ielts-simon.study${url}`;
        articles.push({ title, url: fixedUrl, date, body });
      }
    });

    console.log(`found ${articles.length} articles.`);

    // 依你的 pages 配置分組
    configs.pages.forEach((pageCfg) => {
      const page = { fileName: pageCfg.fileName, pageName: pageCfg.pageName, articles: [] };
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
