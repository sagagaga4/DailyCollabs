// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login/Login";
import Register from "./components/Register/Register";

import Home from "./components/Home/Home";
import Sidebar from "./components/Sidebar/Sidebar";
import Communities from "./components/Communities/Communities";
import Posts from "./components/Posts/Posts";
import Comments from "./components/Comments/Comments";
import Bookmarked from "./components/Bookmarked/Bookmarked";

export default function App() {
  const token = sessionStorage.getItem("token");
  return (
    <Router>
      {!token ? (
        // If not logged in → only show login
        <Routes>
          <Route path="/login" element={<Login onLogin={() => window.location.reload()} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <div style={{ display: "flex" }}>
          <Sidebar />
          <div style={{ marginLeft: "4rem", flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/Communities" element={<Communities />} />
              <Route path="/Posts" element={<Posts />} />
              <Route path="/Comments" element={<Comments />} />
              <Route path="/Bookmarked" element={<Bookmarked />}/>
            </Routes>
          </div>
        </div>
      )}
    </Router>
  );
}
