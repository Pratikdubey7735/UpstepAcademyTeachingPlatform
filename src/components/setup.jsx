import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
// Lazy load components
const FEN = lazy(() => import("./FEN"));
const NOTFEN = lazy(() => import("./NOTFEN"));
// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);
const Upload = () => {
  const [pgnFiles, setPgnFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [level, setLevel] = useState("");
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [category, setCategory] = useState("Beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [fileCache, setFileCache] = useState({});
  const [eventCache, setEventCache] = useState({});
  const [userLevel, setUserLevel] = useState("");
  const [allowedCategories, setAllowedCategories] = useState([]);

  const navigate = useNavigate();

  // Define category hierarchy
  const categoryHierarchy = [
    "Beginner",
    "AdvancedBeginner",
    "Intermediate",
    "AdvancedPart1",
    "AdvancedPart2",
    "SubJunior",
    "Junior",
    "SeniorPart1",
    "SeniorPart2",
  ];

  // Get user level and set allowed categories on component mount
  useEffect(() => {
    const storedUserLevel = sessionStorage.getItem("userLevel");
    console.log("User level from sessionStorage:", storedUserLevel);

    if (storedUserLevel) {
      setUserLevel(storedUserLevel);

      // Find the index of user's level in hierarchy
      const userLevelIndex = categoryHierarchy.findIndex(
        (cat) => cat === storedUserLevel
      );

      if (userLevelIndex !== -1) {
        // Allow categories from start up to user's level (inclusive)
        const allowed = categoryHierarchy.slice(0, userLevelIndex + 1);
        setAllowedCategories(allowed);
        console.log("Allowed categories:", allowed);
      } else {
        // If user level not found in hierarchy, default to just Beginner
        setAllowedCategories(["Beginner"]);
        console.log(
          "User level not found in hierarchy, defaulting to Beginner only"
        );
      }
    } else {
      // If no user level stored, default to just Beginner
      setAllowedCategories(["Beginner"]);
      console.log("No user level found, defaulting to Beginner only");
    }
  }, []);

  // Fetch files with caching and abort controller
  useEffect(() => {
    if (!level) return;

    // Check cache first
    if (fileCache[level]) {
      setPgnFiles(fileCache[level]);
      return;
    }

    // Setup abort controller for cleanup
    const controller = new AbortController();
    const signal = controller.signal;

    setIsLoading(true);

    console.log(
      `Fetching PGN files from: http://localhost:5000/api/pgn-files?level=${level}`
    );
    fetch(`http://localhost:5000/api/pgn-files?level=${level}`, { signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setPgnFiles(data);
          // Update cache
          setFileCache((prev) => ({ ...prev, [level]: data }));
        } else {
          console.error("Expected an array from the response:", data);
          setPgnFiles([]);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error fetching PGN files:", error);
          setPgnFiles([]);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Cleanup function to abort fetch on unmount or level change
    return () => controller.abort();
  }, [level, fileCache]);

  const goToDemo = () => {
    navigate("/demo");
  };

  const handleFileSelect = useCallback(
    (event) => {
      const selectedUrl = event.target.value;
      setSelectedFile(selectedUrl);

      if (!selectedUrl) {
        setEvents([]);
        return;
      }

      // Check cache for this file
      if (eventCache[selectedUrl]) {
        setEvents(eventCache[selectedUrl]);
        setCurrentIndex(0);
        return;
      }

      setIsLoading(true);

      fetch(selectedUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then((content) => {
          const parsedEvents = parsePGN(content);
          setEvents(parsedEvents);
          setCurrentIndex(0);
          // Cache the parsed events
          setEventCache((prev) => ({ ...prev, [selectedUrl]: parsedEvents }));
        })
        .catch((error) => {
          console.error("Error loading PGN file:", error);
          setEvents([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [eventCache]
  );

  const parsePGN = (content) => {
    const regex = /(?=\[Event\s)/g;
    return content
      .split(regex)
      .filter((event) => event.trim())
      .map((event) => event.trim());
  };

  const handleLevelSelect = useCallback((selectedLevel, label) => {
    setLevel(selectedLevel);
    setSelectedLabel(label);
    setSelectedFile("");
    setEvents([]);
    setCurrentIndex(0);
    setExpandedLevel(null); // Close dropdown on selection
  }, []);

  const levels = {
    Beginner: [
      { value: "BeginnerClassworkPGN", label: "Classwork" },
      { value: "BeginnerHomeworkPGN", label: "Homework" },
    ],
    AdvancedBeginner: [
      { value: "AdvBegClass", label: "Classwork" },
      { value: "AdvBegHome", label: "Homework" },
    ],
    Intermediate: [
      { value: "InterClass", label: "Classwork" },
      { value: "InterHome", label: "Homework" },
    ],
    AdvancedPart1: [
      { value: "AdvanPart1Class", label: "Classwork" },
      { value: "AdvanPart1Home", label: "Homework" },
    ],
    AdvancedPart2: [
      { value: "AdvancePart2Class", label: "Classwork" },
      { value: "AdvPart2Home", label: "Homework" },
    ],
    Junior: [
      // Classwork options
      { value: "Jr1C", label: "Jr1 Classwork" },
      { value: "Jr2C", label: "Jr2 Classwork" },
      { value: "Jr3C", label: "Jr3 Classwork" },
      { value: "Jr4C", label: "Jr4 Classwork" },
      { value: "Jr5C", label: "Jr5 Classwork" },
      { value: "Jr6C", label: "Jr6 Classwork" },
      // Homework options
      { value: "Jr1H", label: "Jr1 Homework" },
      { value: "Jr2H", label: "Jr2 Homework" },
      { value: "Jr3H", label: "Jr3 Homework" },
      { value: "Jr4H", label: "Jr4 Homework" },
      { value: "Jr5H", label: "Jr5 Homework" },
      { value: "Jr6H", label: "Jr6 Homework" },
    ],
    SubJunior: [
      // Classwork options
      { value: "SubJr1C", label: "SJr1 Classwork" },
      { value: "SubJr2C", label: "SJr2 Classwork" },
      { value: "SubJr3C", label: "SJr3 Classwork" },
      { value: "SubJr4C", label: "SJr4 Classwork" },
      { value: "SubJr5C", label: "SJr5 Classwork" },
      { value: "SubJr6C", label: "SJr6 Classwork" },
      // Homework options
      { value: "SubJr1H", label: "SJr1 Homework" },
      { value: "SubJr2H", label: "SJr2 Homework" },
      { value: "SubJr3H", label: "SJr3 Homework" },
      { value: "SubJr4H", label: "SJr4 Homework" },
      { value: "SubJr5H", label: "SJr5 Homework" },
      { value: "SubJr6H", label: "SJr6 Homework" },
    ],
    SeniorPart1: [
      // Classwork options
      { value: "Sr1C", label: "Sr1 Classwork" },
      { value: "Sr2C", label: "Sr2 Classwork" },
      { value: "Sr3C", label: "Sr3 Classwork" },
      { value: "Sr4C", label: "Sr4 Classwork" },
      { value: "Sr5C", label: "Sr5 Classwork" },
      { value: "Sr6C", label: "Sr6 Classwork" },
      // Homework options
      { value: "Sr1H", label: "Sr1 Homework" },
      { value: "Sr2H", label: "Sr2 Homework" },
      { value: "Sr3H", label: "Sr3 Homework" },
      { value: "Sr4H", label: "Sr4 Homework" },
      { value: "Sr5H", label: "Sr5 Homework" },
      { value: "Sr6H", label: "Sr6 Homework" },
    ],
    SeniorPart2: [
      // Classwork options
      { value: "Sr7C", label: "Sr7 Classwork" },
      { value: "Sr8C", label: "Sr8 Classwork" },
      { value: "Sr9C", label: "Sr9 Classwork" },
      { value: "Sr10C", label: "Sr10 Classwork" },
      { value: "Sr11C", label: "Sr11 Classwork" },
      { value: "Sr12C", label: "Sr12 Classwork" },
      // Homework options
      { value: "Sr7H", label: "Sr7 Homework" },
      { value: "Sr8H", label: "Sr8 Homework" },
      { value: "Sr9H", label: "Sr9 Homework" },
      { value: "Sr10H", label: "Sr10 Homework" },
      { value: "Sr11H", label: "Sr11 Homework" },
      { value: "Sr12H", label: "Sr12 Homework" },
    ],
  };

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, events.length - 1));
  }, [events.length]);

  // Fixed keyboard navigation - now works in both fullscreen and half-screen
  const handleKeyDown = useCallback(
    (event) => {
      // Only handle navigation if we have events loaded
      if (events.length === 0) return;

      if (event.key === "A") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "B") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "F11") {
        event.preventDefault();
        if (event.ctrlKey) {
          handlePrevious();
        } else {
          handleNext();
        }
      } else if (event.key === "Escape") {
        setIsFullscreen(false);
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err) => console.error(err));
        }
      }
    },
    [handleNext, handlePrevious, events.length]
  );

  // Fixed: Add keyboard event listener regardless of fullscreen state
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const toggleFullscreen = useCallback(() => {
    // Check if there are events loaded
    if (!events.length) {
      alert("Please select a chapter first before entering fullscreen mode");
      return;
    }

    if (!isFullscreen) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error(err));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error(err));
    }
  }, [isFullscreen, events]);

  // Memoize the filtered levels calculation
  const filteredLevels = React.useMemo(() => {
    return levels[category] || [];
  }, [category]);

  // Prefetch category data when hovering over category buttons
  const handleCategoryHover = useCallback(
    (cat) => {
      const levelOptions = levels[cat] || [];

      // For each level option in this category, prefetch if not cached
      levelOptions.forEach(({ value }) => {
        if (!fileCache[value]) {
          const prefetchController = new AbortController();

          // Low priority fetch that can be aborted
          fetch(`http://localhost:5000/api/pgn-files?level=${value}`, {
            signal: prefetchController.signal,
          })
            .then((response) => response.json())
            .then((data) => {
              if (Array.isArray(data)) {
                setFileCache((prev) => ({ ...prev, [value]: data }));
              }
            })
            .catch(() => {
              // Ignore prefetch errors
            });

          // Abort prefetch after 5 seconds if not completed
          setTimeout(() => prefetchController.abort(), 5000);
        }
      });
    },
    [fileCache]
  );

  return (
    <div
      className={`min-h-screen bg-gray-200 p-6 ${
        isFullscreen ? "fullscreen" : ""
      }`}
    >
      {isFullscreen ? (
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="bg-white p-6 rounded-lg shadow-lg mb-6 w-full h-full flex items-center justify-center">
            {events[currentIndex] && (
              <Suspense fallback={<LoadingSpinner />}>
                {events[currentIndex].includes("FEN") ? (
                  <FEN event={events[currentIndex]} />
                ) : (
                  <NOTFEN event={events[currentIndex]} />
                )}
              </Suspense>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="bg-white p-6 rounded-lg shadow-lg mb-6 w-full">
            {/* Display user level info */}
            {userLevel && <></>}
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Select Category
            </h2>
            <div className="flex flex-wrap gap-4 mb-4">
              {allowedCategories.map((cat) => (
                <a
                  href={`/category/${cat}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={cat}
                  onClick={(e) => {
                    e.preventDefault();
                    setCategory(cat);
                  }}
                  onMouseEnter={() => handleCategoryHover(cat)}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                  }}
                  className={`w-40 p-3 bg-gray-800 text-white rounded-md shadow-md transition-transform duration-200 ease-in-out hover:bg-green-600 focus:outline-none focus:ring focus:ring-pink-300 ${
                    category === cat ? "bg-green-500" : ""
                  }`}
                >
                  {cat.replace(/([A-Z])/g, " $1")}
                </a>
              ))}
            </div>
            {/* Show message if no allowed categories */}
            {allowedCategories.length === 0 && (
              <div className="mb-4 p-3 bg-yellow-100 rounded-md">
                <p className="text-yellow-800">
                  Loading your available categories...
                </p>
              </div>
            )}

            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Select Level
            </h2>
            {/* Check if current category needs dropdown format */}
            {["SubJunior", "Junior", "SeniorPart1", "SeniorPart2"].includes(
              category
            ) ? (
              <div className="grid grid-cols-2 gap-6 mb-4">
                {/* Classwork Column */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setExpandedLevel(
                        expandedLevel === "classwork" ? null : "classwork"
                      )
                    }
                    className="w-full p-3 bg-gray-800 text-white rounded-md shadow-md hover:bg-green-600 focus:outline-none focus:ring focus:ring-pink-300 flex justify-between items-center"
                  >
                    <span>Classwork</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        expandedLevel === "classwork" ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {expandedLevel === "classwork" && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 mt-1">
                      {filteredLevels
                        .filter(({ label }) => label.includes("Classwork"))
                        .map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={(e) => {
                              e.preventDefault();
                              handleLevelSelect(
                                value,
                                `${category} - ${label}`
                              );
                            }}
                            className={`w-full p-3 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 border-b border-gray-200 last:border-b-0 ${
                              selectedLabel.includes(label)
                                ? "bg-green-100 text-green-800"
                                : "text-gray-800"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Homework Column */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setExpandedLevel(
                        expandedLevel === "homework" ? null : "homework"
                      )
                    }
                    className="w-full p-3 bg-gray-800 text-white rounded-md shadow-md hover:bg-green-600 focus:outline-none focus:ring focus:ring-pink-300 flex justify-between items-center"
                  >
                    <span>Homework</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        expandedLevel === "homework" ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {expandedLevel === "homework" && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 mt-1">
                      {filteredLevels
                        .filter(({ label }) => label.includes("Homework"))
                        .map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={(e) => {
                              e.preventDefault();
                              handleLevelSelect(
                                value,
                                `${category} - ${label}`
                              );
                            }}
                            className={`w-full p-3 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 border-b border-gray-200 last:border-b-0 ${
                              selectedLabel.includes(label)
                                ? "bg-green-100 text-green-800"
                                : "text-gray-800"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Original button layout for other categories (Beginner, AdvancedBeginner, etc.)
              <div className="grid grid-cols-2 gap-6 mb-4">
                {filteredLevels.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={(e) => {
                      e.preventDefault();
                      handleLevelSelect(value, `${category} - ${label}`);
                    }}
                    className={`w-full p-3 text-white rounded-md shadow-md transition-transform duration-200 ease-in-out hover:bg-green-600 focus:outline-none focus:ring focus:ring-pink-300 ${
                      selectedLabel.includes(label)
                        ? "bg-green-500"
                        : "bg-gray-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Select Chapter
            </h2>
            {isLoading && level && !pgnFiles.length ? (
              <LoadingSpinner />
            ) : (
              <select
                onChange={handleFileSelect}
                value={selectedFile}
                className="w-full p-3 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring focus:ring-blue-300"
                disabled={!pgnFiles.length}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                }}
              >
                <option value="">-- Select a PGN File --</option>
                {pgnFiles.map((file) => (
                  <option key={file.filename} value={file.url}>
                    {file.filename}
                  </option>
                ))}
              </select>
            )}
            <div className="mb-6 w-full min-h-64">
              {isLoading && selectedFile && !events.length ? (
                <LoadingSpinner />
              ) : (
                events[currentIndex] && (
                  <Suspense fallback={<LoadingSpinner />}>
                    {events[currentIndex].includes("FEN") ? (
                      <FEN event={events[currentIndex]} />
                    ) : (
                      <NOTFEN event={events[currentIndex]} />
                    )}
                  </Suspense>
                )
              )}
            </div>
          </div>
        </div>
      )}
      {!isFullscreen && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={toggleFullscreen}
            disabled={!events.length}
            className={`mt-4 p-3 rounded-md ${
              events.length
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            } text-white focus:outline-none focus:ring focus:ring-green-300`}
          >
            {events.length ? "Enter Fullscreen" : "Select a Chapter First"}
          </button>
          <button
            onClick={goToDemo}
            className="mt-4 p-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-300"
          >
            DEMO
          </button>
        </div>
      )}
    </div>
  );
};

export default Upload;
