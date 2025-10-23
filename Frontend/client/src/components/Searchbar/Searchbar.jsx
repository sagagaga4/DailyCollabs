import React, { useEffect, useState } from "react";
import SearchIcon from '@mui/icons-material/Search';
import "./SearchBar.css";

export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState("");

  //Load tags from localStorage on initial render
  const [tags, setTags] = useState(() => {
    try {
      const storedTags = localStorage.getItem("tags");
      return storedTags ? JSON.parse(storedTags) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false); // For showing "Thinking..." animation
  const [error, setError] = useState(null);

  // ✅ Save tags to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("tags", JSON.stringify(tags));
  }, [tags]);

  // ✅ Handle search submission
  const handleSearch = async (e, searchQuery) => {
    if (e) e.preventDefault();
    const q = searchQuery || query; // allow tag click to trigger search

    if (!q.trim()) return;

    setLoading(true); // start loading animation
    setError(null);

    try {
      // Send query to Node.js server
      const response = await fetch("http://192.168.68.117:4000/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!response.ok) throw new Error("Failed to fetch articles.");

      const articles = await response.json();

      if (!articles || articles.length === 0) {
        setError("No articles found for this topic.");
      } else {
        onResults?.(articles); // Send articles up to Home.jsx for display
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Something went wrong, please try again.");
    } finally {
      setLoading(false); // stop loading animation
    }
  };

  // ✅ Add a new tag
  const handleAddTag = (e) => {
    e.preventDefault();
    const newTag = query.trim();

    if (newTag && !tags.includes(newTag)) {
      let updatedTags = [...tags, newTag];

      // Keep only the 12 most recent tags
      if (updatedTags.length > 12) {
        updatedTags = updatedTags.slice(updatedTags.length - 12);
      }

      setTags(updatedTags);
      setQuery("");
    }
  };

  // ✅ Click on tag to perform search
  const handleTagClick = (tag) => {
    handleSearch(null, tag);
  };

  // ✅ Remove a tag from the list
  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="searchbar">
      <form onSubmit={handleSearch} className="searchbar-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="searchbar-input"
        />

        <button
          type="submit"
          disabled={loading}
          className="searchbar-btn"
        >
          <SearchIcon style={{ fontSize: '1.2rem', marginRight: '4px' }} />
        </button>

        {/* Add tag button */}
        <button
          type="button"
          onClick={handleAddTag}
          disabled={!query.trim()}
          className="addTag-btn"
        >
          Tag
        </button>
      </form>

      {loading && (
        <div className="thinking-container">
          <span className="loading-dots" style={{fontWeight:"bolder", fontSize: "20px",fontFamily:"monospace"}}>
            🤔Thinking<span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}

      <div className="tag-container">
        {tags.map((tag, index) => (
          <div key={index} className="tag">
            <span
              className="tag-text"
              onClick={() => handleTagClick(tag)}
            >
              #{tag}
            </span>
            <span
              className="tag-remove"
              onClick={() => handleRemoveTag(tag)}
              title="Remove tag"
            >
              ✕
            </span>
          </div>
        ))}
      </div>

      {/* Display error messages */}
      {error && <p className="searchbar-error">{error}</p>}
    </div>
  );
}
