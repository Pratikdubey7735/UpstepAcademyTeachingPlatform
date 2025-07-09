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
    "SeniorPart2"
  ];

  // Get user level and set allowed categories on component mount
  useEffect(() => {
    const storedUserLevel = sessionStorage.getItem("userLevel");
    console.log("User level from sessionStorage:", storedUserLevel);
    
    if (storedUserLevel) {
      setUserLevel(storedUserLevel);
      
      // Find the index of user's level in hierarchy
      const userLevelIndex = categoryHierarchy.findIndex(cat => cat === storedUserLevel);
      
      if (userLevelIndex !== -1) {
        // Allow categories from start up to user's level (inclusive)
        const allowed = categoryHierarchy.slice(0, userLevelIndex + 1);
        setAllowedCategories(allowed);
        console.log("Allowed categories:", allowed);
      } else {
        // If user level not found in hierarchy, default to just Beginner
        setAllowedCategories(["Beginner"]);
        console.log("User level not found in hierarchy, defaulting to Beginner only");
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
      `Fetching PGN files from: https://backendteachingplatform.onrender.com/api/pgn-files?level=${level}`
    );
    fetch(
      `https://backendteachingplatform.onrender.com/api/pgn-files?level=${level}`,
      { signal }
    )
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
    BeginnerClasswork: [{ value: "BeginnerClassworkPGN", label: "Classwork" }],
    BeginnerHomework: [{ value: "BeginnerHomeworkPGN", label: "Homework" }],
    AdvancedBeginnerClasswork: [{ value: "AdvBegClass", label: "Classwork" }],
    AdvancedBeginnerHomework: [{ value: "AdvBegHome", label: "Homework" }],
    IntermediateClasswork: [{ value: "InterClass", label: "Classwork" }],
    IntermediateHomework: [{ value: "InterHome", label: "Homework" }],
    AdvancedPart1Classwork: [{ value: "AdvanPart1Class", label: "Classwork" }],
    AdvancedPart1Homework: [{ value: "AdvanPart1Home", label: "Homework" }],
    AdvancedPart2Classwork: [
      { value: "AdvancePart2Class", label: "Classwork" },
    ],
    AdvancedPart2Homework: [{ value: "AdvPart2Home", label: "Homework" }],
    Junior_Classwork: [
      { value: "Jr1C", label: "Jr1" },
      { value: "Jr2C", label: "Jr2" },
      { value: "Jr3C", label: "Jr3" },
      { value: "Jr4C", label: "Jr4" },
      { value: "Jr5C", label: "Jr5" },
      { value: "Jr6C", label: "Jr6" },
    ],
    Junior_Homework: [
      { value: "Jr1H", label: "Jr1" },
      { value: "Jr2H", label: "Jr2" },
      { value: "Jr3H", label: "Jr3" },
      { value: "Jr4H", label: "Jr4" },
      { value: "Jr5H", label: "Jr5" },
      { value: "Jr6H", label: "Jr6" },
    ],
    Sub_Junior_Classwork: [
      { value: "SubJr1C", label: "SJr1" },
      { value: "SubJr2C", label: "SJr2" },
      { value: "SubJr3C", label: "SJr3" },
      { value: "SubJr4C", label: "SJr4" },
      { value: "SubJr5C", label: "SJr5" },
      { value: "SubJr6C", label: "SJr6" },
    ],
    Sub_Junior_Homework: [
      { value: "SubJr1H", label: "SJr1" },
      { value: "SubJr2H", label: "SJr2" },
      { value: "SubJr3H", label: "SJr3" },
      { value: "SubJr4H", label: "SJr4" },
      { value: "SubJr5H", label: "SJr5" },
      { value: "SubJr6H", label: "SJr6" },
    ],
    Senior_Part1_Classwork: [
      { value: "Sr1C", label: "Sr1" },
      { value: "Sr2C", label: "Sr2" },
      { value: "Sr3C", label: "Sr3" },
      { value: "Sr4C", label: "Sr4" },
      { value: "Sr5C", label: "Sr5" },
      { value: "Sr6C", label: "Sr6" },
    ],
    Senior_Part1_Homework: [
      { value: "Sr1H", label: "Sr1" },
      { value: "Sr2H", label: "Sr2" },
      { value: "Sr3H", label: "Sr3" },
      { value: "Sr4H", label: "Sr4" },
      { value: "Sr5H", label: "Sr5" },
      { value: "Sr6H", label: "Sr6" },
    ],
    Senior_Part2_Classwork: [
      { value: "Sr7C", label: "Sr7" },
      { value: "Sr8C", label: "Sr8" },
      { value: "Sr9C", label: "Sr9" },
      { value: "Sr10C", label: "Sr10" },
      { value: "Sr11C", label: "Sr11" },
      { value: "Sr12C", label: "Sr12" },
    ],
    Senior_Part2_Homework: [
      { value: "Sr7H", label: "Sr7" },
      { value: "Sr8H", label: "Sr8" },
      { value: "Sr9H", label: "Sr9" },
      { value: "Sr10H", label: "Sr10" },
      { value: "Sr11H", label: "Sr11" },
      { value: "Sr12H", label: "Sr12" },
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

      if (event.key === "ArrowUp") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "ArrowDown") {
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
    return category === "Beginner"
      ? ["BeginnerClasswork", "BeginnerHomework"]
      : category === "AdvancedBeginner"
      ? ["AdvancedBeginnerClasswork", "AdvancedBeginnerHomework"]
      : category === "Intermediate"
      ? ["IntermediateClasswork", "IntermediateHomework"]
      : category === "AdvancedPart1"
      ? ["AdvancedPart1Classwork", "AdvancedPart1Homework"]
      : category === "AdvancedPart2"
      ? ["AdvancedPart2Classwork", "AdvancedPart2Homework"]
      : category === "Junior"
      ? ["Junior_Classwork", "Junior_Homework"]
      : category === "SubJunior"
      ? ["Sub_Junior_Classwork", "Sub_Junior_Homework"]
      : category === "SeniorPart2"
      ? ["Senior_Part2_Classwork", "Senior_Part2_Homework"]
      : ["Senior_Part1_Classwork", "Senior_Part1_Homework"];
  }, [category]);

  // Prefetch category data when hovering over category buttons
  const handleCategoryHover = useCallback(
    (cat) => {
      const levelsForCategory =
        cat === "Beginner"
          ? ["BeginnerClasswork", "BeginnerHomework"]
          : cat === "AdvancedBeginner"
          ? ["AdvancedBeginnerClasswork", "AdvancedBeginnerHomework"]
          : cat === "Intermediate"
          ? ["IntermediateClasswork", "IntermediateHomework"]
          : cat === "AdvancedPart1"
          ? ["AdvancedPart1Classwork", "AdvancedPart1Homework"]
          : cat === "AdvancedPart2"
          ? ["AdvancedPart2Classwork", "AdvancedPart2Homework"]
          : cat === "Junior"
          ? ["Junior_Classwork", "Junior_Homework"]
          : cat === "SubJunior"
          ? ["Sub_Junior_Classwork", "Sub_Junior_Homework"]
          : cat === "SeniorPart2"
          ? ["Senior_Part2_Classwork", "Senior_Part2_Homework"]
          : ["Senior_Part1_Classwork", "Senior_Part1_Homework"];

      // For each level in this category, look at the first option
      levelsForCategory.forEach((levelName) => {
        const levelOptions = levels[levelName] || [];
        if (levelOptions.length > 0) {
          const value = levelOptions[0].value;

          // If we don't have this level cached, prefetch it
          if (!fileCache[value]) {
            const prefetchController = new AbortController();

            // Low priority fetch that can be aborted
            fetch(
              `https://backendteachingplatform.onrender.com/api/pgn-files?level=${value}`,
              { signal: prefetchController.signal }
            )
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
        }
      });
    },
    [fileCache, levels]
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
            {userLevel && (
             <></>
            )}

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
            <div className="flex flex-wrap gap-4 mb-4">
              {filteredLevels.map((levelName) => {
                const levelOptions = levels[levelName] || [];
                return (
                  <div key={levelName} className="relative">
                    <a
                      href="#"
                      className={`w-45 p-3 bg-gray-800 text-white rounded-md shadow-md transition-transform duration-200 ease-in-out hover:bg-green-600 focus:outline-none focus:ring focus:ring-pink-300 ${
                        selectedLabel.includes(levelName) ? "bg-green-500" : ""
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setExpandedLevel(
                          expandedLevel === levelName ? null : levelName
                        );
                      }}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {levelName}
                    </a>
                    {expandedLevel === levelName && (
                      <div className="absolute bg-white border border-gray-300 rounded-md shadow-lg z-10 mt-1 w-full">
                        {levelOptions.map(({ value, label }) => (
                          <a
                            href={`/level/${value}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              handleLevelSelect(
                                value,
                                `${levelName} - ${label}`
                              );
                            }}
                            className="block w-full text-left p-2 hover:bg-gray-400 focus:outline-none"
                            key={value}
                          >
                            {label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

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