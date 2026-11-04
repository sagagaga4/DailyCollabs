const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

async function getNewsUrlsFromAI(query, locale = {}) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/news-urls`, {
      query, language: locale.requested || locale.language || 'auto', region: locale.region || ''
    }, { timeout: 10000 });
    return response.data.urls || [];
  } catch (error) {
    console.error(" AI service error:", error.message);
    return [];
  }
}

module.exports = { getNewsUrlsFromAI };
