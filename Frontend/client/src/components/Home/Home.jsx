import { useEffect, useState } from "react";
import "./Home.css";

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedArticles, setLikedArticles] = useState(new Set());
  const [dislikedArticles, setDislikedArticles] = useState(new Set());
  const [bookmarkedArticles, setBookmarkedArticles] = useState(new Set());

  useEffect(() => {
    const fetchRSS = async () => {
      try {
        const response = await fetch("http://localhost:4000/rss");

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

    // Load saved likes, dislikes and bookmarks from localStorage
    const savedLikes = JSON.parse(localStorage.getItem('likedArticles') || '[]');
    const savedDislikes = JSON.parse(localStorage.getItem('dislikedArticles') || '[]');
    const savedBookmarks = JSON.parse(localStorage.getItem('bookmarkedArticles') || '[]');
    setLikedArticles(new Set(savedLikes));
    setDislikedArticles(new Set(savedDislikes));
    setBookmarkedArticles(new Set(savedBookmarks));
  }, []);

  const handleLike = (articleIndex) => {
    const newLikedArticles = new Set(likedArticles);
    const newDislikedArticles = new Set(dislikedArticles);
    
    // Remove from dislikes if it was disliked
    if (dislikedArticles.has(articleIndex)) {
      newDislikedArticles.delete(articleIndex);
      setDislikedArticles(newDislikedArticles);
      localStorage.setItem('dislikedArticles', JSON.stringify([...newDislikedArticles]));
    }
    
    if (likedArticles.has(articleIndex)) {
      newLikedArticles.delete(articleIndex);
    } else {
      newLikedArticles.add(articleIndex);
    }
    
    setLikedArticles(newLikedArticles);
    localStorage.setItem('likedArticles', JSON.stringify([...newLikedArticles]));
  };

  const handleDislike = (articleIndex) => {
    const newDislikedArticles = new Set(dislikedArticles);
    const newLikedArticles = new Set(likedArticles);
    
    // Remove from likes if it was liked
    if (likedArticles.has(articleIndex)) {
      newLikedArticles.delete(articleIndex);
      setLikedArticles(newLikedArticles);
      localStorage.setItem('likedArticles', JSON.stringify([...newLikedArticles]));
    }
    
    if (dislikedArticles.has(articleIndex)) {
      newDislikedArticles.delete(articleIndex);
    } else {
      newDislikedArticles.add(articleIndex);
    }
    
    setDislikedArticles(newDislikedArticles);
    localStorage.setItem('dislikedArticles', JSON.stringify([...newDislikedArticles]));
  };

  const handleBookmark = (articleIndex) => {
    const newBookmarkedArticles = new Set(bookmarkedArticles);
    
    if (bookmarkedArticles.has(articleIndex)) {
      newBookmarkedArticles.delete(articleIndex);
    } else {
      newBookmarkedArticles.add(articleIndex);
    }
    
    setBookmarkedArticles(newBookmarkedArticles);
    localStorage.setItem('bookmarkedArticles', JSON.stringify([...newBookmarkedArticles]));
  };

  if (loading) return <p className="home-container">Loading news...</p>;
  if (error) return <p className="home-container">{error}</p>;
  if (articles.length === 0) return <p className="home-container">No news available</p>;

  return (
    <div className="home-container">
      {articles.map((article, idx) => (
        <div className="card-content">
        <div key={idx} className="card">
          <div className="card-header">
            <div className="action-buttons">
              <button
                onClick={() => handleLike(idx)}
                className={`btn focus-outline inline-flex cursor-pointer select-none flex-row items-center border no-underline shadow-none transition duration-200 ease-in-out typo-callout justify-center font-bold iconOnly h-10 w-10 p-0 rounded-12 btn-tertiary-avocado ${
                  likedArticles.has(idx) ? 'liked' : ''
                }`}
                title={likedArticles.has(idx) ? 'Remove like' : 'Like'}
              >
                🔥
              </button>
              
              <button
                onClick={() => handleDislike(idx)}
                className={`btn focus-outline inline-flex cursor-pointer select-none flex-row items-center border no-underline shadow-none transition duration-200 ease-in-out typo-callout justify-center font-bold iconOnly h-10 w-10 p-0 rounded-12 btn-tertiary-avocado ${
                  dislikedArticles.has(idx) ? 'disliked' : ''
                }`}
                title={dislikedArticles.has(idx) ? 'Remove dislike' : 'Dislike'}
              >
                💩
              </button>
              
              <button
                onClick={() => handleBookmark(idx)}
                className={`btn focus-outline inline-flex cursor-pointer select-none flex-row items-center border no-underline shadow-none transition duration-200 ease-in-out typo-callout justify-center font-bold iconOnly h-10 w-10 p-0 rounded-12 btn-tertiary-avocado ${
                  bookmarkedArticles.has(idx) ? 'bookmarked' : ''
                }`}
                title={bookmarkedArticles.has(idx) ? 'Remove bookmark' : 'Bookmark'}
              >
                {bookmarkedArticles.has(idx) ? '🔖' : '📌'}
              </button>
            </div>
          </div>
          
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
            {article.title.length <= 30
              ? article.title
              : article.title.slice(0, 40) + "..."}
          </div>
          
          <div className="content">
            <p style={{ color: "#b2a0b6ca" }}>
              {new Date(article.pubDate).toLocaleDateString("en-GB")}
            </p>
            {article.description && (
              <p style={{ color: "#ded1e1ea" }}>
                {article.description.length > 50
                  ? article.description.slice(0, 50) + "..."
                  : article.description}
              </p>
            )}
            {article.image && (
              <img src={article.image} alt={article.title} className="card-img" />
            )}
          </div>
        </div>
      </div>
      ))}
    </div>
  );
}