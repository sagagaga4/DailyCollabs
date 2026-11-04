// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./components/Login/Login";
import Register from "./components/Register/Register";

import Home from "./components/Home/Home";
import Sidebar from "./components/Sidebar/Sidebar";
import Communities from "./components/Communities/Communities";
import Posts from "./components/Posts/Posts";
import MyComments from "./components/Comments/MyComments";
import StoryCommentsProvider from "./components/Comments/StoryCommentsProvider";
import Notifications from "./components/Notifications/Notifications";
import Bookmarked from "./components/Bookmarked/Bookmarked";
import Agents from "./components/Agents/Agents";
import Settings from "./components/Settings/Settings";
import CommunityPage from "./components/Communities/CommunitiesPage";
import { ContentActionsProvider } from './components/CardActions';
import MyChannel from './components/CardActions/MyChannel';
import Welcome from './components/Welcome/Welcome';
import './App.css';

function ApplicationRoutes() {
  const token = sessionStorage.getItem("token");
  const location = useLocation();
  if (location.pathname.toLowerCase() === '/welcome') return <Welcome />;
  return (
      <>
      {!token ? (
        // If not logged in → only show login
        <div className="auth-shell"><Routes>
          <Route path="/Agents" element={<Agents />} />
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login onLogin={() => window.location.reload()} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<Navigate to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />} />
        </Routes></div>
      ) : (
        <div className="app-shell">
          <Sidebar />
          <div className="app-content" id="main-content" tabIndex={-1}>
            <Routes>
              <Route path="/Agents" element={<Agents />} />
              <Route path="/" element={<Home />} />
              <Route path="/Communities" element={<Communities />} />
              <Route path="/Communities/:id" element={<CommunityPage />} />
              <Route path="/Settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/Posts" element={<Posts />} />
              <Route path="/Channel" element={<MyChannel />} />
              <Route path="/Comments" element={<MyComments />} />
              <Route path="/Notifications" element={<Notifications />} />
              <Route path="/Bookmarked" element={<Bookmarked token={token}/>} />
            </Routes>
          </div>
        </div>
      )}
      </>
  );
}

export default function App() {
  return <Router><StoryCommentsProvider><ContentActionsProvider><ApplicationRoutes /></ContentActionsProvider></StoryCommentsProvider></Router>;
}
