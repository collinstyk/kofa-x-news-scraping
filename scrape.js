const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

// ✅ Detect pagination type and next page link
async function detectPaginationType(page, baseUrl) {
  console.log("🔍 Checking for pagination...");

  const nextPageLink = await page.evaluate(() => {
    const nextLink =
      document.querySelector(
        'a[rel="next"], a.next, a.pagination-next, a[aria-label="Next"], a.blog-pager-older-link, a.older-posts'
      ) ||
      // fallback: manually search by text
      Array.from(document.querySelectorAll("a")).find((a) => {
        const text = a.textContent.trim().toLowerCase();
        return text.includes("older") || text.includes("next");
      });

    return nextLink ? nextLink.href : null;
  });

  if (!nextPageLink) {
    console.log("❌ No pagination detected.");
    return { type: "none", nextLink: null };
  }

  const parsedCurrent = new URL(baseUrl);
  const parsedNext = new URL(nextPageLink);

  // console.log({ nextPageLink, parsedCurrent, parsedNext });

  let type;
  if (parsedCurrent.pathname !== parsedNext.pathname) {
    type = "pathname";
  } else if (parsedCurrent.search !== parsedNext.search) {
    type = "query";
  } else {
    type = "link-based";
  }

  console.log(`✅ Pagination detected: ${type}`);

  return { type, nextLink: nextPageLink };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main scraper
const scrape = async (baseUrl) => {
  if (!baseUrl) {
    console.error("❌ Please provide a URL.\nUsage: node scraper.js <url>");
    process.exit(1);
  }

  const userDataDir = "./puppeteer_profile";

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.setViewport({ width: 1280, height: 800 });

  console.log(`🌍 Opening base URL: ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 60000 });

  const { type: paginationType } = await detectPaginationType(page, baseUrl);

  let currentUrl = baseUrl;
  let pageNum = 1;
  const scrapedData = [];

  // while (true) {
  console.log(`\n🔗 Scraping page ${pageNum}: ${currentUrl}`);

  try {
    await page.goto(currentUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
  } catch (err) {
    console.log(`⚠️ Error loading page ${pageNum}: ${err.message}`);
    // break;
  }

  const html = await page.content();
  const $ = cheerio.load(html);

  const articleLinks = [];
  $(".entry-title a, .post-title a, .title a").each((_, el) => {
    const link = $(el).attr("href");
    if (link && !link.startsWith("#")) articleLinks.push(link);
  });

  if (articleLinks.length === 0) {
    console.log("🚫 No more articles found. Stopping pagination.");
    // break;
  }

  console.log(`📰 Found ${articleLinks.length} articles.`);

  for (const link of articleLinks) {
    try {
      await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 });

      await page.waitForSelector("article, .post-content, .entry-content", {
        timeout: 20000,
      });

      const articleHTML = await page.content();
      const $$ = cheerio.load(articleHTML);

      const heading = $$("h1.title.single, .post-title, .entry-title")
        .text()
        .trim();
      const content = $$("article, .entry-content, .post-content")
        .text()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/Share this:Tweet.*/, "");
      const imageUrl = $$("img").first().attr("src");

      scrapedData.push({
        heading,
        content,
        imageUrl,
        link,
        source: baseUrl,
      });

      console.log(`✅ Scraped: ${heading.substring(0, 50)}...`);

      await delay(2000); // respect rate limits
    } catch (error) {
      console.error(`Error scraping ${link}: ${error.message}`);
    }
  }

  // Pagination navigation
  let nextPageUrl = null;

  if (paginationType === "pathname") {
    pageNum++;
    nextPageUrl = baseUrl.replace(/\/$/, "") + `/page/${pageNum}`;
  } else if (paginationType === "query") {
    pageNum++;
    const separator = baseUrl.includes("?") ? "&" : "?";
    nextPageUrl = `${baseUrl}${separator}page=${pageNum}`;
  } else {
    // “Older Posts” or direct next link
    nextPageUrl = await page.evaluate(() => {
      const nextLink = document.querySelector(
        'a[rel="next"], a.next, a.pagination-next, a.blog-pager-older-link, a.older-posts, a:contains("Older Posts")'
      );
      return nextLink ? nextLink.href : null;
    });
  }

  //   if (!nextPageUrl || pageNum > 20) {
  //     console.log("🏁 No next page or limit reached.");
  //     break;
  //   }

  //   currentUrl = nextPageUrl;
  //   await delay(1000);
  // }

  await browser.close();
  console.log(`\n🎯 Scraping complete. Total articles: ${scrapedData.length}`);
  console.log(scrapedData);
  return scrapedData;
};

module.exports = scrape;
