import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Register/Register.css";

export default function Register() {
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
});

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const navigate = useNavigate();
  const handleRegister = async (e) => {
    e.preventDefault();
    
    try {
        const resp = await fetch("http://localhost:4000/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await resp.text();

        if (resp.ok) {
          alert("Registration successful! You can now login...");
          navigate("/login");
        } else {
          alert(`Registration failed: ${data}`);
        }
    } catch(err) {
      console.error("Registration error:", err);
      alert("Registration failed: Network error");
    }
  };

  return (

<div className="register-container">
      <h2>Create Account</h2>
      <div className="user-register">

      <form onSubmit={handleRegister}>
        <input
          className="input-field"
          type="text"
          name="fullname"
          placeholder="Full Name"
          value={formData.fullname}
          onChange={handleChange}
          required
        />
        <br />
        <input
          className="input-field"
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <br />
        <input
          className="input-field"
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <br />
        <input
          className="input-field"
          type="password"
          name="password"
          placeholder="Password (1 uppercase, 1 special char)"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <br />
        <button 
        className="register-button"
        type="submit">
          Register
        </button>
      </form>
      </div>
    </div>
  );
}