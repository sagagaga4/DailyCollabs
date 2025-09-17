import { useEffect, useState } from "react";
import "./Home.css";

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRSS = async () => {
      try {
        const response = await fetch(
          "http://localhost:4000/rss?url=https://www.techradar.com/feeds.xml"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch news feed");
        }

        const data = await response.json();
        setArticles(data);
      } catch (err) {
        console.error("Error fetching RSS:", err);
        setError("Failed to load news");
      } finally {
        setLoading(false);
      }
    };

    fetchRSS();
  }, []);

  if (loading) {
    return <p className="home-container">Loading news...</p>;
  }

  if (error) {
    return <p className="home-container">{error}</p>;
  }

  return (
    
    <div className="home-container">
      {articles.length === 0 ? (
        <p>No news available</p>
      ) : (
        articles.map((article, idx) => (
          <div key={idx} className="card">
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
            <div className="head">
              {
                article.title.length < 10 
                ? article.title 
                : article.title.split(', ')[0] + '...' 
              }
            </div>
            <div className="content">
              <p style={{ color: "#b2a0b6ca" }}>
                {new Date(article.pubDate).toLocaleDateString("en-GB") || "Invalid Date"}
              </p>
              {/* <p style={{ color: "#ded1e1ea" }}>{article.description}</p> */}
              {article.image && (
                <img
                  src={article.image}
                  alt={article.title}
                  className="card-img"
                />
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}