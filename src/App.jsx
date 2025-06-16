import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import Dashboard from "./Pages/Dashboard";
import Login from "./components/Login";
import Setup from "./components/setup";
import Demo from "./components/Demo";
import Play from "./components/Play";
import Training from "./components/Training";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute element={Dashboard} />} />
        <Route path="/setup" element={<ProtectedRoute element={Setup} />} />
        <Route path="/demo" element={<ProtectedRoute element={Demo} />} />
        <Route path="/play" element={<ProtectedRoute element={Play} />} />
        <Route path="/training" element={<ProtectedRoute element={Training} />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
