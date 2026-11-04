import { useEffect, useState } from 'react';
import { API_URL } from '../../config';

export default function Comments({ postId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const token = sessionStorage.getItem('token');

  useEffect(() => {
    fetch(`${API_URL}/comments/${postId}`)
    .then(r => r.json())
    .then(setComments);
  }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/comments/${postId}`, {
      method: 'POST', 
      headers: {'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`
            },
      body: JSON.stringify({content: text})
      }
    );
    setText('');
    const r = await fetch(`${API_URL}/comments/${postId}`);
    setComments(await r.json());
  };

  return (
    <div>
      <ul>{comments.map(c => <li key={c._id}><strong>{c.authorId?.username || 'User'}</strong>: {c.content}</li>)}</ul>
      <form onSubmit={submit}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Add comment"/>
        <button>Send</button>
      </form>
    </div>
  );
}
