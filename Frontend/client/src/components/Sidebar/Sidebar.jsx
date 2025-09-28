import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

// All the svg files
//import logo from "./icons/export_linux.svg"
import Home from "./icons/home-solid.svg";
import Team from "./icons/social.svg";
import Posts  from "./icons/posts.svg";
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';

const Sidebar = () => {
  const [click, setClick] = useState(false);
  const [profileClick, setProfileClick] = useState(false);
  const handleProfileClick = () => setProfileClick(!profileClick);

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

        <ul className={`slick-bar ${click ? "expanded" : ""}`}>
          <NavLink
            exact="true"
            to="/"
            activeclassname="active"
            onClick={() => setClick(false)}
          >
            <img src={Home} alt="Home" />
            <span className={`text ${click ? "show" : ""}`}>Home</span>
          </NavLink>

          <NavLink
            to="/Communities"
            activeclassname="active"
            onClick={() => setClick(false)}
          >
            <img src={Team} alt="Team" />
            <span className={`text ${click ? "show" : ""}`}>Community</span>
          </NavLink>

            <NavLink
            to="/Posts"
            activeclassname="active"
            onClick={() => setClick(false)}
          >
            <img src={Posts} alt="Posts" />
            <span className={`text ${click ? "show" : ""}`}>Community</span>
          </NavLink>

          <NavLink
            to= "/Bookmarked"
            activeclassname="active"
            onClick={()=> setClick(false)}
          >
            <CollectionsBookmarkIcon style={{color:'#f8f8f6eb'}}></CollectionsBookmarkIcon>
            <span className={`text ${click ? "show" : ""}`}>Community</span>
          </NavLink>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
