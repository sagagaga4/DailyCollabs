import { useEffect, useState } from "react";
import "./Home.css";

export default function Home() {
  const [users, setUsers] = useState([]);
  const token = sessionStorage.getItem("token");

  useEffect(() => {
    fetch("http://localhost:4000/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch((err) => console.error("Failed to load users:", err));
  }, [token]);

  return (
    <div className="home-container">
      {users.map((user) => (
        <div key={user._id} className="card">
          <div className="head">{user.username}</div>
          <div className="content">
            <p>Email: {user.email}</p>
            <p>
              Community: {user.communityId?.name || "General"}
            </p>
            <p>
              Added by: {user.userId?.username || "Unknown"}
            </p>
            <button className="button">View Profile</button>
          </div>
        </div>
      ))}
    </div>
  );
}
