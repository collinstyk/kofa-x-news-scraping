const fs = require("fs");

const scrape = require("./scrape");

async function extractAndSaveData() {
  const scrapedData = await scrape();

  fs.writeFileSync("data.json", JSON.stringify(scrapedData, null, 2));
  console.log(`✅ Saved ${scrapedData.length} articles to data.json`);
}

extractAndSaveData();
