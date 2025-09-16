import { useEffect, useState } from "react";
import "./Posts.css";
import AddPost from "./AddPosts";

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const token = sessionStorage.getItem("token");

  const fetchPosts = () => {
    fetch("http://localhost:4000/posts", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setPosts(data))
      .catch((err) => console.error("Failed to load posts:", err));
  };

  useEffect(() => {
    fetchPosts();
  }, [token]);

  return (
    <div className="pos-home-container">
      <h2>Posts</h2>
      <AddPost onPostCreated={fetchPosts} />

      {posts.map((post) => (
        <div key={post._id} className="pos-card">
          <div className="pos-head">{post._id}</div>
          <div className="pos-content">
            <p>Created by: {post.AuthorID || "Unknown"}</p>
            <p>
              Date:{" "}
              {post.date
                ? new Date(post.date).toLocaleDateString()
                : "No date"}
            </p>
            <p>Content: {post.content || "Unknown"}</p>
            <p>Community: {post.communityID || "Not assigned"}</p>
            <button className="pos-button">View Comments</button>
          </div>
        </div>
      ))}
    </div>
  );
}
