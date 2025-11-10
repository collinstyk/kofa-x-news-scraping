const express = require("express");

const fs = require("fs");

const scrape = require("./scrape");

const app = express();

const port = 3000;

app.get("/scrape", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Missing ?url= parameter" });

    const scrapedData = await scrape(url);
    fs.writeFileSync("data.json", JSON.stringify(scrapedData, null, 2));

    res.json({
      status: "success",
      message: `✅ Extracted ${scrapedData.length} articles`,
      scrapedData,
    });
  } catch (error) {
    console.error("Scraping error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.listen(port, () => {
  console.log(`listening to all request on port ${port}`);
});
