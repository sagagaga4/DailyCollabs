import { useEffect, useState } from "react";
import "./Communities.css";

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const token = sessionStorage.getItem("token");

  useEffect(() => {
    fetch("http://localhost:4000/communities", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setCommunities(data))
      .catch((err) => console.error("Failed to load communities:", err));
  }, [token]);

  return (
    <div className="com-home-container">
      {communities.map((community) => (
        <div key={community._id} className="com-card">
          <div className="com-head">{community.name}</div>
          <div className="com-content">
            <strong style={{color:"#0e6559ff ",fontFamily:"monospace",textDecoration:"underline"}}>Description</strong>
            <p> {community.description || "No description"}</p>
            <p>Created by:</p>
            <p> {community.userId?.username || "Unknown user"}</p>
            <button className="com-button">View Community</button>
          </div>
        </div>
      ))}
    </div>
  );
}
