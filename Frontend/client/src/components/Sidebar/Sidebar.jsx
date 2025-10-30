import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

// All the svg files
import Home from "./icons/home-solid.svg";
import Team from "./icons/social.svg";
import Posts  from "./icons/posts.svg";
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';

const Sidebar = () => {
  const [profileClick, setProfileClick] = useState(false);
  const handleProfileClick = () => setProfileClick(!profileClick);

  // Helper function to check if the NavLink is active
  const getNavLinkClass = ({ isActive }) => {
    return isActive ? "active" : "";
  };

  return (
    <div className="container">
      
      <div className="sidebar-container">
        
        <div className={`profile ${profileClick ? "expanded" : ""}`}>
          <img
            onClick={handleProfileClick}
            src="https://picsum.photos/200"
            alt="Profile"
          />
        </div>

        {/* The navigation links */}
        <ul className="slick-bar">
          
          <NavLink
            to="/"
            className={getNavLinkClass}
          >
            <img src={Home} alt="Home" />
            <span className="text">Home</span>
            <span className="active-indicator"></span> 
          </NavLink>

          <NavLink
            to="/Communities"
            className={getNavLinkClass}
          >
            <img src={Team} alt="Team" />
            <span className="text">Community</span>
            <span className="active-indicator"></span> 
          </NavLink>

          <NavLink
            to="/Posts"
            className={getNavLinkClass}
          >
            <img src={Posts} alt="Posts" />
            <span className="text">Posts</span>
            <span className="active-indicator"></span> 
          </NavLink>

          <NavLink
            to= "/Bookmarked"
            className={getNavLinkClass}
          >
            <CollectionsBookmarkIcon style={{color:'#f8f8f6eb'}}></CollectionsBookmarkIcon>
            <span className="text">Bookmarked</span>
            <span className="active-indicator"></span> 
          </NavLink>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;