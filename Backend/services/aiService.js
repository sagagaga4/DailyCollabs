const axios = require("axios");

async function getNewsUrlsFromAI(query) {
  try {
    const response = await axios.post("http://127.0.0.1:5000/news-urls", {
      query: query
    });
    return response.data.urls || [];
  } catch (error) {
    console.error("❌ AI service error:", error.message);
    return [];
  }
}

module.exports = { getNewsUrlsFromAI };
