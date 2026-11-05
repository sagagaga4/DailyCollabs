// App.jsx
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigationType, matchRoutes } from "react-router-dom";
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
import RouteCache from './components/Navigation/RouteCache';
import './App.css';

const cachedPaths = ['/', '/Agents', '/Communities', '/Communities/:id', '/Settings', '/Posts', '/Channel', '/Comments', '/Notifications', '/Bookmarked'].map(path => ({ path }));

function useSessionToken() {
  useLocation();
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  useEffect(() => {
    const refresh = () => setToken(sessionStorage.getItem('token'));
    // Clear authenticated DOM before a logged-out document enters browser
    // back/forward cache, and recheck when a previous document is restored.
    const departing = () => { if (sessionStorage.getItem('token') !== token) flushSync(refresh); };
    for (const event of ['pageshow', 'focus', 'storage', 'dailycollabs:auth']) window.addEventListener(event, refresh);
    window.addEventListener('pagehide', departing);
    return () => {
      for (const event of ['pageshow', 'focus', 'storage', 'dailycollabs:auth']) window.removeEventListener(event, refresh);
      window.removeEventListener('pagehide', departing);
    };
  }, [token]);
  // Router navigation also catches a same-tab token replacement immediately.
  return sessionStorage.getItem('token');
}

function CachedApplicationPage({ location, token }) {
  return <Routes location={location}>
    <Route path="/Agents" element={<Agents />} />
    <Route path="/" element={<Home />} />
    <Route path="/Communities" element={<Communities />} />
    <Route path="/Communities/:id" element={<CommunityPage />} />
    <Route path="/Settings" element={<Settings />} />
    <Route path="/Posts" element={<Posts />} />
    <Route path="/Channel" element={<MyChannel />} />
    <Route path="/Comments" element={<MyComments />} />
    <Route path="/Notifications" element={<Notifications />} />
    <Route path="/Bookmarked" element={<Bookmarked token={token} />} />
  </Routes>;
}

function ApplicationRoutes({ token }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const validLocation = Boolean(matchRoutes(cachedPaths, location));
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
            <RouteCache key={token} owner={token} location={location} navigationType={navigationType} validLocation={validLocation} renderPage={cachedLocation => <CachedApplicationPage location={cachedLocation} token={token} />} />
            {!validLocation && <Navigate to="/" replace />}
          </div>
        </div>
      )}
      </>
  );
}

export default function App() {
  return <Router><SessionApplication /></Router>;
}

function SessionApplication() {
  const token = useSessionToken();
  return <StoryCommentsProvider key={token || 'guest'}><ContentActionsProvider><ApplicationRoutes token={token} /></ContentActionsProvider></StoryCommentsProvider>;
}
