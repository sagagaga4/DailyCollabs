from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/news-urls")
async def get_news_urls(request: Request):
    data = await request.json()
    query = data.get("query", "")

    prompt = f"""
    You are a helpful AI that recommends relevant, up-to-date English news websites.
    Given the topic "{query}", list 3 news website URLs that frequently cover this topic.
    Return ONLY a JSON array of URLs, e.g. ["https://example1.com", "https://example2.com"].
    """

    # Run Ollama locally via subprocess
    result = subprocess.run(
        ["ollama", "run", "llama3", prompt],
        capture_output=True,
        text=True
    )

    # Ollama outputs plain text — try to parse JSON
    output = result.stdout.strip()
    try:
        urls = json.loads(output)
    except json.JSONDecodeError:
        urls = []

    return {"urls": urls}
