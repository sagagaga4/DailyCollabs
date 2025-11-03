import React, { useEffect, useState } from "react";
import "../Bookmarked/Bookmarked.css";

export default function Bookmarked({ token }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        // 1. Load bookmarked URLs from localStorage
        const localBookmarkedURLs = JSON.parse(localStorage.getItem("bookmarkedArticles") || "[]");

        // 2. Fetch backend bookmarks if logged in
        let backendArticles = [];
        if (token) {
          const res = await fetch("http://localhost:4000/bookmarked", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "authorization": `Bearer ${token}`,
            },
          });
          if (res.ok) backendArticles = await res.json();
        }

        // 3. Get cached articles from sessionStorage
        const cachedArticles = JSON.parse(sessionStorage.getItem("cachedArticles") || "[]");

        // 4. Merge backend + local bookmarks, map to full article objects
        const mergedArticles = [];

        // Add backend articles first
        backendArticles.forEach(article => {
          if (article.link) mergedArticles.push(article);
        });

        // Map local bookmarked URLs to cached articles
        localBookmarkedURLs.forEach(url => {
          if (!mergedArticles.some(a => a.link === url)) {
            const match = cachedArticles.find(a => a.link === url);
            if (match) mergedArticles.push(match);
            else mergedArticles.push({ link: url, title: "Untitled", description: "", pubDate: "", image: "" });
          }
        });

        setArticles(mergedArticles);
      } catch (err) {
        console.error("Error fetching bookmarks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarks();
  }, [token]);

  if (loading) return <p style={{ padding: 20, color: "#f8f8f6eb", display: "flex", justifyContent: "center" }}>Loading bookmarks...</p>;
  if (!articles.length) return <p style={{ padding: 20, color: "#f8f8f6eb", display: "flex", justifyContent: "center" }}>No bookmarks yet 📌</p>;

  return (
    <div className="Bhome-container">
      <div style={{ padding: 10, width: "100%" }}>
        <h1 style={{ marginTop: "-80px", color: "#f8f8f6eb", textAlign:'center' }}>
          My Bookmarked Articles
        </h1>
      </div>

      {articles.map((article, idx) => (
        <div key={idx} className="Bcard-content">
          <div className="Bcard">
            <div className="Bhead">{article.title || "Untitled"}</div>

            <div className="Bcontent">
              <p style={{ color: "#b2a0b6ca" }}>
                {article.pubDate ? new Date(article.pubDate).toLocaleDateString("en-GB") : ""}
              </p>

              {article.description && (
                <p style={{ color: "#ded1e1ea" }}>
                  {article.description.length > 100 ? article.description.slice(0, 100) + "..." : article.description}
                </p>
              )}

              {article.image && (
                <img
                  src={article.image}
                  alt={article.title}
                  className="Bcard-img"
                />
              )}

              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="B_button"
                style={{ justifyContent: 'center', width: '100%', height: '100px', display: "inline-block", textDecoration: 'bold' }}
              >
                <h1 style={{ textAlign: 'center', width: '100%', marginTop: '25px' }}>Read Post ✨</h1>
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
