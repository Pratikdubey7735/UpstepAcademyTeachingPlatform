import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Wifi, WifiOff, AlertCircle, CheckCircle, Loader2, User, Lock, Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext"; 
import { useNavigate } from "react-router-dom";// Adjust path as needed

export default function EnhancedLoginForm() {
  const { 
    isLoggedIn, 
    currentCoach, 
    connectionStatus, 
    isInitializing,
    login, 
    logout, 
    checkConnection,
    getConnectionInfo,
    userLevel
  } = useAuth();
  
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator?.onLine || true);
  const [validationErrors, setValidationErrors] = useState({});
  const [connectionInfo, setConnectionInfo] = useState({});

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update connection info periodically
  useEffect(() => {
    const updateConnectionInfo = () => {
      if (getConnectionInfo) {
        setConnectionInfo(getConnectionInfo());
      }
    };

    updateConnectionInfo();
    const interval = setInterval(updateConnectionInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getConnectionInfo, connectionStatus]);

  // Listen for real-time updates
  useEffect(() => {
    const handleCoachUpdate = (event) => {
      console.log('Coach data updated:', event.detail);
      setSuccessMessage("Your profile was updated in real-time!");
      setTimeout(() => setSuccessMessage(""), 3000);
    };

    const handleLevelUpdate = (event) => {
      console.log('Level updated:', event.detail);
      setSuccessMessage(`Your teaching level was updated to: ${event.detail.newLevel}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    };

    const handleGlobalUpdate = (event) => {
      console.log('Global update received:', event.detail);
      // Handle global announcements/updates
    };

    window.addEventListener('coachDataUpdated', handleCoachUpdate);
    window.addEventListener('levelUpdated', handleLevelUpdate);
    window.addEventListener('globalUpdate', handleGlobalUpdate);

    return () => {
      window.removeEventListener('coachDataUpdated', handleCoachUpdate);
      window.removeEventListener('levelUpdated', handleLevelUpdate);
      window.removeEventListener('globalUpdate', handleGlobalUpdate);
    };
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation errors when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!validateForm()) {
      return;
    }

    if (!isOnline) {
      setErrorMessage("You appear to be offline. Please check your internet connection.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("https://adminbackend-b9bo.onrender.com/api/coaches/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        }),
      });

      const data = await response.json();
      console.log('Login response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}: Login failed`);
      }

      if (!data.data || !data.data._id) {
        throw new Error("Invalid response from server - missing coach data");
      }

      setSuccessMessage("Login successful! Establishing real-time connection...");
      
      // Use the login function from AuthContext
      await login(data.data);
      
      // Give a moment for socket to connect
      setTimeout(() => {
        if (checkConnection()) {
          setSuccessMessage("Login successful! Real-time connection established. Welcome to your teaching dashboard.");
        } else {
          setSuccessMessage("Login successful! Welcome to your dashboard. (Connecting to real-time updates...)");
        }
      }, 1500);

    } catch (error) {
      console.error("Login error:", error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setErrorMessage("Unable to connect to server. Please check your internet connection and try again.");
      } else if (error.message.includes('401') || error.message.includes('Invalid credentials')) {
        setErrorMessage("Invalid email or password. Please check your credentials and try again.");
      } else if (error.message.includes('429')) {
        setErrorMessage("Too many login attempts. Please wait a few minutes and try again.");
      } else if (error.message.includes('500')) {
        setErrorMessage("Server error occurred. Please try again later or contact support.");
      } else {
        setErrorMessage(error.message || "Login failed. Please check your credentials and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Connection status indicator
  const ConnectionStatus = () => {
    const getStatusColor = () => {
      if (!isOnline) return "text-red-500";
      switch (connectionStatus) {
        case 'connected': return "text-green-500";
        case 'connecting': 
        case 'reconnecting': return "text-yellow-500";
        case 'error':
        case 'disconnected': return "text-red-500";
        default: return "text-gray-500";
      }
    };

    const getStatusText = () => {
      if (!isOnline) return "Offline";
      switch (connectionStatus) {
        case 'connected': return "Connected";
        case 'connecting': return "Connecting...";
        case 'reconnecting': return "Reconnecting...";
        case 'error': return "Connection Error";
        case 'disconnected': return "Disconnected";
        default: return "Unknown";
      }
    };

    return (
      <div className={`flex items-center gap-1 text-xs ${getStatusColor()}`}>
        {isOnline && connectionStatus === 'connected' ? (
          <Wifi size={12} />
        ) : (
          <WifiOff size={12} />
        )}
        <span>{getStatusText()}</span>
        {connectionInfo.socketId && (
          <span className="text-gray-400 ml-1">({connectionInfo.socketId.slice(-6)})</span>
        )}
      </div>
    );
  };

  // Show loading screen while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Initializing...</h2>
          <p className="text-white/70">Setting up your teaching platform</p>
        </div>
      </div>
    );
  }

  // Already logged in view
  if (isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
              <p className="text-gray-600 mb-2 font-medium">
                {currentCoach?.name || currentCoach?.email || 'Coach'}
              </p>
              
              {/* Teaching Level Display */}
              {userLevel && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-4">
                  <Activity size={14} />
                  <span>Teaching Level: {userLevel}</span>
                </div>
              )}
              
              {/* Success Message */}
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm text-green-700">{successMessage}</span>
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Navigate to dashboard - replace with your routing logic
                    navigate("/setup");
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg"
                >
                  Go to Teaching Dashboard
                </button>
                
                <button
                  onClick={logout}
                  className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transform hover:scale-[1.02] transition-all duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <ConnectionStatus />
              {connectionStatus === 'connected' && (
                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle size={12} />
                  <span>Real-time updates enabled</span>
                </div>
              )}
              {connectionInfo.lastUpdate && (
                <div className="mt-1 text-xs text-gray-500">
                  Last update: {new Date(connectionInfo.lastUpdate).toLocaleTimeString()}
                </div>
              )}
            </div>
            
            {/* Coach Info */}
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
              <div>Coach ID: {currentCoach?._id?.slice(-8) || 'Unknown'}</div>
              {currentCoach?.email && (
                <div>Email: {currentCoach.email}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to your teaching platform</p>
          </div>

          {/* Connection Status */}
          <div className="mb-4 flex justify-end">
            <ConnectionStatus />
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700">{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{errorMessage}</span>
            </div>
          )}

          {/* Offline Warning */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-700">You are currently offline</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                    validationErrors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                    validationErrors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isOnline}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-[1.02] transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </div>
              ) : (
                "Sign In to Teaching Platform"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Secure login with real-time connection monitoring
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Real-time updates for teaching materials and level assignments
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
