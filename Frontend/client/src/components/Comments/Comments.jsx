import { useEffect, useState } from 'react';

export default function Comments({ postId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const token = sessionStorage.getItem('token');

  useEffect(() => {
    fetch(`http://localhost:4000/comments/${postId}`)
    .then(r => r.json())
    .then(setComments);
  }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    await fetch(`http://localhost:4000/comments/${postId}`, {
      method: 'POST', 
      headers: {'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`
            },
      body: JSON.stringify({content: text})
      }
    );
    setText('');
    const r = await fetch(`http://localhost:4000/comments/${postId}`);
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
