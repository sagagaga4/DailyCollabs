import { useEffect, useState } from "react";

import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import LinkIcon from '@mui/icons-material/Link';

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

    // Load saved likes, dislikes, and bookmarks from localStorage
    const savedLikes = JSON.parse(localStorage.getItem("likedArticles") || "[]");
    const savedDislikes = JSON.parse(
      localStorage.getItem("dislikedArticles") || "[]"
    );
    const savedBookmarks = JSON.parse(
      localStorage.getItem("bookmarkedArticles") || "[]"
    );
  
    setLikedArticles(new Set(savedLikes));
    setDislikedArticles(new Set(savedDislikes));
    setBookmarkedArticles(new Set(savedBookmarks));
  }, []);

  const handleLike = (articleIndex) => {
    const newLikedArticles = new Set(likedArticles);
    const newDislikedArticles = new Set(dislikedArticles);

    if (dislikedArticles.has(articleIndex)) {
      newDislikedArticles.delete(articleIndex);
      setDislikedArticles(newDislikedArticles);
      localStorage.setItem(
        "dislikedArticles",
        JSON.stringify([...newDislikedArticles])
      );
    }

    if (likedArticles.has(articleIndex)) {
      newLikedArticles.delete(articleIndex);
    } else {
      newLikedArticles.add(articleIndex);
    }

    setLikedArticles(newLikedArticles);
    localStorage.setItem("likedArticles", JSON.stringify([...newLikedArticles]));
  };

  const handleDislike = (articleIndex) => {
    const newDislikedArticles = new Set(dislikedArticles);
    const newLikedArticles = new Set(likedArticles);

    if (likedArticles.has(articleIndex)) {
      newLikedArticles.delete(articleIndex);
      setLikedArticles(newLikedArticles);
      localStorage.setItem("likedArticles", JSON.stringify([...newLikedArticles]));
    }

    if (dislikedArticles.has(articleIndex)) {
      newDislikedArticles.delete(articleIndex);
    } else {
      newDislikedArticles.add(articleIndex);
    }

    setDislikedArticles(newDislikedArticles);
    localStorage.setItem(
      "dislikedArticles",
      JSON.stringify([...newDislikedArticles])
    );
  };

  const handleBookmark = (articleIndex) => {
    const newBookmarkedArticles = new Set(bookmarkedArticles);

    if (bookmarkedArticles.has(articleIndex)) {
      newBookmarkedArticles.delete(articleIndex);
    } else {
      newBookmarkedArticles.add(articleIndex);
    }

    setBookmarkedArticles(newBookmarkedArticles);
    localStorage.setItem(
      "bookmarkedArticles",
      JSON.stringify([...newBookmarkedArticles])
    );
  };

  const handleSendLink = (link) => {
    navigator.clipboard.writeText(link)
    .then(() => {
         alert("✅ Link copied to clipboard!");
      })
      .catch(() => {
        alert("❌ Failed to copy link.");
      })
  }

  if (loading) return <p className="home-container">Loading news...</p>;
  if (error) return <p className="home-container">{error}</p>;
  if (articles.length === 0)
    return <p className="home-container">No news available</p>;

  return (
    <div className="home-container">
      {articles.map((article, idx) => (
        <div key={idx} className="card-content">
          <div className="card">
            <div className="card-header">
              <div className="action-buttons">
                {/* Like Button */}
                {likedArticles.has(idx) ? (
                  <ThumbUpAltIcon
                    onClick={() => handleLike(idx)}
                    className="btn-liked"
                    title="Remove like"
                  />
                ) : (
                  <ThumbUpOffAltIcon
                    onClick={() => handleLike(idx)}
                    className="btn-unliked"
                    title="Like"
                  />
                )}

                {/* Dislike Button */}
                {dislikedArticles.has(idx) ? (
                  <ThumbDownAltIcon
                    onClick={() => handleDislike(idx)}
                    className="btn-disliked"
                    title="Remove dislike"
                  />
                ) : (
                  <ThumbDownOffAltIcon
                    onClick={() => handleDislike(idx)}
                    className="btn-disdisliked"
                    title="Dislike"
                  />
                )}

                {/* Bookmark Button */}
                {bookmarkedArticles.has(idx) ? (
                  <BookmarkAddIcon
                    onClick={() => handleBookmark(idx)}
                    className="btn-bookmarked"
                    title="Remove bookmark"
                  />
                ) : (
                  <BookmarkAddedIcon
                    onClick={() => handleBookmark(idx)}
                    className="btn-unbookmark"
                    title="Bookmark"
                  />
                )}
                {/* CopylinkButton */}
                <LinkIcon
                  onClick={() => handleSendLink(article.link)}
                  className="btn-cpylink"
                  title="Copy Link"
                  style={{ cursor: "pointer" }}
                />
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
                <img
                  src={article.image}
                  alt={article.title}
                  className="card-img"
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
