import React, { useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState([]); // changed from "" to []
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e, searchQuery) => {
    if (e) e.preventDefault();
    const q = searchQuery || query; // allow tag click to trigger search
    if (!q.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Send query directly to Node.js server
      const response = await fetch("http://localhost:4000/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!response.ok) throw new Error("Failed to fetch articles.");

      const articles = await response.json();

      if (!articles || articles.length === 0) {
        setError("No articles found for this topic.");
      } else {
        // Send articles up to Home.jsx for display
        onResults?.(articles);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Something went wrong, please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    const newTag = query.trim();
    if (newTag && !tags.includes(newTag)) {
      if (tags.length >= 10) {
        alert("10 tags limit :(");
        return;
      }
      setTags([...tags, newTag]);
      setQuery("");
    }
  };

  const handleTagClick = (tag) => {
    handleSearch(null, tag);
  };

  // 🧹 REMOVE TAG FUNCTION
  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
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
        <button type="submit" disabled={loading} className="searchbar-btn">
          {loading ? "Thinking..." : "Search"}
        </button>
        {/* ADD TAG BUTTON */}
        <button
          type="button"
          onClick={handleAddTag}
          disabled={!query.trim() || tags.length >= 10}
          className="addTag-btn"
        >
          Tag
        </button>
      </form>

      {/* TAG LIST */}
      <div className="tag-container">
        {tags.map((tag, index) => (
          <div key={index} className="tag">
            <span className="tag-text" onClick={() => handleTagClick(tag)}>
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

      {error && <p className="searchbar-error">{error}</p>}
    </div>
  );
}
