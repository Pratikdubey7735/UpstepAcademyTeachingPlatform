// context/AuthContext.js - Enhanced version with missing utility functions
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { io } from "socket.io-client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentCoach, setCurrentCoach] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [logoutReason, setLogoutReason] = useState(null);

  // Enhanced logout function with reason tracking
  const logout = useCallback((reason = null) => {
    console.log(`[AuthContext] Logging out${reason ? ` - Reason: ${reason}` : ''}`);

    setIsLoggedIn(false);
    setCurrentCoach(null);
    setConnectionStatus("disconnected");
    setLastUpdate(null);
    setLogoutReason(reason);

    // Clear storage
    sessionStorage.removeItem("coach");
    sessionStorage.removeItem("userLevel");

    // Disconnect socket
    if (socket) {
      if (socket.cleanup) {
        socket.cleanup();
      }
      socket.disconnect();
      setSocket(null);
    }

    // Trigger logout event with reason
    window.dispatchEvent(
      new CustomEvent("coachLoggedOut", {
        detail: { 
          reason: reason,
          timestamp: new Date().toISOString() 
        },
      })
    );

    console.log(`[AuthContext] Logout completed`);
  }, [socket]);

  // Check connection status
  const checkConnection = useCallback(() => {
    return socket && socket.connected && connectionStatus === "connected";
  }, [socket, connectionStatus]);

  // Get connection information
  const getConnectionInfo = useCallback(() => {
    return {
      socketId: socket?.id || null,
      connected: socket?.connected || false,
      connectionStatus,
      lastUpdate,
      serverUrl: socket?.io?.uri || null,
      transportType: socket?.io?.engine?.transport?.name || null,
      reconnectionAttempts: socket?.io?.reconnectionAttempts || 0,
    };
  }, [socket, connectionStatus, lastUpdate]);

  // Refresh user data from server
  const refreshUserData = useCallback(async () => {
    if (!currentCoach?._id) {
      console.warn("[AuthContext] Cannot refresh user data: No current coach");
      return null;
    }

    try {
      console.log(`[AuthContext] Refreshing user data for coach: ${currentCoach._id}`);
      
      const response = await fetch(
        `${"http://localhost:5000"}/api/coaches/${currentCoach._id}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to refresh user data: ${response.status}`);
      }

      const data = await response.json();
      const updatedCoach = data.data || data.coach || data;

      if (updatedCoach && updatedCoach._id) {
        setCurrentCoach(updatedCoach);
        sessionStorage.setItem("coach", JSON.stringify(updatedCoach));
        sessionStorage.setItem("userLevel", updatedCoach.level || "");
        setLastUpdate(new Date().toISOString());

        console.log(`[AuthContext] User data refreshed successfully`);
        return updatedCoach;
      } else {
        throw new Error("Invalid user data received from server");
      }
    } catch (error) {
      console.error("[AuthContext] Failed to refresh user data:", error);
      return null;
    }
  }, [currentCoach]);

  // Force reconnect socket
  const reconnectSocket = useCallback(() => {
    if (!currentCoach?._id) {
      console.warn("[AuthContext] Cannot reconnect: No current coach");
      return;
    }

    console.log("[AuthContext] Force reconnecting socket...");
    
    if (socket) {
      socket.disconnect();
    }
    
    // Small delay before reconnecting
    setTimeout(() => {
      initSocket(currentCoach._id);
    }, 1000);
  }, [currentCoach, socket]);

  // Initialize socket connection
  const initSocket = useCallback(
    (userId) => {
      try {
        console.log(`[AuthContext] Initializing socket for user: ${userId}`);

        // Disconnect existing socket if any
        if (socket) {
          socket.disconnect();
        }

        const serverUrl = "http://localhost:5000";
        console.log(`[AuthContext] Connecting to server: ${serverUrl}`);

        const newSocket = io(serverUrl, {
          withCredentials: true,
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          maxReconnectionAttempts: 5,
          timeout: 20000,
          forceNew: true,
        });

        // Set up event listeners
        newSocket.on("connect", () => {
          console.log(`[AuthContext] Socket connected: ${newSocket.id}`);
          setConnectionStatus("connected");
          newSocket.emit("identify", userId);
        });

        newSocket.on("identification-confirmed", (payload) => {
          console.log(`[AuthContext] Identification confirmed:`, payload);
          setConnectionStatus("connected");
        });

        newSocket.on("disconnect", (reason) => {
          console.log(`[AuthContext] Socket disconnected: ${reason}`);
          setConnectionStatus("disconnected");
        });

        newSocket.on("connect_error", (error) => {
          console.error(`[AuthContext] Socket connection error:`, error);
          setConnectionStatus("error");
        });

        newSocket.on("reconnecting", (attemptNumber) => {
          console.log(`[AuthContext] Socket reconnecting, attempt: ${attemptNumber}`);
          setConnectionStatus("reconnecting");
        });

        newSocket.on("reconnect", (attemptNumber) => {
          console.log(`[AuthContext] Socket reconnected after ${attemptNumber} attempts`);
          setConnectionStatus("connected");
          newSocket.emit("identify", userId);
        });

        // Handle force logout events
        newSocket.on("force-logout", (payload) => {
          console.warn(`[AuthContext] Force logout received:`, payload);
          
          // Show notification if available
          if (window.Notification && Notification.permission === "granted") {
            new Notification("Account Status Changed", {
              body: payload.reason || "You have been logged out by an administrator.",
              icon: "/favicon.ico",
            });
          }
          
          // Logout with reason
          logout(payload.reason || "Account status changed");
          
          // Redirect to login page
          setTimeout(() => {
            window.location.href = "/login";
          }, 1000);
        });

        // Listen for user-specific updates
        newSocket.on("user-updated", (payload) => {
          const userId = currentCoach?._id;

          if (payload.userId === userId && payload.updatedData) {
            const updatedCoach = payload.updatedData;

            // Enhanced logout logic for status changes
            const logoutStatuses = ["inactive", "suspended", "pending"];
            if (updatedCoach.status && logoutStatuses.includes(updatedCoach.status.toLowerCase())) {
              const reason = `Account status changed to ${updatedCoach.status}`;
              console.warn(`[AuthContext] ${reason}. Logging out.`);

              // Show notification
              if (window.Notification && Notification.permission === "granted") {
                new Notification("Account Status Changed", {
                  body: `Your account status has been changed to ${updatedCoach.status}. You will be logged out.`,
                  icon: "/favicon.ico",
                });
              }

              // Logout with reason
              logout(reason);

              // Redirect after a short delay
              setTimeout(() => {
                window.location.href = "/login";
              }, 2000);

              return; // Stop further execution
            }

            // Otherwise, update coach info
            setCurrentCoach(updatedCoach);
            sessionStorage.setItem("coach", JSON.stringify(updatedCoach));
            sessionStorage.setItem("userLevel", updatedCoach.level || "");
            setLastUpdate(new Date().toISOString());

            // Show update notification
            if (window.Notification && Notification.permission === "granted") {
              new Notification("Profile Updated", {
                body: "Your profile has been updated by an administrator.",
                icon: "/favicon.ico",
              });
            }

            console.log(`[AuthContext] Coach data updated in real-time`);

            // Dispatch custom event
            window.dispatchEvent(
              new CustomEvent("coachDataUpdated", {
                detail: { updatedCoach, timestamp: new Date().toISOString() },
              })
            );
          }
        });

        // Listen for level-specific updates
        newSocket.on("level-updated", (payload) => {
          console.log(`[AuthContext] Received level update:`, payload);

          if (payload.userId === userId) {
            const updatedCoach = payload.updatedData;

            setCurrentCoach(updatedCoach);
            sessionStorage.setItem("coach", JSON.stringify(updatedCoach));
            sessionStorage.setItem("userLevel", payload.newLevel || "");
            setLastUpdate(new Date().toISOString());

            if (window.Notification && Notification.permission === "granted") {
              new Notification("Level Updated", {
                body: `Your teaching level has been updated to: ${payload.newLevel}`,
                icon: "/favicon.ico",
              });
            }

            window.dispatchEvent(
              new CustomEvent("levelUpdated", {
                detail: {
                  newLevel: payload.newLevel,
                  updatedCoach,
                  timestamp: new Date().toISOString(),
                },
              })
            );
          }
        });

        // Other existing socket events...
        newSocket.on("coach-data-updated", (payload) => {
          console.log(`[AuthContext] Received fresh coach data:`, payload);
          if (payload.userId === userId && payload.coachData) {
            setCurrentCoach(payload.coachData);
            sessionStorage.setItem("coach", JSON.stringify(payload.coachData));
            sessionStorage.setItem("userLevel", payload.coachData.level || "");
            setLastUpdate(new Date().toISOString());
          }
        });

        newSocket.on("global-update", (payload) => {
          console.log(`[AuthContext] Received global update:`, payload);
          if (window.Notification && Notification.permission === "granted") {
            new Notification("System Update", {
              body: payload.message || "System announcement",
              icon: "/favicon.ico",
            });
          }
          window.dispatchEvent(new CustomEvent("globalUpdate", { detail: payload }));
        });

        // Keep connection alive
        const pingInterval = setInterval(() => {
          if (newSocket.connected) {
            newSocket.emit("ping");
          }
        }, 30000);

        newSocket.on("pong", (payload) => {
          console.log(`[AuthContext] Pong received:`, payload?.timestamp);
        });

        newSocket.cleanup = () => {
          clearInterval(pingInterval);
        };

        setSocket(newSocket);
      } catch (error) {
        console.error(`[AuthContext] Error initializing socket:`, error);
        setConnectionStatus("error");
      }
    },
    [socket, currentCoach, logout]
  );

  // Enhanced login function
  const login = useCallback(
    (coachData) => {
      try {
        if (!coachData || !coachData._id) {
          throw new Error("Invalid coach data provided");
        }

        // Check if coach status allows login
        const allowedStatuses = ['active'];
        if (coachData.status && !allowedStatuses.includes(coachData.status.toLowerCase())) {
          throw new Error(`Cannot login: Account status is ${coachData.status}`);
        }

        console.log(`[AuthContext] Logging in coach:`, coachData._id);

        setIsLoggedIn(true);
        setCurrentCoach(coachData);
        setLogoutReason(null); // Clear any previous logout reason
        sessionStorage.setItem("coach", JSON.stringify(coachData));
        sessionStorage.setItem("userLevel", coachData.level || "");

        if (!socket || !socket.connected) {
          initSocket(coachData._id);
        }

        window.dispatchEvent(
          new CustomEvent("coachLoggedIn", {
            detail: { coachData, timestamp: new Date().toISOString() },
          })
        );

        console.log(`[AuthContext] Login successful for coach: ${coachData.name || coachData.email}`);
      } catch (error) {
        console.error("[AuthContext] Login error:", error);
        logout();
        throw error;
      }
    },
    [socket, initSocket, logout]
  );

  // Initialize on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsInitializing(true);
        const storedCoach = sessionStorage.getItem("coach");

        if (storedCoach) {
          const parsedCoach = JSON.parse(storedCoach);

          if (parsedCoach && parsedCoach._id) {
            // Check if stored coach has valid status
            const allowedStatuses = ['active'];
            if (parsedCoach.status && !allowedStatuses.includes(parsedCoach.status.toLowerCase())) {
              console.warn(`[AuthContext] Stored coach has invalid status: ${parsedCoach.status}`);
              logout(`Stored account status: ${parsedCoach.status}`);
              return;
            }

            console.log(`[AuthContext] Restoring session for coach:`, parsedCoach._id);
            setIsLoggedIn(true);
            setCurrentCoach(parsedCoach);

            // Verify with server
            try {
              const response = await fetch(
                `${"http://localhost:5000"}/api/verify-coach`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ userId: parsedCoach._id }),
                }
              );

              if (response.ok) {
                const verificationData = await response.json();
                console.log(`[AuthContext] Coach verification successful:`, verificationData);
              }
            } catch (verifyError) {
              console.warn(`[AuthContext] Coach verification failed:`, verifyError);
            }

            initSocket(parsedCoach._id);

            if (window.Notification && Notification.permission === "default") {
              Notification.requestPermission();
            }
          } else {
            throw new Error("Invalid coach data structure");
          }
        }
      } catch (error) {
        console.error("Failed to initialize auth or parse stored coach data", error);
        logout("Session initialization failed");
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();

    return () => {
      if (socket) {
        if (socket.cleanup) {
          socket.cleanup();
        }
        socket.disconnect();
      }
    };
  }, []);

  // Context value with all required functions
  const contextValue = {
    // Auth state
    isLoggedIn,
    currentCoach,
    isInitializing,
    logoutReason,

    // Connection state
    connectionStatus,
    lastUpdate,
    socket,

    // Auth functions
    login,
    logout,

    // Utility functions - These were missing!
    checkConnection,
    getConnectionInfo,
    refreshUserData,
    reconnectSocket,

    // Convenience properties
    isConnected: socket && socket.connected,
    userLevel: currentCoach?.level,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};