import React, { useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Send query directly to Node.js server
      const response = await fetch("http://localhost:4000/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
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

  return (
    <div className="searchbar">
      <form onSubmit={handleSearch} className="searchbar-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What interests you today?"
          className="searchbar-input"
        />
        <button type="submit" disabled={loading} className="searchbar-btn">
          {loading ? "Thinking..." : "Search"}
        </button>
      </form>

      {error && <p className="searchbar-error">{error}</p>}
    </div>
  );
}
