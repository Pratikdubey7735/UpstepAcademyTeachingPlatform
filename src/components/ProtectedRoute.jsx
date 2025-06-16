// components/ProtectedRoute.jsx

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ element: Component }) => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Component />;
};

export default ProtectedRoute;
