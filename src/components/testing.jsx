import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { HiArrowSmLeft, HiArrowSmRight } from "react-icons/hi";
import { parse } from "pgn-parser";

function FEN({ event }) {
  const [highlightedSquares, setHighlightedSquares] = useState([]);
  const [arrowColor, setArrowColor] = useState("rgba(255, 0, 0, 0.7)");
  const [arrows, setArrows] = useState([]);
  const [currentHighlightColor, setCurrentHighlightColor] = useState(
    "rgba(255, 0, 0, 0.5)"
  );
  const [gameOutcome, setGameOutcome] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [eventTitle, setEventTitle] = useState("");
  const [whitePlayer, setWhitePlayer] = useState("");
  const [blackPlayer, setBlackPlayer] = useState("");
  const [annotator, setAnnotator] = useState("");
  const [specificComment, setSpecificComment] = useState("");
  const [questionVisible, setQuestionVisible] = useState(true);
  const [movesVisible, setMovesVisible] = useState(true);

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [variations, setVariations] = useState({});
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [currentVariationIndex, setCurrentVariationIndex] = useState(null);
  const [isInVariation, setIsInVariation] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [isBlackToMoveStart, setIsBlackToMoveStart] = useState(false);
  const [halfMoveOffset, setHalfMoveOffset] = useState(0);
  const [hasAutoMoved, setHasAutoMoved] = useState(false);
  const [eventKey, setEventKey] = useState("");

  // Track the complete path of nested variations
  const [variationPath, setVariationPath] = useState([]);

  // Add new state for variation prompt
  const [showVariationPrompt, setShowVariationPrompt] = useState(false);
  const [pendingVariationIndex, setPendingVariationIndex] = useState(null);

  // Complete reset of all game state when event changes
  useEffect(() => {
    resetGameState(event);
  }, [event]);

  // Function to completely reset the game state
  const resetGameState = (currentEvent) => {
    // Create a unique key for this event
    const newEventKey = Date.now().toString();
    setEventKey(newEventKey);

    // Reset board state
    setHighlightedSquares([]);
    setArrows([]);
    setSelectedSquare(null);
    setGameOutcome(null);

    // Reset variations and move indices
    setMoves([]);
    setVariations({});
    setCurrentMoveIndex(0);
    setCurrentVariationIndex(null);
    setIsInVariation(false);
    setHasAutoMoved(false);
    setVariationPath([]);

    // Reset variation prompt state
    setShowVariationPrompt(false);
    setPendingVariationIndex(null);

    // Reset board orientation (optional - you may want to keep the current orientation)
    setBoardOrientation("white");

    // Initialize new game with FEN if available
    const newGame = new Chess();
    const fenMatch = currentEvent.match(/FEN \"([^\"]+)\"/);

    if (fenMatch && fenMatch[1]) {
      try {
        newGame.load(fenMatch[1]);

        // Check if Black to move in the starting position
        const blackToMove = fenMatch[1].split(" ")[1] === "b";
        setIsBlackToMoveStart(blackToMove);

        // Reset half move offset
        setHalfMoveOffset(blackToMove ? 1 : 0);
      } catch (error) {
        console.error("Invalid FEN format:", error);
        setIsBlackToMoveStart(false);
        setHalfMoveOffset(0);
      }
    } else {
      setIsBlackToMoveStart(false);
      setHalfMoveOffset(0);
    }

    setGame(newGame);

    // Parse metadata from the event
    parseEventMetadata(currentEvent);

    // Parse PGN moves
    parsePGN(currentEvent);
  };

  // Extract metadata from event
  const parseEventMetadata = (currentEvent) => {
    const titleMatch = currentEvent.match(/\[Event \"([^\"]+)\"\]/);
    if (titleMatch && titleMatch[1]) {
      setEventTitle(titleMatch[1]);
    } else {
      setEventTitle("");
    }

    const whiteMatch = currentEvent.match(/\[White \"([^\"]+)\"\]/);
    if (whiteMatch && whiteMatch[1]) {
      setWhitePlayer(whiteMatch[1]);
    } else {
      setWhitePlayer("");
    }

    const blackMatch = currentEvent.match(/\[Black \"([^\"]+)\"\]/);
    if (blackMatch && blackMatch[1]) {
      setBlackPlayer(blackMatch[1]);
    } else {
      setBlackPlayer("");
    }

    const annotatorMatch = currentEvent.match(/\[Annotator \"([^\"]+)\"\]/);
    if (annotatorMatch && annotatorMatch[1]) {
      setAnnotator(annotatorMatch[1]);
    } else {
      setAnnotator("");
    }

    const specificCommentMatch = currentEvent.replace(/\[[^\]]*\]/g, ""); // Remove all content inside square brackets
    setSpecificComment(specificCommentMatch);
  };

  // Auto-move effect for Black to move positions
  useEffect(() => {
    // Only execute if it's black to move at start and we haven't auto-moved yet
    if (isBlackToMoveStart && !hasAutoMoved && moves.length > 0) {
      // Wait a brief moment for the board to render before executing the move
      const timer = setTimeout(() => {
        handleNextMove();
        setHasAutoMoved(true);
      }, 300); // Short delay to ensure board is ready

      return () => clearTimeout(timer);
    }
  }, [isBlackToMoveStart, moves, hasAutoMoved]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey) {
        setArrowColor("rgba(255, 0, 0, 0.7)");
        setCurrentHighlightColor("rgba(255, 0, 0, 0.5)");
      } else if (event.ctrlKey) {
        setArrowColor("rgba(0, 255, 0, 0.7)");
        setCurrentHighlightColor("rgba(0, 255, 0, 0.5)");
      } else if (event.shiftKey) {
        setArrowColor("rgba(0, 0, 255, 0.7)");
        setCurrentHighlightColor("rgba(0, 0, 255, 0.5)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleKeyNavigation = (event) => {
      // Don't handle arrow keys when variation prompt is showing
      if (showVariationPrompt) return;

      if (event.key === "ArrowRight") {
        handleNextMove();
      } else if (event.key === "ArrowLeft") {
        handlePreviousMove();
      }
    };

    window.addEventListener("keydown", handleKeyNavigation);

    return () => {
      window.removeEventListener("keydown", handleKeyNavigation);
    };
  }, [
    currentMoveIndex,
    isInVariation,
    currentVariationIndex,
    showVariationPrompt,
    variationPath,
  ]);

  const resetHighlights = () => {
    setHighlightedSquares([]);
    setArrows([]);
  };

  const onSquareClick = (square) => {
    setSelectedSquare(square);
    toggleSquareHighlight(square);
  };

  const toggleSquareHighlight = (square) => {
    setHighlightedSquares((prev) => {
      const existingHighlight = prev.find(
        (highlight) => highlight.square === square
      );
      if (existingHighlight) {
        return prev.filter((highlight) => highlight.square !== square);
      }
      return [...prev, { square, color: currentHighlightColor }];
    });
  };

  const renderHighlightedSquares = () => {
    const highlightedStyles = {};
    highlightedSquares.forEach(({ square, color }) => {
      highlightedStyles[square] = {
        backgroundColor: color,
        opacity: 0.5,
      };
    });
    return highlightedStyles;
  };

  const parsePGN = (pgn) => {
    try {
      const parsed = parse(pgn);
      if (parsed.length > 0 && parsed[0].moves) {
        const parsedMoves = parsed[0].moves.map((move) => ({
          san: move.move,
          comment: move.comments ? move.comments[0]?.text : null,
        }));

        const fen = pgn.match(/FEN \"([^\"]+)\"/)?.[1];
        const blackToMove = fen && fen.split(" ")[1] === "b";

        // Add placeholder if starting with Black's move
        if (blackToMove) {
          parsedMoves.unshift({
            san: "...", // marks the skipped White move
            isBlackMove: false,
          });
        }

        // Add color information to each move
        const annotatedMoves = parsedMoves.map((move, index) => {
          const adjustedIndex = index + (blackToMove ? 1 : 0);
          return {
            ...move,
            isBlackMove: adjustedIndex % 2 === 1,
            moveNumber: Math.floor(adjustedIndex / 2) + 1,
          };
        });

        setMoves(annotatedMoves);
        setCurrentMoveIndex(0);

        // Parse variations if any
        if (parsed[0].variations) {
          // Process each PGN variation and add them to our variations state
          const processedVariations = {};

          parsed[0].variations.forEach((variation, idx) => {
            // The variation's parent move index
            const parentIndex = variation.parentMoveIndex || 0;

            if (!processedVariations[parentIndex]) {
              processedVariations[parentIndex] = [];
            }

            // Process the variation moves
            const varMoves = variation.moves.map((move, vIdx) => {
              const baseIndex = parentIndex + (blackToMove ? 1 : 0);
              const effectiveMoveNumber = Math.floor(baseIndex / 2) + 1;
              const isBlackMove = (baseIndex + vIdx) % 2 === 1;

              return {
                san: move.move,
                comment: move.comments ? move.comments[0]?.text : null,
                isBlackMove,
                moveNumber: isBlackMove
                  ? effectiveMoveNumber
                  : effectiveMoveNumber + Math.floor(vIdx / 2),
              };
            });

            processedVariations[parentIndex].push(...varMoves);
          });

          setVariations(processedVariations);
        }
      } else {
        // If no moves were parsed, ensure moves array is empty
        setMoves([]);
      }
    } catch (error) {
      console.error("Invalid PGN format:", error);
      setMoves([]);
    }
  };

  // Get variation data by path
  const getVariationByPath = (path) => {
    if (path.length === 0) {
      return null;
    }

    let currentKey = path[0].index;

    // If only main line index, return that variation
    if (path.length === 1) {
      return variations[currentKey];
    }

    // For deeper paths, reconstruct the nested key
    for (let i = 1; i < path.length; i++) {
      currentKey = `${currentKey}_${path[i - 1].varIndex}`;

      // Last segment of the path
      if (i === path.length - 1) {
        return variations[currentKey];
      }
    }

    return null;
  };

  // Helper to construct unique variation keys
  const getVariationKey = (path) => {
    if (path.length === 0) return null;

    if (path.length === 1) {
      return path[0].index.toString();
    }

    let key = path[0].index.toString();
    for (let i = 0; i < path.length - 1; i++) {
      key += `_${path[i].varIndex}`;
    }

    return key;
  };

  // Update the onDrop function to handle nested variations properly
  const onDrop = (source, target, piece) => {
    const promotion = piece[1]?.toLowerCase() ?? "q";
    const move = game.move({
      from: source,
      to: target,
      promotion: promotion,
    });

    if (move === null) {
      return false; // Invalid move
    }

    const isBlackMove = game.turn() === "w"; // After the move, the turn switches
    const newMove = {
      san: move.san,
      isBlackMove: isBlackMove,
    };

    // If we're in a variation
    if (isInVariation) {
      // Get the current variation based on the path
      const variationKey = getVariationKey(variationPath);

      if (!variationKey) {
        console.error("Invalid variation path");
        return false;
      }

      const currentVar = variations[variationKey];
      const currentVarIdx = currentVariationIndex;

      // Check if we're in the middle of a variation
      if (currentVar && currentVarIdx < currentVar.length - 1) {
        // Check if move matches next move in variation
        if (currentVar[currentVarIdx + 1].san === newMove.san) {
          // Move matches, just update the index
          setCurrentVariationIndex(currentVarIdx + 1);
        } else {
          // Create a new sub-variation
          const newVarKey = `${variationKey}_${currentVarIdx}`;

          // Calculate move number for the new sub-variation
          const effectiveMoveNumber = isBlackMove
            ? currentVar[currentVarIdx].moveNumber
            : currentVar[currentVarIdx].moveNumber + 1;

          if (!variations[newVarKey]) {
            variations[newVarKey] = [];
          }

          variations[newVarKey].push({
            ...newMove,
            moveNumber: effectiveMoveNumber,
          });

          setVariations({ ...variations });

          // Update our path
          const newPath = [...variationPath];
          newPath.push({ index: currentVarIdx, varIndex: 0 });

          setVariationPath(newPath);
          setCurrentMoveIndex(newVarKey);
          setCurrentVariationIndex(0);
        }
      } else {
        // At the end of the variation, add the move
        const updatedVariation = [...(currentVar || [])];

        // Calculate effective move number
        let effectiveMoveNumber;
        if (updatedVariation.length > 0) {
          const lastMove = updatedVariation[updatedVariation.length - 1];
          effectiveMoveNumber = lastMove.isBlackMove
            ? lastMove.moveNumber + 1
            : lastMove.moveNumber;
        } else {
          // First move in a new variation
          const parentMove = moves[variationPath[0].index];
          effectiveMoveNumber =
            parentMove.moveNumber + (parentMove.isBlackMove ? 1 : 0);
        }

        updatedVariation.push({
          ...newMove,
          moveNumber: effectiveMoveNumber,
        });

        variations[variationKey] = updatedVariation;
        setVariations({ ...variations });
        setCurrentVariationIndex(updatedVariation.length - 1);
      }
    } else {
      // If in mainline, check if the move matches the next mainline move
      if (currentMoveIndex < moves.length) {
        if (moves[currentMoveIndex].san === newMove.san) {
          // Move matches mainline, proceed
          setCurrentMoveIndex(currentMoveIndex + 1);
        } else {
          // Create a new variation from mainline
          if (!variations[currentMoveIndex]) {
            variations[currentMoveIndex] = [];
          }

          // Calculate move number
          const effectiveMoveNumber =
            Math.floor((currentMoveIndex + halfMoveOffset) / 2) + 1;

          variations[currentMoveIndex].push({
            ...newMove,
            moveNumber: effectiveMoveNumber,
          });

          setVariations({ ...variations });

          // Set up the variation path
          setVariationPath([{ index: currentMoveIndex, varIndex: 0 }]);
          setIsInVariation(true);
          setCurrentVariationIndex(0);
        }
      } else {
        // At the end of mainline, add the move
        const newMoves = [...moves];

        // Calculate move number
        const effectiveMoveNumber =
          Math.floor((newMoves.length + halfMoveOffset) / 2) +
          (isBlackMove ? 0 : 1);

        newMoves.push({
          ...newMove,
          moveNumber: effectiveMoveNumber,
        });

        setMoves(newMoves);
        setCurrentMoveIndex(newMoves.length);
      }
    }

    setGame(new Chess(game.fen())); // Update the board state
    return true;
  };

  // Completely revised navigateToMove function to handle nested variations
  const navigateToMove = (index, variationIndex = null, path = null) => {
    const newGame = new Chess();
    const fen = event.match(/FEN \"([^\"]+)\"/)?.[1];

    if (fen) {
      try {
        newGame.load(fen);
      } catch (error) {
        console.error("Failed to load FEN:", error);
      }
    }

    // Use provided path or current path
    const navigationPath =
      path || (variationIndex !== null ? [...variationPath] : []);

    // If we're navigating directly to mainline
    if (variationIndex === null && path === null) {
      let skipFirst = isBlackToMoveStart ? 1 : 0;

      // Play mainline moves up to the index
      for (let i = skipFirst; i < index && i < moves.length; i++) {
        if (moves[i].san !== "...") {
          try {
            newGame.move(moves[i].san);
          } catch (e) {
            console.error(
              `Error making move ${moves[i].san} at index ${i}:`,
              e
            );
          }
        }
      }

      setIsInVariation(false);
      setCurrentVariationIndex(null);
      setVariationPath([]);
    } else {
      // We're navigating to a variation
      setIsInVariation(true);

      // Path for a simple variation directly from mainline
      if (path === null && typeof index === "number") {
        navigationPath.length = 0; // Clear any existing path
        navigationPath.push({ index, varIndex: variationIndex });

        // First play mainline moves up to the variation starting point
        let skipFirst = isBlackToMoveStart ? 1 : 0;
        for (let i = skipFirst; i < index && i < moves.length; i++) {
          if (moves[i].san !== "...") {
            try {
              newGame.move(moves[i].san);
            } catch (e) {
              console.error(
                `Error making move ${moves[i].san} at index ${i}:`,
                e
              );
            }
          }
        }

        // Then play variation moves
        if (variations[index]) {
          for (
            let i = 0;
            i <= variationIndex && i < variations[index].length;
            i++
          ) {
            try {
              newGame.move(variations[index][i].san);
            } catch (e) {
              console.error(`Error making variation move at index ${i}:`, e);
            }
          }
        }

        setCurrentVariationIndex(variationIndex);
      }
      // For nested variations with full path information
      else if (navigationPath.length > 0) {
        // Play mainline moves up to the first variation point
        const mainlineIndex = navigationPath[0].index;
        let skipFirst = isBlackToMoveStart ? 1 : 0;

        for (let i = skipFirst; i < mainlineIndex && i < moves.length; i++) {
          if (moves[i].san !== "...") {
            try {
              newGame.move(moves[i].san);
            } catch (e) {
              console.error(
                `Error making move ${moves[i].san} at index ${i}:`,
                e
              );
            }
          }
        }

        // Now traverse the variation path
        let currentKey = mainlineIndex.toString();
        let currentVarMoves = variations[currentKey];

        // Play moves for the first variation level
        const firstVarIndex = navigationPath[0].varIndex;
        for (
          let i = 0;
          i <= firstVarIndex && currentVarMoves && i < currentVarMoves.length;
          i++
        ) {
          try {
            newGame.move(currentVarMoves[i].san);
          } catch (e) {
            console.error(
              `Error making level 1 variation move at index ${i}:`,
              e
            );
          }
        }

        // Handle deeper nested variations
        for (let level = 1; level < navigationPath.length; level++) {
          const prevKey = currentKey;
          const prevIndex = navigationPath[level - 1].varIndex;
          currentKey = `${prevKey}_${prevIndex}`;

          currentVarMoves = variations[currentKey];
          const currentVarIndex = navigationPath[level].varIndex;

          if (currentVarMoves) {
            for (
              let i = 0;
              i <= currentVarIndex && i < currentVarMoves.length;
              i++
            ) {
              try {
                newGame.move(currentVarMoves[i].san);
              } catch (e) {
                console.error(
                  `Error making nested variation move at level ${level}, index ${i}:`,
                  e
                );
              }
            }
          }
        }

        // Set the current variation index to the last one in the path
        setCurrentVariationIndex(
          navigationPath[navigationPath.length - 1].varIndex
        );
      }

      setVariationPath([...navigationPath]);
    }

    setGame(newGame);
    setCurrentMoveIndex(index);
  };

  // Handle user choice for variation prompt
  const handleVariationChoice = (enterVariation) => {
    setShowVariationPrompt(false);

    if (enterVariation) {
      // Enter the variation
      setIsInVariation(true);
      setCurrentVariationIndex(0);
      setVariationPath([{ index: pendingVariationIndex, varIndex: 0 }]);
      navigateToMove(pendingVariationIndex, 0);
    } else {
      // Continue with mainline
      navigateToMove(pendingVariationIndex + 1);
    }

    // Reset pending index
    setPendingVariationIndex(null);
  };

  // Previous move navigation handling
  const handlePreviousMove = () => {
    if (isInVariation) {
      // Get the current path depth
      const pathDepth = variationPath.length;

      // If we're in a variation and not at the first move
      if (currentVariationIndex > 0) {
        // Move back within the same variation
        const newVarIndex = currentVariationIndex - 1;
        const newPath = [...variationPath];
        newPath[pathDepth - 1].varIndex = newVarIndex;

        navigateToMove(currentMoveIndex, newVarIndex, newPath);
      }
      // At the first move of a variation
      else if (currentVariationIndex === 0) {
        // If in a nested variation, go back to parent variation
        if (pathDepth > 1) {
          const newPath = [...variationPath];
          newPath.pop(); // Remove the last path segment

          const parentVarIndex = newPath[newPath.length - 1].varIndex;
          const parentIndex =
            pathDepth > 2
              ? newPath[newPath.length - 2].index
              : newPath[0].index;

          navigateToMove(parentIndex, parentVarIndex, newPath);
        }
        // If in a first-level variation, go back to mainline
        else {
          setIsInVariation(false);
          setCurrentVariationIndex(null);
          setVariationPath([]);
          navigateToMove(currentMoveIndex);
        }
      }
    }
    // If in mainline, just go back one move
    else if (currentMoveIndex > 0) {
      navigateToMove(currentMoveIndex - 1);
    }
  };

  // Next move navigation handling
  const handleNextMove = () => {
    // Don't proceed if there's a pending variation prompt
    if (showVariationPrompt) return;

    if (isInVariation) {
      // Get the current variation based on our path
      const variationKey = getVariationKey(variationPath);
      const currentVar = variations[variationKey];

      // If there are more moves in this variation
      if (currentVar && currentVariationIndex < currentVar.length - 1) {
        // Move forward within the variation
        const newVarIndex = currentVariationIndex + 1;
        const newPath = [...variationPath];
        newPath[newPath.length - 1].varIndex = newVarIndex;

        navigateToMove(currentMoveIndex, newVarIndex, newPath);
      }
      // At the end of this variation
      else {
        // Check if there are sub-variations from this position
        const subVarKey = `${variationKey}_${currentVariationIndex}`;
        if (variations[subVarKey] && variations[subVarKey].length > 0) {
          // Prompt to enter sub-variation
          setShowVariationPrompt(true);
          setPendingVariationIndex(subVarKey);
          return;
        }

        // No sub-variations, return to mainline if possible
        if (currentMoveIndex + 1 < moves.length) {
          setIsInVariation(false);
          setCurrentVariationIndex(null);
          setVariationPath([]);
          navigateToMove(currentMoveIndex + 1);
        }
      }
    }
    // In mainline
    else if (currentMoveIndex < moves.length) {
      // Check if there are variations at this position
      if (
        variations[currentMoveIndex] &&
        variations[currentMoveIndex].length > 0
      ) {
        // Prompt to enter variation
        setShowVariationPrompt(true);
        setPendingVariationIndex(currentMoveIndex);
        return;
      }

      // Move forward in mainline
      navigateToMove(currentMoveIndex + 1);
    }
  };

  // Get formatted move display text
  const getFormattedMove = (
    move,
    index,
    isInVariation = false,
    variationPath = []
  ) => {
    // For mainline moves
    if (!isInVariation) {
      const moveNumber = Math.floor(index / 2) + 1;
      const isBlackMove = index % 2 === 1;
      if (move.san === "...") {
        return `${moveNumber}...`;
      }

      if (!isBlackMove) {
        return `${moveNumber}. ${move.san}`;
      } else {
        return move.san;
      }
    }
    // For variation moves
    else {
      if (move.isBlackMove) {
        return `${move.moveNumber}... ${move.san}`;
      } else {
        return `${move.moveNumber}. ${move.san}`;
      }
    }
  };

  // Recursive function to render variations
  const renderVariations = (index, pathSoFar = []) => {
    const variationKey = typeof index === "string" ? index : index.toString();

    if (!variations[variationKey] || variations[variationKey].length === 0) {
      return null;
    }

    return (
      <span className="text-gray-500">
        {" ("}
        {variations[variationKey].map((variation, vIndex) => {
          // Build the proper path for this variation move
          const thisPath = [
            ...pathSoFar,
            { index: variationKey, varIndex: vIndex },
          ];

          // Improved current position detection logic
          const isCurrentPosition =
            isInVariation &&
            currentVariationIndex === vIndex &&
            variationPath.length > 0 &&
            // For simple variations directly from mainline
            ((variationPath.length === 1 &&
              variationPath[0].index.toString() === variationKey) ||
              // For nested variations with matching paths
              (variationPath.length === thisPath.length &&
                variationPath.every(
                  (p, i) =>
                    p.index.toString() === thisPath[i].index.toString() &&
                    p.varIndex === thisPath[i].varIndex
                )));

          // Format display text
          let displayText;

          if (vIndex === 0) {
            // First move of variation
            if (variation.isBlackMove) {
              displayText = `${variation.moveNumber}... ${variation.san}`;
            } else {
              displayText = `${variation.moveNumber}. ${variation.san}`;
            }
          } else {
            // Subsequent move in variation
            const prevIsBlack =
              variations[variationKey][vIndex - 1].isBlackMove;

            if (prevIsBlack && !variation.isBlackMove) {
              displayText = `${variation.moveNumber}. ${variation.san}`;
            } else {
              displayText = variation.san;
            }
          }

          // Check for sub-variations
          const subVariationKey = `${variationKey}_${vIndex}`;
          const hasSubVariations =
            variations[subVariationKey] &&
            variations[subVariationKey].length > 0;

          return (
            <span key={vIndex}>
              <span
                className={`cursor-pointer ${
                  isCurrentPosition
                    ? "font-bold text-blue-600" // Blue highlight for current variation position
                    : "text-gray-500"
                }`}
                onClick={() =>
                  navigateToMove(
                    parseInt(variationKey) || variationKey,
                    vIndex,
                    thisPath
                  )
                }
              >
                {vIndex > 0 ? " " : ""}
                {displayText}
              </span>

              {/* Render sub-variations recursively */}
              {hasSubVariations && renderVariations(subVariationKey, thisPath)}
            </span>
          );
        })}
        {") "}
      </span>
    );
  };
  
  return (
    <div className="bg-green-200 p-4 rounded-lg shadow-lg mb-4 w-full">
      <div className="flex flex-col md:flex-row bg-white rounded-md shadow-md border border-gray-300">
        <div className="flex-none p-2 w-full md:w-1/2">
          {game && (
            <div className="flex items-center justify-center border-8 border-gray-400 h-auto w-full">
              <Chessboard
                position={game.fen()}
                onPieceDrop={onDrop}
                boardOrientation={boardOrientation}
                customArrowColor={arrowColor}
                customArrows={arrows}
                customSquareStyles={renderHighlightedSquares()}
                onSquareClick={onSquareClick}
                customNotationStyle={{
                  fontSize: "25px",
                  fontWeight: "bold",
                  color: "black",
                }}
                key={eventKey}
              />
            </div>
          )}
        </div>
        <div className="flex-1 p-4 relative ">
          <div className="p-4 border rounded-lg bg-gray-100 h-full overflow-y-scroll max-h-[650px] ">
            <h4 className="font-semibold text-xl text-blue-600 select-none ">
              Event Details:
            </h4>
            <p className="mb-2 select-none">
              <strong>Topic:</strong> {whitePlayer} vs {blackPlayer}
            </p>
            <p className="mb-2 select-none">
              <strong>Annotator:</strong> {annotator}
            </p>
            {questionVisible && (
              <pre className="whitespace-pre-wrap text-gray-700 font-semibold break-words m-0 p-0 leading-tight mt-4">
                {specificComment.replace(/\n\s*\n/g, "\n").trim()}
              </pre>
            )}
            <h4 className="font-semibold text-lg mt-4">Moves:</h4>

            {movesVisible && (
              <pre className="whitespace-pre-wrap text-gray-700 font-semibold break-words m-0 p-0 leading-tight mt-4 overflow-x-scroll max-w-[630px]">
                {moves.map((move, index) => {
                  const moveNumber = Math.floor(index / 2) + 1;
                  const isBlackMove = index % 2 === 1;

                  if (index === 0 && isBlackToMoveStart && move.san === "...") {
                    return null; // skip dummy
                  }

                  return (
                    <span key={index} className="mr-2">
                      {/* Display move number */}
                      {((index === 1 && isBlackToMoveStart) ||
                        !isBlackMove) && (
                        <span className="text-gray-700">
                          {moveNumber}
                          {isBlackMove ? "..." : "."}
                        </span>
                      )}

                      {/* Display the move itself */}
                      <span
                        className={`cursor-pointer ml-1 ${
                          !isInVariation && currentMoveIndex - 1 === index
                            ? "font-bold text-blue-600"
                            : ""
                        }`}
                        onClick={() => navigateToMove(index)}
                      >
                        {move.san}
                      </span>

                      {renderVariations(index)}
                    </span>
                  );
                })}
              </pre>
            )}
          </div>
          {/* Variation Prompt Dialog */}
          {showVariationPrompt && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl border border-blue-500 w-96 transform transition-all scale-100 animate-fade-in">
                <h3 className="text-xl font-semibold text-blue-700 text-center mb-4">
                  Variation Found
                </h3>
                <p className="text-gray-700 text-center mb-6">
                  Do you want to explore this variation or continue with the
                  mainline?
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => handleVariationChoice(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
                  >
                    Enter Variation
                  </button>
                  <button
                    onClick={() => handleVariationChoice(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
                  >
                    Stay on Mainline
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Buttons Container */}
          <div className="absolute bottom-1 left-8 right-0 flex gap-2 mb-2">
            <button
              onClick={resetHighlights}
              className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition duration-200"
            >
              Reset Highlights
            </button>

            <button
              onClick={() =>
                setBoardOrientation(
                  boardOrientation === "white" ? "black" : "white"
                )
              }
              className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition duration-200"
            >
              Flip Board
            </button>

            <button
              onClick={() => {
                setQuestionVisible(!questionVisible);
                setMovesVisible(!movesVisible);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition duration-200"
            >
              {questionVisible ? "Hide" : "Show"} Event
            </button>

            <button
              onClick={handlePreviousMove}
              className="p-3 rounded-full text-lg bg-slate-400 hover:bg-blue-200 duration-100"
              disabled={showVariationPrompt}
            >
              <HiArrowSmLeft />
            </button>

            <button
              onClick={handleNextMove}
              className="p-3 rounded-full text-lg bg-slate-400 hover:bg-blue-200 duration-100"
              disabled={showVariationPrompt}
            >
              <HiArrowSmRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default FEN;