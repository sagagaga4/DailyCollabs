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
      // Send search to Node.js backend
      const res = await fetch("http://localhost:4000/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error("Failed to fetch results");

      const data = await res.json();

      // Pass results to parent (Home.jsx)
      if (onResults) onResults(data);
    } catch (err) {
      console.error("AI Search Error:", err);
      setError("Something went wrong, please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="searcherbar">
      <form onSubmit={handleSearch} className="searchbar-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What interest you today?"
          className="search-input"
        />
        <button
          type="submit"
          disabled={loading}
          className="searchbar-btn"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="searchbar-error">{error}</p>}
    </div>
  );
}
