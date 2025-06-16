// src/pages/Dashboard.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
      <p className="text-lg">Welcome, {user}!</p>
      <p>You are now logged in. Explore the features available on our site.</p>   
    </div>
  );
}
