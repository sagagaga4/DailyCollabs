import React from "react";
import { useEffect, useState } from "react";

import "../Home/Home.css";


export default function Bookmarked({token}) {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const fetchBookmarked = async () => {
      try {
        const res = await fetch("http://localhost:4000/bookmarked", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load bookmarks");
        const data = await res.json();
        setArticles(data);
      } catch (err) {
        console.error("Error fetching bookmarks:", err);
      }
    };

    fetchBookmarked();
  }, [token]);

  if (!articles.length) return <p style={{ padding: 20, color: "#f8f8f6eb", display:"flex",justifyContent:"center" }}>No bookmarks yet 📌</p>;

return (
  <div className="home-container">
    <div style={{ padding: 10, width: "100%" }}>
      <h1 style={{ marginTop: "-80px", color: "#f8f8f6eb", textAlign:'center' }}>
        My Bookmarked Articles
      </h1>
    </div>

    {articles.map((article, idx) => (
      <div key={idx} className="card-content" >
        <div className="card">
          <div className="card-header">
            <div className="button-wrapper">
            </div>
          </div>

          <div className="head">
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

            <div className="bottom-section" style={{zIndex:1}}>
              {article.image && (
                <img
                  src={article.image}
                  alt={article.title}
                  className="card-img"
                />
              )}
            </div>
                <a
                
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="button"
                style={{justifyContent:'center', width:'auto', height:'100px',   display: "inline-block",textDecoration:'bold'}}
              >
               <h1 style={{textAlign:'center',width:'100%',marginTop:'25px'}}>Read Post ✨</h1> 
              </a>
          </div>
        </div>
      </div>
    ))}
  </div>
);

}