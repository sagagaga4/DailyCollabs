import { useEffect, useState } from "react";
import "./Home.css";

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRSS = async () => {
      try {
        // 👇 Pass feed dynamically
        const response = await fetch(
          "http://localhost:4000/rss?url=https://techcrunch.com/feed/"
        );

        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        setArticles(data);
      } catch (err) {
        console.error("Failed to load RSS:", err);
        setError("Failed to load news");
      } finally {
        setLoading(false);
      }
    };

    fetchRSS();
  }, []);

  if (loading) return <p className="home-container">Loading news...</p>;
  if (error) return <p className="home-container">{error}</p>;

  return (
    <div className="home-container">
      {articles.length === 0 ? (
        <p>No news available</p>
      ) : (
        articles.map((article, idx) => (
          <div key={idx} className="card">
            {article.image && ( // 👈 Display image if available
              <img src={article.image} alt={article.title} className="card-img" />
            )}
            <div className="head">{article.title}</div>
            <div className="content">
              <p>
                <strong>Date:</strong>{" "}
                {new Date(article.pubDate).toLocaleString()}
              </p>
              <p>{article.description}</p>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="button"
              >
                Read Post
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
