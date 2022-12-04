const puppeteer = require("puppeteer");
const config = require("../../config");

async function search(search, site = config.O337X_SITE) {
  try {
    var browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"]
    });
    var page = await browser.newPage();
    await page.goto(site.replace("{term}", search));

    var searchResults = await page.evaluate(async () => {
      var searchResults = document.querySelector("tbody");
      if (!searchResults) {
        return { error: true, errorMessage: "No results found" };
      }
      var tableRows = searchResults.querySelectorAll("tr");
      var results = [];

      tableRows.forEach(item => {
        var details =
          "Uploaded: " +
          item.querySelectorAll("td")[3].innerText +
          ", Size: " +
          item.querySelectorAll("td")[4].innerText +
          ", By: " +
          item.querySelectorAll("td")[5].innerText;
        results.push({
          name: item.querySelectorAll("td")[0].querySelector("a:last-of-type").innerText,
          link: item.querySelectorAll("td")[0].querySelector("a:last-of-type").href,
          seeds: item.querySelectorAll("td")[1].innerText,
          details
        });
      });

      return {
        error: false,
        results,
        errorMessage: ""
      };
    });

    await page.close();
    await browser.close();

    return searchResults;
  } catch (err) {
    console.log(err);
    return { error: true, errorMessage: "Runtime error occured" };
  }
}

module.exports = search;
