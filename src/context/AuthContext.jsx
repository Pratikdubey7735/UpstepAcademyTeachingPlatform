import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentCoach, setCurrentCoach] = useState(null);

  useEffect(() => {
    // Check sessionStorage for coach data on initial load
    const storedCoach = sessionStorage.getItem("coach");
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
    // Store in sessionStorage instead of localStorage
    sessionStorage.setItem("coach", JSON.stringify(coachData));
    sessionStorage.setItem("userLevel", coachData.level); 
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentCoach(null);
    sessionStorage.removeItem("coach");
    sessionStorage.removeItem("userLevel");
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
