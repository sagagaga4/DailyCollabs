from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "FastAPI is working!"}

@app.post("/news-urls")
async def get_news_urls(request: Request):
    data = await request.json()
    query = data.get("query", "")

    # Make prompt clear and enforce JSON output
    prompt = f"""
    You are a helpful AI that recommends relevant, high-quality, up-to-date English news websites.
    Given the topic "{query}", output exactly a JSON array of 3 **reliable, popular, and media-rich** RSS/XML feed URLs.
    
    **Crucially, prioritize feeds known to consistently include image links in the <enclosure> or <media:content> XML tags for each item.**
    
    Do not include any explanations, only the array.
    Example: ["https://www.techradar.com/feeds.xml", "https://feedx.net/rss/ap.xml", "https://feeds.bbci.co.uk/news/rss.xml"]
    """

    # Run Ollama locally
    result = subprocess.run(
        ["ollama", "run", "llama3", prompt],
        capture_output=True,
        text=True
    )

    output = result.stdout.strip()
    print("Raw Ollama output:", output)  # Debugging line

    try:
        res = json.loads(output)
    except json.JSONDecodeError:
        # fallback: extract URLs with regex if JSON parsing fails
        res = re.findall(r'https?://[^\s"\]]+', output)

    return {"urls": res}
