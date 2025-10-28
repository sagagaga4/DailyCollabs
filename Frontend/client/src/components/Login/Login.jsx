// src/components/Login.jsx
import { useState } from "react";
import "./Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
     const resp = await fetch("http://localhost:4000/auth/login", {
    //const resp = await fetch("http://192.168.68.117:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await resp.json();

      if (!resp.ok) {
      console.error("Login failed:", data);
      alert(`Login failed: ${data.error || "Unknown error"}`);
      return;
    }

      if (data.token) {
        sessionStorage.setItem("token", data.token);
        window.location.href="/";
      } else {
        alert( "Login failed");
      }
    } catch(err) {
      console.error("Login error:", err);
      alert("Login failed: Network error");
    }
  };

  return (
    <div className="login-container">
    <div className="user-login">
      <h2 style={{color:' rgba(255, 255, 255, 1)',fontWeight:'normal' ,fontFamily:'sans-serif'}}>Welcome Back!</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <input
          className="login-input"
          type="text"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <br />
        <input
          className="login-input"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button className="login-button" type="submit">
          Login
        </button>
        <p style={{color: 'rgba(255, 255, 255, 0.7)', marginTop: '2rem', fontSize:'11px'}}>
        Don't have an account?{" "}
        <span 
          onClick={() => window.location.href = '/register'} 
          style={{color: '#a7d4fcff', cursor: 'pointer', textDecoration: 'underline'}}
        >
          Register here
        </span>
        </p>
      </form>
    </div>
    </div>
  );
}
