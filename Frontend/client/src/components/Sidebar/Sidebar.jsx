import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

// All the svg files
import logo from "./icons/logo.svg"
import Home from "./icons/home-solid.svg";
import Team from "./icons/social.svg";
import PowerOff from "./icons/power-off-solid.svg";
import Posts  from "./icons/posts.svg";

const Sidebar = () => {
  const [click, setClick] = useState(false);
  const handleClick = () => setClick(!click);

  const [profileClick, setProfileClick] = useState(false);
  const handleProfileClick = () => setProfileClick(!profileClick);

  return (
    <div className="container">
      <button
        className={`menu-button ${click ? "clicked" : ""}`}
        onClick={handleClick}
      >
      </button>

      <div className="sidebar-container">
        <div className="logo">
          <img src={logo} alt="logo" />
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
            <span className={`text ${click ? "show" : ""}`}>Communiti</span>
          </NavLink>

            <NavLink
            to="/Posts"
            activeclassname="active"
            onClick={() => setClick(false)}
          >
            <img src={Posts} alt="Posts" />
            <span className={`text ${click ? "show" : ""}`}>Community</span>
          </NavLink>
        </ul>

        <div className={`profile ${profileClick ? "expanded" : ""}`}>
          <img
            onClick={handleProfileClick}
            src="https://picsum.photos/200"
            alt="Profile"
          />

          <div className={`details ${profileClick ? "show" : ""}`}>
            <div className="name">
              <h4>Jhon&nbsp;Doe</h4>
              <a href="/#">view&nbsp;profile</a>
            </div>
            <button className="logout">
              <img src={PowerOff} alt="logout" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
