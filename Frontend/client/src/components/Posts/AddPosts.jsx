// components/Posts/AddPost.jsx
import { useState } from "react";
import "./AddPosts.css"

export default function AddPost({ onPostCreated }) {
  const [content, setContent] = useState("");
  const [communityID, setCommunityID] = useState("");
  const token = sessionStorage.getItem("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:4000/posts", {
     //const res = await fetch("http://192.168.68.117:4000/posts", {  
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, 
        },
        body: JSON.stringify({
          content,
          hashtags: ["#general"],
          communityId: communityID || "default-community",
          AuthorID: "12345", // TEMP → I will replace with logged-in user ID from token/session
          date: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      const data = await res.json();
      setContent("");
      setCommunityID("");
      onPostCreated?.(data); 
    } catch (err) {
      console.error("Failed to create post:", err.message);
      alert(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-post-form">
      <textarea className="text-area"
        placeholder="Share something..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <button type="submit" className="post-btn">Post</button>
    </form>
  );
}
