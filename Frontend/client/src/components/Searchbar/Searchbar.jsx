import React, { useEffect, useState } from "react";
import SearchIcon from '@mui/icons-material/Search';
import "./SearchBar.css";

export default function SearchBar({ onResults, userId, token }) {
  const [query, setQuery] = useState("");


  // Load tags from backend on initial render
const [tags, setTags] = useState([]);

useEffect(() => {
  const loadTags = async () => {
    try {
      const res = await fetch("http://localhost:4000/tags");
      const data = await res.json();
      setTags(data);
    } catch (err) {
      console.error(err);
    }
  };

  loadTags();
}, []);

  // Add a new tag (save to DB AND state)
  const handleAddTag = async (e) => {
    e.preventDefault();
    const newTag = query.trim();
    if (!newTag || tags.includes(newTag)) return;

    try {
      const res = await fetch("http://localhost:4000/tags", {
      //const res = await fetch("http://192.168.68.117:4000/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // include token
        },
          body: JSON.stringify({
          userId,
          tagName: newTag,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      //Append the new tag to the already existing tags
      let updatedTags = [...tags, { _id: Date.now(), tagName: newTag }];

      // Keep only the 12 most recent tags
      if (updatedTags.length > 12) {
        alert("12 TAGS LIMIT");
        return;
      }

      setTags(updatedTags);
      setQuery("");

    } catch (err) {
      console.error("Failed to add tag:", err.message);
      alert(err.message);
    }
  };

  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);

  // Save tags to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("tags", JSON.stringify(tags));
  }, [tags]);

  // Handle search submission
  const handleSearch = async (e, searchQuery) => {
    if (e) e.preventDefault();
    const q = searchQuery || query; // allow tag click to trigger search

    if (!q.trim()) return;

    setLoading(true); // start loading animation
    setError(null);

    try {
        // Send query to Node.js server
        const response = await fetch("http://localhost:4000/rss", {
        // const response = await fetch("http://192.168.68.117:4000/rss", {
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

  // Click on tag to perform search
  const handleTagClick = (tag) => {
    handleSearch(null, tag);
  };

// Remove a tag from the list
const handleRemoveTag = async (tagToRemove) => {
  try {
    const res = await fetch(`http://localhost:4000/tags/${encodeURIComponent(tagToRemove)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    // Update the UI after successful deletion
    setTags(tags.filter(tag => tag.tagName !== tagToRemove));

  } catch (err) {
    console.error("Failed to delete tag:", err.message);
    alert("Failed to delete tag from database.");
  }
};


  return (
    <div className="searchbar">
      <form onSubmit={handleSearch} className="searchbar-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type here..."
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

      {/* Thinking animation outside the button */}
      {loading && (
        <div className="thinking-container">
          <span className="loading-dots" style={{fontWeight:"bolder", fontSize: "20px",fontFamily:"monospace"}}>
            🤔Thinking<span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}

      <div className="tag-container">
        {tags.map((tag) => (
          <div key={tag._id} className="tag">
            <span
              className="tag-text"
              onClick={() => handleTagClick(tag.tagName)}
            >
              #{tag.tagName}
            </span>
            <span
              className="tag-remove"
              onClick={() => handleRemoveTag(tag.tagName)}
              title="Remove tag"
            >
              ×
            </span>
          </div>
        ))}
      </div>

      {/* Display error messages */}
      {error && <p className="searchbar-error">{error}</p>}
    </div>
  );
}
