// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function Navbar() {
  const { isLoggedIn, logout } = useAuth(); // Updated here
  return (
    <nav className="p-4 bg-gray-800 text-white flex justify-between">
      <Link to="/">Home</Link>
      {isLoggedIn ? ( // Updated here
        <>
          <Link to="/setup">Platform</Link>
          <button onClick={logout} className="ml-4">Logout</button>
        </>
      ) : (
        <Link to="/login">Login</Link>
      )}
    </nav>
  );
}
