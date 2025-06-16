import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentCoach, setCurrentCoach] = useState(null);

  useEffect(() => {
    // Check localStorage for coach data on initial load
    const storedCoach = localStorage.getItem("coach");
    if (storedCoach) {
      try {
        const parsedCoach = JSON.parse(storedCoach);
        setIsLoggedIn(true);
        setCurrentCoach(parsedCoach);
      } catch (error) {
        console.error("Failed to parse stored coach data", error);
        logout();
      }
    }
  }, []);

  const login = (coachData) => {
    setIsLoggedIn(true);
    setCurrentCoach(coachData);
    // Store the entire coach object (without password) in localStorage
    localStorage.setItem("coach", JSON.stringify(coachData));
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentCoach(null);
    localStorage.removeItem("coach");
    // Optional: You might want to redirect to login page here
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      currentCoach, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);