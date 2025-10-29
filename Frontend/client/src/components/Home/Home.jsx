import React, { useEffect, useState } from "react";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import CancelIcon from '@mui/icons-material/Cancel';
import LinkIcon from "@mui/icons-material/Link";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchBar from "../Searchbar/Searchbar";
import "./Home.css";

export default function Home() {
  
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [token, setToken] = useState(null);

  // Reaction tracking from DB
  const [userReactions, setUserReactions] = useState({}); // { articleLink: "like" | "dislike" | null }
  const [reactionCounts, setReactionCounts] = useState({}); // { articleLink: { likes, dislikes } }

  // Bookmarks (local)
  const [bookmarkedArticles, setBookmarkedArticles] = useState(new Set());

  // Comment Sections
  const [previewData, setPreviewData] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  
  const [currentUser, setCurrentUser] = useState(null);
  
  // Load user preferences and auth token
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get auth token
        const savedToken = localStorage.getItem("token");
        setToken(savedToken);

        // Load bookmarks from localStorage
        setBookmarkedArticles(new Set(JSON.parse(localStorage.getItem("bookmarkedArticles") || "[]")));
      
        const user = JSON.parse(localStorage.getItem("currentUser") || '{"username": "Anonymous"}');
        setCurrentUser(user);

        // Check if we have cached articles from a previous session
        const cachedArticles = sessionStorage.getItem("cachedArticles");
        const cacheTimestamp = sessionStorage.getItem("cacheTimestamp");
        
        if (cachedArticles && cacheTimestamp) {
          const parsedArticles = JSON.parse(cachedArticles);
          setArticles(parsedArticles);
          
          // Fetch reactions for cached articles
          if (savedToken) {
            await fetchReactionsForArticles(parsedArticles, savedToken);
          }
          
          setLoading(false);
          setIsInitialLoad(false);
          return;
        }

        // If no cache, fetch default RSS feed
        const response = await fetch("http://localhost:4000/rss");
        if (!response.ok) throw new Error("Failed to fetch news feed");

        const data = await response.json();
        setArticles(data);
        
        // Fetch reactions for articles
        if (savedToken) {
          await fetchReactionsForArticles(data, savedToken);
        }
        
        // Cache the default articles
        sessionStorage.setItem("cachedArticles", JSON.stringify(data));
        sessionStorage.setItem("cacheTimestamp", Date.now().toString());
        //sessionStorage.setItem("userReactions",JSON.stringify());

      } catch (err) {
        console.error("Error initializing data:", err);
        setError("Failed to load news");
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };

    initializeData();
  }, []);

  // Fetch user's reactions for articles
  const fetchReactionsForArticles = async (articlesList, authToken) => {
    try {
      const reactions = {};
      const counts = {};

      for (const article of articlesList) {
        try {
          // Get user's reaction
          const userReactionRes = await fetch(`http://localhost:4000/reactions/${article.link}/my`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          
          if (userReactionRes.ok) {
            const userReactionData = await userReactionRes.json();
            reactions[article.link] = userReactionData.reaction || null;
          }

          // Get reaction counts
          const countRes = await fetch(`http://localhost:4000/reactions/${article.link}/count`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          
          if (countRes.ok) {
            const countData = await countRes.json();
            counts[article.link] = countData;
          }
        } catch (err) {
          console.error(`Error fetching reactions for ${article.link}:`, err);
        }
      }

      setUserReactions(reactions);
      setReactionCounts(counts);
    } catch (err) {
      console.error("Error fetching reactions:", err);
    }
  };

  // Update cache whenever articles change
  useEffect(() => {
    if (!isInitialLoad && articles.length > 0) {
      sessionStorage.setItem("cachedArticles", JSON.stringify(articles));
      sessionStorage.setItem("cacheTimestamp", Date.now().toString());
    }
  }, [articles, isInitialLoad]);

  // Close preview with Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPreviewData(null);
        setNewComment("");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  
  // Like Button - Database backed
  const handleLike = async (articleLink) => {
    if (!token) {
      alert("Please log in to like articles");
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ articleLink, type: "like" }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Update user reaction
        setUserReactions(prev => ({
          ...prev,
          [articleLink]: data.status?.includes("removed") ? null : "like"
        }));

        // Update counts
        if (data.count) {
          setReactionCounts(prev => ({
            ...prev,
            [articleLink]: data.count
          }));
        }
      }
    } catch (err) {
      console.error("Error liking article:", err);
      alert("Failed to like article");
    }
  };

  // Dislike Button - Database backed
  const handleDislike = async (articleLink) => {
    if (!token) {
      alert("Please log in to dislike articles");
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ articleLink, type: "dislike" }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Update user reaction
        setUserReactions(prev => ({
          ...prev,
          [articleLink]: data.status?.includes("removed") ? null : "dislike"
        }));

        // Update counts
        if (data.count) {
          setReactionCounts(prev => ({
            ...prev,
            [articleLink]: data.count
          }));
        }
      }
    } catch (err) {
      console.error("Error disliking article:", err);
      alert("Failed to dislike article");
    }
  };

  // Bookmark Button Logic (local storage)
  const handleBookmark = (articleIndex) => {
    const newBookmarked = new Set(bookmarkedArticles);
    if (newBookmarked.has(articleIndex)) newBookmarked.delete(articleIndex);
    else newBookmarked.add(articleIndex);

    setBookmarkedArticles(newBookmarked);
    localStorage.setItem("bookmarkedArticles", JSON.stringify([...newBookmarked]));
  };
  
  // CopyLink Button Logic
  const handleSendLink = (link) => {
    navigator.clipboard
      .writeText(link)
      .then(() => alert("✅ Link copied to clipboard!"))
      .catch(() => alert("Failed to copy link."));
  };

  // Comment-Preview Button Logic
  const handlePreview = async (article) => {
    try {
      if (article._id) {
        const res = await fetch(`/api/posts/${article._id}/preview`);
        if (!res.ok) throw new Error("Failed to fetch post preview");
        const data = await res.json(); 
        setPreviewData({ 
          source: "post", 
          post: data.post, 
          comments: data.comments ?? [],
          articleId: article._id
        });
      } 
      else
        {
          const savedComments = JSON.parse(localStorage.getItem(`comments_${article.link}`) || "[]");
          setPreviewData({ 
            source: "rss", 
            post: article, 
            comments: savedComments,
            articleId: article.link
          });
        }
    } catch (err) {
      console.error("Error fetching preview:", err);
      const savedComments = JSON.parse(localStorage.getItem(`comments_${article.link}`) || "[]");
      setPreviewData({ 
        source: "error", 
        post: article, 
        comments: savedComments,
        articleId: article.link
      });
    }
  };

  // Add Comment
  const handleAddComment = async () => {
    if (!newComment.trim()) {
      alert("Please enter a comment");
      return;
    }

    setSubmittingComment(true);

    try {
      const comment = {
        id: Date.now().toString(),
        content: newComment.trim(),
        authorId: currentUser?.username || "Anonymous",
        date: new Date().toISOString()
      };

      if (previewData.source === "post" && previewData.articleId) {
        try {
          const res = await fetch(`/api/posts/${previewData.articleId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: comment.content,
              authorId: comment.authorId
            })
          });

          if (res.ok) {
            const savedComment = await res.json();
            setPreviewData(prev => ({
              ...prev,
              comments: [...prev.comments, savedComment]
            }));
          } else {
            throw new Error("Server error");
          }
        } catch (serverErr) {
          console.warn("Failed to save to server, saving locally:", serverErr);
          const storageKey = `comments_${previewData.articleId}`;
          const existingComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
          const updatedComments = [...existingComments, comment];
          localStorage.setItem(storageKey, JSON.stringify(updatedComments));
          
          setPreviewData(prev => ({
            ...prev,
            comments: updatedComments
          }));
        }
      } else {
        const storageKey = `comments_${previewData.articleId}`;
        const existingComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const updatedComments = [...existingComments, comment];
        localStorage.setItem(storageKey, JSON.stringify(updatedComments));
        
        setPreviewData(prev => ({
          ...prev,
          comments: updatedComments
        }));
      }
      
      setNewComment("");
      
    } catch (err) {
      console.error("Error adding comment:", err);
      alert("Failed to add comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Edit Comment
  const handleEditComment = (comment) => {
    setEditingComment(comment.id || comment._id);
    setEditCommentText(comment.content);
  };

  // Save Edit
  const handleSaveEdit = async (commentId) => {
    if (!editCommentText.trim()) {
      alert("Comment cannot be empty");
      return;
    }

    try {
      if (previewData.source === "post" && previewData.articleId) {
        try {
          const res = await fetch(`/api/posts/${previewData.articleId}/comments/${commentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: editCommentText.trim() })
          });

          if (res.ok) {
            setPreviewData(prev => ({
              ...prev,
              comments: prev.comments.map(c => 
                (c.id || c._id) === commentId 
                  ? { ...c, content: editCommentText.trim(), edited: true }
                  : c
              )
            }));
          } else {
            throw new Error("Server error");
          }
        } catch (serverErr) {
          console.warn("Failed to edit on server, editing locally:", serverErr);
          const storageKey = `comments_${previewData.articleId}`;
          const existingComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
          const updatedComments = existingComments.map(c => 
            c.id === commentId ? { ...c, content: editCommentText.trim(), edited: true } : c
          );

          localStorage.setItem(storageKey, JSON.stringify(updatedComments));
          
          setPreviewData(prev => ({...prev, comments: updatedComments}));
        }
      } else {
        const storageKey = `comments_${previewData.articleId}`;
        const existingComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const updatedComments = existingComments.map(c => 
          c.id === commentId ? { ...c, content: editCommentText.trim(), edited: true } : c
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedComments));
        
        setPreviewData(prev => ({
          ...prev,
          comments: updatedComments
        }));
      }

      setEditingComment(null);
      setEditCommentText("");
    } catch (err) {
      console.error("Error editing comment:", err);
      alert("Failed to edit comment. Please try again.");
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId) => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      if (previewData.source === "post" && previewData.articleId) {
        try {
          const res = await fetch(`/api/posts/${previewData.articleId}/comments/${commentId}`, {
            method: "DELETE"
          });

          if (res.ok) {
            setPreviewData(prev => ({
              ...prev,
              comments: prev.comments.filter(c => (c.id || c._id) !== commentId)
            }));
          } else {
            throw new Error("Server error");
          }
        } catch (serverErr) {
          console.warn("Failed to delete from server, deleting locally:", serverErr);
          const storageKey = `comments_${previewData.articleId}`;
          const existingComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
          const updatedComments = existingComments.filter(c => c.id !== commentId);
          localStorage.setItem(storageKey, JSON.stringify(updatedComments));
          
          setPreviewData(prev => ({...prev, comments: updatedComments}));
        }
      } else {
        const storageKey = `comments_${previewData.articleId}`;
        const existingComments = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const updatedComments = existingComments.filter(c => c.id !== commentId);
        localStorage.setItem(storageKey, JSON.stringify(updatedComments));
        
        setPreviewData(prev => ({
          ...prev,
          comments: updatedComments
        }));
      }
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert("Failed to delete comment. Please try again.");
    }
  };

  // Cancel Edit
  const cancelEdit = () => {
    setEditingComment(null);
    setEditCommentText("");
  };
  
  // Close Preview
  const closePreview = () => {
    setPreviewData(null);
    setNewComment("");
  };

  // Handle search results
  const handleSearchResults = (results) => {
    setArticles(results);
    if (token) {
      fetchReactionsForArticles(results, token);
    }
  };

  if (loading) return <p className="home-container">Loading news...</p>;
  if (error) return <p className="home-container">{error}</p>;
  if (!articles || articles.length === 0) return <p className="home-container">No news available</p>;

  return (
  <div className="home-container">
     <SearchBar onResults={handleSearchResults} />
      <div className="grid-container">
      {articles.map((article, idx) => {
        const userReaction = userReactions[article.link];
        const counts = reactionCounts[article.link] || { likes: 0, dislikes: 0 };

        return (
        <div key={idx} className="card-content">
          <div className="card">
            <div className="card-header">
              <div className="button-wrapper">
                <a href={article.link} target="_blank" rel="noopener noreferrer" className="button">
                  Read Post ✨
                </a>
              </div>

              <div className="head">
                {article.title && article.title.length <= 30
                  ? article.title
                  : (article.title || "Untitled").slice(0, 40) + "..."}
              </div>

              <div className="content">
                <p style={{ color: "#b2a0b6ca" }}>
                  {article.pubDate ? new Date(article.pubDate).toLocaleDateString("en-GB") : ""}
                </p>
                {article.description && (
                  <p style={{ color: "#ded1e1ea" }}>
                    {article.description.length > 50 ? article.description.slice(0, 50) + "..." : article.description}
                  </p>
                )}

                <div className="bottom-section">
                  {article.image && <img src={article.image} alt={article.title} 
                  className="card-img" />}

                  <div className="action-buttons">
                    {userReaction === "like" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ThumbUpAltIcon onClick={() => handleLike(article.link)} 
                        className="btn-liked" title="Remove like" />
                        <span style={{ fontSize: 12, color: "#1dc37eff" }}>{counts.likes}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ThumbUpOffAltIcon onClick={() => handleLike(article.link)} 
                        className="btn-unliked" title="Like" />
                        <span style={{ fontSize: 12, color: "#b2a0b6ca" }}>{counts.likes}</span>
                      </div>
                    )}

                    {userReaction === "dislike" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ThumbDownAltIcon onClick={() => handleDislike(article.link)} 
                        className="btn-disliked" title="Remove dislike" />
                        <span style={{ fontSize: 12, color: "#d37e7eff" }}>{counts.dislikes}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <ThumbDownOffAltIcon onClick={() => handleDislike(article.link)} 
                        className="btn-disdisliked" title="Dislike" />
                        <span style={{ fontSize: 12, color: "#b2a0b6ca" }}>{counts.dislikes}</span>
                      </div>
                    )}

                    {bookmarkedArticles.has(idx) ? (
                      <BookmarkAddedIcon onClick={() => handleBookmark(idx)} 
                      className="btn-bookmarked" title="Remove bookmark" />
                    ) : (
                      <BookmarkAddIcon onClick={() => handleBookmark(idx)} 
                      className="btn-unbookmark" title="Bookmark" />
                    )}

                    <LinkIcon onClick={() => handleSendLink(article.link)} 
                    className="btn-cpylink" title="Copy Link" 
                    style={{ cursor: "pointer" }} />

                    <ChatIcon onClick={() => handlePreview(article)} 
                    className="btn-comments" title="View Comments" 
                    style={{ cursor: "pointer" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      })}

      {/* Modal (preview) */}
      {previewData && (
        <div className="modal-overlay" onClick={closePreview}>
            <CancelIcon className="modal-close" onClick={closePreview} aria-label="Close preview"></CancelIcon>

          <div className="modal-card" onClick={(e) => e.stopPropagation()}>

            <h2 style={{ marginBottom: 6 }}>{previewData.post?.title || "Preview"}</h2>
            <p style={{ color: "#cac8bbca",fontWeight:"bold", marginTop: 0 }}>
              {previewData.post?.pubDate ? new Date(previewData.post.pubDate).toLocaleString() : ""}
            </p>

            {previewData.post?.image && (
              <img src={previewData.post.image} alt={previewData.post.title} 
              style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 8 }} />
            )}

            <div style={{ marginTop: 12 }}>
              <p>{previewData.post?.content || previewData.post?.description ||
                   previewData.post?.summary || "No full content available."}</p>
            </div>

            {/* Action buttons in preview */}
            <div style={{ 
              display: "flex", 
              gap: "12px", 
              justifyContent: "center", 
              margin: "16px 0",
              padding: "12px",
              border:"1px solid #cac5c527",
              borderRadius: 15
            }}>
              {previewData.post && (
                <>
                  {userReactions[previewData.post.link] === "like" ? (
                    <ThumbUpAltIcon 
                      onClick={() => handleLike(previewData.post.link)} 
                      className="btn-liked" 
                      title="Remove like"
                      style={{ cursor: "pointer", fontSize: 20 }}
                    />
                  ) : (
                    <ThumbUpOffAltIcon 
                      onClick={() => handleLike(previewData.post.link)} 
                      className="btn-unliked" 
                      title="Like"
                      style={{ cursor: "pointer", fontSize: 20 }}
                    />
                  )}

                  {userReactions[previewData.post.link] === "dislike" ? (
                    <ThumbDownAltIcon 
                      onClick={() => handleDislike(previewData.post.link)} 
                      className="btn-disliked" 
                      title="Remove dislike"
                      style={{ cursor: "pointer", fontSize: 20 }}
                    />
                  ) : (
                    <ThumbDownOffAltIcon 
                      onClick={() => handleDislike(previewData.post.link)} 
                      className="btn-disdisliked" 
                      title="Dislike"
                      style={{ cursor: "pointer", fontSize: 20 }}
                    />
                  )}

                  {bookmarkedArticles.has(articles.findIndex(a => a.link === previewData.post.link)) ? (
                    <BookmarkAddedIcon 
                      onClick={() => handleBookmark(articles.findIndex(a => a.link === previewData.post.link))} 
                      className="btn-bookmarked" 
                      title="Remove bookmark"
                      style={{ cursor: "pointer", fontSize: 20 }}
                    />
                  ) : (
                    <BookmarkAddIcon 
                      onClick={() => handleBookmark(articles.findIndex(a => a.link === previewData.post.link))} 
                      className="btn-unbookmark" 
                      title="Bookmark"
                      style={{ cursor: "pointer", fontSize: 20 }}
                    />
                  )}

                  <LinkIcon 
                    onClick={() => handleSendLink(previewData.post.link)} 
                    className="btn-cpylink" 
                    title="Copy Link"
                    style={{ cursor: "pointer", fontSize: 20 }}
                  />
                </>
              )}
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 12 }}>Comments ({previewData.comments?.length || 0})</h3>
            
            {/* Add Comment Section */}
            <div style={{ marginBottom: 16, padding: "12px", backgroundColor: "#101012", borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  placeholder={`Add a comment as ${currentUser?.username || "Anonymous"}...`}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.2)",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    color: "#fff",
                    fontSize: 14,
                    minHeight: 60,
                    resize: "vertical"
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={submittingComment || !newComment.trim()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: submittingComment || !newComment.trim() 
                      ? "#1f1f21ff" 
                      : "#1dc37eff",
                    color: "#fff",
                    cursor: submittingComment || !newComment.trim() 
                      ? "not-allowed" 
                      : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 80
                  }}
                >
                  {submittingComment ? "..." : <SendIcon style={{ fontSize: 18 }} />}
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {previewData.comments && previewData.comments.length > 0 ? (
                previewData.comments.map((c, index) => {
                  const commentId = c._id || c.id;
                  const isCurrentUser = c.authorId === currentUser?.username;
                  const isEditing = editingComment === commentId;

                  return (
                    <div key={commentId || index} style={{ 
                      padding: "12px", 
                      marginBottom: "8px",
                      borderRadius: 8,
                      backgroundColor: "rgba(255,255,255,0.02)",
                      border: isCurrentUser ? "1px solid rgba(237, 236, 230, 0.3)" : "1px solid rgba(255,255,255,0.04)"
                    }}>
                      {isEditing ? (
                        <div style={{ marginBottom: 8 }}>
                          <textarea
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: 6,
                              border: "1px solid rgba(255,255,255,0.2)",
                              backgroundColor: "rgba(0,0,0,0.3)",
                              color: "#fff",
                              fontSize: 14,
                              minHeight: 60,
                              resize: "vertical"
                            }}
                          />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button
                              onClick={() => handleSaveEdit(commentId)}
                              style={{
                                padding: "4px 12px",
                                borderRadius: 4,
                                border: "none",
                                backgroundColor: "#3f3f47ff",
                                color: "#fff",
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: "4px 12px",
                                borderRadius: 4,
                                border: "1px solid rgba(255,255,255,0.2)",
                                backgroundColor: "transparent",
                                color: "#fff",
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 14, color: "#ddd", marginBottom: 4 }}>
                            {c.content}
                            {c.edited && <span style={{ fontSize: 11, color: "#999", fontStyle: "italic" }}> (edited)</span>}
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            fontSize: 12, 
                            color: "#999" 
                          }}>
                            <div>
                              <strong>{c.authorId || "Anonymous"}</strong>
                              {c.date && ` • ${new Date(c.date).toLocaleString()}`}
                            </div>
                            
                            {isCurrentUser && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <EditIcon
                                  onClick={() => handleEditComment(c)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#aac2dbff",
                                    fontSize: 13,
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit
                                </EditIcon>
                                <DeleteIcon
                                  onClick={() => handleDeleteComment(commentId)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#aac2dbff",
                                    fontSize: 13,
                                    cursor: "pointer",
                                    textDecoration: "underline"
                                  }}
                                >
                                  Delete
                                </DeleteIcon>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={{ color: "#cfcfcf", textAlign: "center", padding: "20px 0" }}>
                  No comments yet. Be the first to comment!
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}