import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PostCard from '../Posts/PostCard';

export default function CommunityPage() {
  const { id } = useParams();
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`http://localhost:4000/communities/${id}/feed`);
      //const res = await fetch(`http://192.168.68.117:4000/communities/${id}/feed`);
      setItems(await res.json());
    }
    load();
  }, [id]);

  return (
    <div>
      <h2>Community Feed</h2>
      {items.map(item => (
        <PostCard key={item.postId || item.link || item.title} item={item} />
      ))}
    </div>
  );
}
