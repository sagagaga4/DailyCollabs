import React from "react";
import { useEffect, useState } from "react";

import "../Home/Home.css";


export default function Bookmarked() {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    // Get bookmarks from localStorage
    const savedBookmarks = new Set(
      JSON.parse(localStorage.getItem("bookmarkedArticles") || "[]")
    );
    // Fetch RSS feed
    const fetchArticles = async () => {
      try {
        const response = await fetch("http://localhost:4000/rss");
        if (!response.ok) throw new Error("Failed to fetch news feed");

        const data = await response.json();
        
        // Filter only bookmarked articles
        const filtered = data.filter((_, idx) => savedBookmarks.has(idx));
        setArticles(filtered);
      } catch (err) {
        console.error("Error fetching articles:", err);
      }
    };

    fetchArticles();
  }, []);

  if (!articles.length) return <p style={{ padding: 20 }}>No bookmarks yet 📌</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{marginTop:"-80px",color:"#f8f8f6eb"}}>My Bookmarked Articles</h1>
      {articles.map((article, idx) => (
        <div key={idx} style={{marginTop:"40px"}} className="card-content">
          <div className="card">
            <div className="card-header" >
              <div className="button-wrapper">
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                >
                  Read Post ✨
                </a>
              </div>
            </div>

            <div className="head" style={{marginTop:"5px"}}>
              {article.title && article.title.length <= 30
                ? article.title
                : (article.title || "Untitled").slice(0, 40) + "..."}
            </div>

            <div className="content">
              <p style={{ color: "#b2a0b6ca" }}>
                {article.pubDate
                  ? new Date(article.pubDate).toLocaleDateString("en-GB")
                  : ""}
              </p>

              {article.description && (
                <p style={{ color: "#ded1e1ea" }}>
                  {article.description.length > 50
                    ? article.description.slice(0, 50) + "..."
                    : article.description}
                </p>
              )}

              <div className="bottom-section">
                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    className="card-img"
                    style={{height:"100%"}}
                  />
                )}
              </div>
              
            </div>

          </div>
        </div>
      ))}
    </div>
  );
}