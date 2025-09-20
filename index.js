// 入口：只負責呼叫抓文 + 產生頁面
import { simonHelper } from "./modules/simon-article-helper.js";
import { generate } from "./modules/template-helper.js";

const configs = {
  // 建議先用小一點，確認OK再拉大
  startPage: 1,
  endPage: 5,

  // 若想用圖片或關鍵字過濾，再填；先留空以免抓不到
  filter: "",

  // 只做這 5 個分類（檔名/頁面名稱可自訂，categoryText 必須跟首頁 Index 顯示的文字相同）
  pages: [
    { fileName: "reading.html",        pageName: "Reading",            categoryText: "Reading" },
    { fileName: "listening.html",      pageName: "Listening",          categoryText: "Listening" },
    { fileName: "speaking.html",       pageName: "Speaking",           categoryText: "Speaking" },
    { fileName: "writing-task-1.html", pageName: "Writing Task 1 (Ac)",categoryText: "Writing Task 1 (Ac)" },
    { fileName: "index.html",          pageName: "Writing Task 2",     categoryText: "Writing Task 2" },
  ],
  // relatedToDate: "",
  // previousNumber: 2,
  // nextNumber: 2,
};

const pages = await simonHelper.getPages(configs);
pages.forEach((page) => generate(page, configs));

