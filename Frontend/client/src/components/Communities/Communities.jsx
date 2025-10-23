import { useEffect, useState } from "react";
import "./Communities.css";

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const token = sessionStorage.getItem("token");

  useEffect(() => {
    async function fetchCommunities() {
      try {
//        const res = await fetch("http://localhost:4000/communities", {
        const res = await fetch("http://192.168.68.117:4000/communities", {
          
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCommunities(data);
      } catch (err) {
        console.error("Failed to load communities:", err);
      }
    }

    fetchCommunities();
  }, [token]);

  if(communities.length === 0) {
    return <p className="empty-message">No communities yet. Try create one!</p>
  }

  return(
    <div className="com-home-container">
      {communities.map((community) => (
        <div key={community._id} className="com-card">
          <header className="com-head">{community.name}</header>

          <section className="com-content">
            <h4 className="com-label">Description</h4>
            <p>{community.description || "No description provided"}</p>

            <h4 className="com-label">Created by</h4>
            <p>{community.userId?.username || "Unknown user"}</p>

            <button className="com-button">View Community</button>
          </section>
        </div>
      ))}
    </div>
  );
}