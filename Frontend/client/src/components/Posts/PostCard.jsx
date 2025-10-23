import { useState } from 'react';

export default function PostCard({ item }) {
  const token = sessionStorage.getItem('token');
  const [likes, setLikes] = useState(item.likesCount || 0);
  //const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    if(!item.postId) return;
//    const res = await fetch(`http://localhost:4000/posts/${item.postId}/like`, {
    const res = await fetch(`http://192.168.68.117:4000/posts/${item.postId}/like`, {
      method: 'POST', headers: {'Authorization': `Bearer ${token}`}
    });
    const json = await res.json();
    setLikes(json.likesCount);
    //setLiked(json.likedBy?.includes() || false);
  };

  const handleSave = async () => {
    if(!item.postId) return;
    await fetch(`http://localhost:4000/posts/${item.postId}/save`, {
      method: 'POST', headers: {'Authorization': `Bearer ${token}`}
    });
  };

  const copyLink = async () => {
    const link = item.link || `${window.location.origin}/posts/${item.postId}`;
    await navigator.clipboard.writeText(link);
    alert('Link copied');
  };

  return (
    <div className="post-card">
      <h3>{item.title}</h3>
      <small>{new Date(item.pubDate).toLocaleString()}</small>
      <p>{item.description}</p>

      <div className="actions">
        <button onClick={handleLike}>Like {likes}</button>
        <button onClick={() => window.location.href = `/posts/${item.postId || ''}`}>Comments</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={copyLink}>Copy link</button>
      </div>
    </div>
  );
}
