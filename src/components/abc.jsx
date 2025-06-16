import React, { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { HiArrowSmLeft, HiArrowSmRight } from "react-icons/hi";
import { parse } from "pgn-parser";

function NOTFEN({ event }) {
  const [gameComments, setGameComments] = useState([]);
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
  const [gameTree, setGameTree] = useState(null);
  const [currentPosition, setCurrentPosition] = useState([]);
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [isBlackToMoveStart, setIsBlackToMoveStart] = useState(false);
  const [hasAutoMoved, setHasAutoMoved] = useState(false);
  const [eventKey, setEventKey] = useState("");

  // Variation prompt state
  const [showVariationPrompt, setShowVariationPrompt] = useState(false);
  const [availableVariations, setAvailableVariations] = useState([]);
  const [showSizeDialog, setShowSizeDialog] = useState(false);
  const [boardSize, setBoardSize] = useState(690);
  const [showNewVariationDialog, setShowNewVariationDialog] = useState(false);

  const boardRef = useRef(null);

  class GameNode {
    constructor(move = null, parent = null) {
      this.move = move; // {san, comment, isBlackMove, moveNumber}
      this.parent = parent;
      this.children = []; // Array of GameNode
      this.isMainLine = parent === null || parent.children[0] === this;
      this.depth = parent ? parent.depth + 1 : 0;
    }

    addChild(move) {
      const child = new GameNode(move, this);
      this.children.push(child);
      if (this.children.length === 1) {
        child.isMainLine = true;
      }
      return child;
    }

    insertVariation(move, position = -1) {
      const child = new GameNode(move, this);
      if (position === -1 || position >= this.children.length) {
        this.children.push(child);
      } else {
        this.children.splice(position, 0, child);
      }
      this.children.forEach((child, index) => {
        child.isMainLine = index === 0;
      });
      return child;
    }

    removeChild(childNode) {
      const index = this.children.indexOf(childNode);
      if (index > -1) {
        this.children.splice(index, 1);
        this.children.forEach((child, index) => {
          child.isMainLine = index === 0;
        });
      }
    }

    getVariations() {
      return this.children.map((child, index) => ({
        index,
        move: child.move,
        isMainLine: index === 0,
        depth: child.depth,
      }));
    }

    promoteVariation(childIndex) {
      if (childIndex > 0 && childIndex < this.children.length) {
        const variation = this.children.splice(childIndex, 1)[0];
        this.children.unshift(variation);
        this.children.forEach((child, index) => {
          child.isMainLine = index === 0;
        });
      }
    }

    getPath() {
      const path = [];
      let current = this;
      while (current.parent !== null) {
        const index = current.parent.children.indexOf(current);
        path.unshift(index);
        current = current.parent;
      }
      return path;
    }

    getNodeByPath(path) {
      let current = this;
      for (const index of path) {
        if (index < current.children.length) {
          current = current.children[index];
        } else {
          return null;
        }
      }
      return current;
    }

    getAllMoves() {
      const moves = [];
      let current = this;
      while (current.parent !== null) {
        moves.unshift(current.move);
        current = current.parent;
      }
      return moves;
    }

    getTreeStats() {
      const stats = {
        totalNodes: 0,
        maxDepth: 0,
        variationCount: 0,
      };

      const traverse = (node, depth = 0) => {
        stats.totalNodes++;
        stats.maxDepth = Math.max(stats.maxDepth, depth);
        if (node.children.length > 1) {
          stats.variationCount += node.children.length - 1;
        }

        node.children.forEach((child) => traverse(child, depth + 1));
      };

      traverse(this);
      return stats;
    }
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "s" || event.key === "S") {
        setShowSizeDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (boardRef.current && !boardRef.current.contains(event.target)) {
        resetHighlights();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Complete reset of all game state when event changes
  useEffect(() => {
    resetGameState(event);
  }, [event]);

  // Function to completely reset the game state
  const resetGameState = (currentEvent) => {
    const newEventKey = Date.now().toString();
    setEventKey(newEventKey);

    setHighlightedSquares([]);
    setGameComments([]);
    setArrows([]);
    setSelectedSquare(null);
    setGameOutcome(null);
    setCurrentPosition([]);
    setHasAutoMoved(false);
    setShowVariationPrompt(false);
    setAvailableVariations([]);
    setBoardOrientation("white");

    const newGame = new Chess();
    const fenMatch = currentEvent.match(/FEN \"([^\"]+)\"/);

    if (fenMatch && fenMatch[1]) {
      try {
        newGame.load(fenMatch[1]);
        const blackToMove = fenMatch[1].split(" ")[1] === "b";
        setIsBlackToMoveStart(blackToMove);
      } catch (error) {
        console.error("Invalid FEN format:", error);
        setIsBlackToMoveStart(false);
      }
    } else {
      setIsBlackToMoveStart(false);
    }

    setGame(newGame);
    parseEventMetadata(currentEvent);

    // Initialize game tree - always start with empty root
    const root = new GameNode();

    // Try to parse PGN moves if they exist
    const pgnMoves = checkForPgnMoves(currentEvent);
    if (pgnMoves) {
      parsePGNIntoTree(currentEvent, root);
    }

    setGameTree(root);
  };

  // Extract metadata from event
  const parseEventMetadata = (currentEvent) => {
    const titleMatch = currentEvent.match(/\[Event \"([^\"]+)\"\]/);
    setEventTitle(titleMatch ? titleMatch[1] : "");

    const whiteMatch = currentEvent.match(/\[White \"([^\"]+)\"\]/);
    setWhitePlayer(whiteMatch ? whiteMatch[1] : "");

    const blackMatch = currentEvent.match(/\[Black \"([^\"]+)\"\]/);
    setBlackPlayer(blackMatch ? blackMatch[1] : "");

    const annotatorMatch = currentEvent.match(/\[Annotator \"([^\"]+)\"\]/);
    setAnnotator(annotatorMatch ? annotatorMatch[1] : "");

    const specificCommentMatch = currentEvent.replace(/\[[^\]]*\]/g, "");
    setSpecificComment(specificCommentMatch);
  };

  const handleSizeDialogClose = () => {
    setShowSizeDialog(false);
  };

  const handleVariationContextMenu = (variationIndex) => {
    // Enhanced context menu functionality would go here
    console.log("Context menu for variation:", variationIndex);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "f" && event.ctrlKey) {
        event.preventDefault();
        setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
      } else if (event.ctrlKey && event.altKey) {
        setArrowColor("rgba(255, 255, 0, 0.7)");
        setCurrentHighlightColor("rgba(255, 255, 0, 0.5)");
      } else if (event.shiftKey && event.altKey) {
        setArrowColor("rgba(255, 0, 0, 0.7)");
        setCurrentHighlightColor("rgba(255, 0, 0, 0.5)");
      } else if (event.altKey) {
        setArrowColor("rgba(0, 255, 0, 0.7)");
        setCurrentHighlightColor("rgba(0, 255, 0, 0.5)");
      } else if (event.shiftKey) {
        setArrowColor("rgba(128, 0, 128, 0.7)");
        setCurrentHighlightColor("rgba(128, 0, 128, 0.7)");
      }
    };

    const handleKeyUp = (event) => {
      setArrowColor("rgba(255, 0, 0, 0.7)");
      setCurrentHighlightColor("rgba(255, 0, 0, 0.5)");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleKeyNavigation = (event) => {
      if (showVariationPrompt) return;

      if (event.key === "ArrowRight") {
        handleNextMove();
      } else if (event.key === "ArrowLeft") {
        handlePreviousMove();
      }
    };

    window.addEventListener("keydown", handleKeyNavigation);
    return () => window.removeEventListener("keydown", handleKeyNavigation);
  }, [currentPosition, showVariationPrompt, gameTree]);

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
const parsePGNIntoTree = (pgn, root) => {
  try {
    const parsed = parse(pgn);
    
    // Extract game-level comments using multiple methods
    const extractedGameComments = [];

    // Method 1: Extract ALL comments from raw PGN text BEFORE parsing
    const extractAllCommentsFromRawPGN = (pgnText) => {
      const comments = [];
      
      // Remove all PGN headers first
      let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();
      
      // Find all comments using regex
      const commentRegex = /\{([^}]+)\}/g;
      let match;
      
      while ((match = commentRegex.exec(cleanPGN)) !== null) {
        const commentText = match[1].trim();
        if (commentText.length > 0) {
          comments.push(commentText);
        }
      }
      
      return comments;
    };

    // Method 2: Check if PGN has NO moves but has comments (pure comment PGN)
    const checkForCommentsOnlyPGN = (pgnText) => {
      // Remove headers
      let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();
      
      // Check if there are no actual chess moves (no pattern like "1.e4" or "1...e5")
      const hasMoves = /\b\d+\.+\s*[a-zA-Z]/.test(cleanPGN);
      
      // But has comments
      const hasComments = /\{([^}]+)\}/.test(cleanPGN);
      
      return !hasMoves && hasComments;
    };

    // Method 3: Enhanced comment extraction that considers position context
    const extractCommentsWithContext = (pgnText) => {
      const comments = [];
      
      // Remove headers
      let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();
      
      // Split by moves to understand context
      const movePattern = /(\d+\.+\s*[a-zA-Z][^{]*)/g;
      const parts = cleanPGN.split(movePattern);
      
      // First part (before any moves) - these are definitely game comments
      if (parts[0] && parts[0].trim()) {
        const commentRegex = /\{([^}]+)\}/g;
        let match;
        while ((match = commentRegex.exec(parts[0])) !== null) {
          const commentText = match[1].trim();
          if (commentText.length > 0) {
            comments.push(commentText);
          }
        }
      }
      
      // If no moves found at all, extract all comments
      if (!movePattern.test(cleanPGN)) {
        const commentRegex = /\{([^}]+)\}/g;
        let match;
        while ((match = commentRegex.exec(cleanPGN)) !== null) {
          const commentText = match[1].trim();
          if (commentText.length > 0) {
            comments.push(commentText);
          }
        }
      }
      
      return comments;
    };

    // Apply all extraction methods
    const rawComments = extractAllCommentsFromRawPGN(pgn);
    const contextComments = extractCommentsWithContext(pgn);
    const isCommentsOnly = checkForCommentsOnlyPGN(pgn);
    
    // If it's a comments-only PGN, take all comments
    if (isCommentsOnly) {
      extractedGameComments.push(...rawComments);
    } else {
      // Otherwise, use context-aware extraction
      extractedGameComments.push(...contextComments);
    }

    // Method 4: Handle parsed data if available
    if (parsed.length > 0) {
      const game = parsed[0];

      // Direct game comments from parser
      if (game.comments && game.comments.length > 0) {
        extractedGameComments.push(...game.comments.map((c) => c.text));
      }

      // Check first move for game-level comments if moves exist
      if (game.moves && game.moves.length > 0) {
        const firstMove = game.moves[0];

        if (firstMove.comments && firstMove.comments.length > 0) {
          firstMove.comments.forEach((comment) => {
            const text = comment.text?.trim();
            if (text) {
              // Detect game-level comments based on content
              const seemsGameLevel =
                text.length > 100 || // Long comments
                /\b(19|20|18|17|16)\d{2}\b/.test(text) || // Contains years
                /\b(World Championship|Champion|tournament|match|game)\b/i.test(text) || // Chess terms
                /\([^)]*\d{4}[^)]*\)/.test(text) || // Parentheses with years
                !/\b(move|plays|captures|attacks|defends|threatens)\b/i.test(text); // Not move-specific

              if (seemsGameLevel) {
                extractedGameComments.push(text);
              }
            }
          });
        }
      }
    }

    // Method 5: Fallback - if still no comments found, be more aggressive
    if (extractedGameComments.length === 0) {
      const allCommentRegex = /\{([^}]+)\}/g;
      let match;
      const allFoundComments = [];
      
      while ((match = allCommentRegex.exec(pgn)) !== null) {
        const commentText = match[1].trim();
        if (commentText.length > 10) { // Any comment longer than 10 chars
          allFoundComments.push(commentText);
        }
      }
      
      // Take first few comments as they're likely game-level
      extractedGameComments.push(...allFoundComments.slice(0, 5));
    }

    // Remove duplicates while preserving order
    const uniqueComments = [];
    const seen = new Set();

    extractedGameComments.forEach((comment) => {
      const normalized = comment.trim().toLowerCase();
      if (!seen.has(normalized) && comment.trim().length > 0) {
        seen.add(normalized);
        uniqueComments.push(comment.trim());
      }
    });

    setGameComments(uniqueComments);

    // Continue with existing move parsing
    if (parsed.length > 0 && parsed[0].moves?.length > 0) {
      const game = parsed[0];
      const fenMatch = pgn.match(/FEN \"([^\"]+)\"/);
      let moveNumber = 1;
      let isBlackToMove = false;

      if (fenMatch?.[1]) {
        const fenParts = fenMatch[1].split(" ");
        isBlackToMove = fenParts[1] === "b";
        moveNumber = parseInt(fenParts[5]) || 1;
      }

      buildGameTree(game.moves, root, moveNumber, isBlackToMove);
    }
  } catch (err) {
    console.error("Invalid PGN:", err);
    setGameComments([]); // Reset on error
  }
};

// Additional helper function to specifically handle comment-only PGNs
const extractCommentsOnlyFromPGN = (pgnText) => {
  const comments = [];
  
  // Remove all PGN headers
  let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();
  
  // Remove any potential move numbers or chess notation artifacts
  cleanPGN = cleanPGN.replace(/\b\d+\.+/g, "").trim();
  
  // Extract all comments
  const commentRegex = /\{([^}]+)\}/g;
  let match;
  
  while ((match = commentRegex.exec(cleanPGN)) !== null) {
    const commentText = match[1].trim();
    if (commentText.length > 0) {
      comments.push(commentText);
    }
  }
  
  return comments;
};

// Enhanced checkForPgnMoves function to better detect move-less PGNs
const checkForPgnMoves = (currentEvent) => {
  try {
    // First check if there are actual chess moves in the text
    const cleanPGN = currentEvent.replace(/\[([^\]]*)\]/g, "").trim();
    const hasMoves = /\b\d+\.+\s*[a-zA-Z]/.test(cleanPGN);
    
    if (!hasMoves) {
      // No moves found, but might have comments
      return false;
    }
    
    // If moves exist, try to parse
    const parsed = parse(currentEvent);
    return parsed.length > 0 && parsed[0].moves && parsed[0].moves.length > 0;
  } catch (error) {
    return false;
  }
};
  
  const buildGameTree = (
    moves,
    parentNode,
    startMoveNumber = 1,
    isBlackToMove = false
  ) => {
    let currentNode = parentNode;
    let moveNumber = startMoveNumber;
    let blackToMove = isBlackToMove;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];

      // Extract all comments for this move
      let allComments = [];

      // Get direct comments on the move
      if (move.comments && move.comments.length > 0) {
        allComments.push(...move.comments.map((c) => c.text));
      }

      // Get any other comment fields that might exist
      if (move.comment) {
        allComments.push(move.comment);
      }

      // Combine all comments into a single string, separated by newlines
      const combinedComment =
        allComments.length > 0 ? allComments.join("\n").trim() : null;

      const moveData = {
        san: move.move,
        comment: combinedComment,
        isBlackMove: blackToMove,
        moveNumber: moveNumber,
        ply: (moveNumber - 1) * 2 + (blackToMove ? 2 : 1),
      };

      // Add this move to currentNode as the mainline
      const newNode = currentNode.addChild(moveData);

      // Process all variations (RAVs or nested branches) from parent
      const allVariations = [...(move.variations || []), ...(move.ravs || [])];

      for (const variation of allVariations) {
        // Variations must be added from the same parent, not from mainline
        buildGameTree(
          variation.moves,
          currentNode, // Important: from parent, not newNode
          moveNumber,
          blackToMove
        );
      }

      // Move forward on mainline
      currentNode = newNode;
      if (blackToMove) moveNumber++;
      blackToMove = !blackToMove;
    }
  };

  const getCurrentNode = () => {
    if (!gameTree) return null;
    return gameTree.getNodeByPath(currentPosition);
  };

  const navigateToPosition = (newPosition) => {
    if (!gameTree) return;

    const node = gameTree.getNodeByPath(newPosition);
    if (!node) return;

    // Create new game instance
    const newGame = new Chess();

    // Load starting FEN if available
    const fenMatch = event.match(/FEN \"([^\"]+)\"/);
    if (fenMatch && fenMatch[1]) {
      try {
        const fen = fenMatch[1];
        newGame.load(fen);

        if (newGame.fen() !== fen) {
          console.warn("FEN validation mismatch");
        }
      } catch (error) {
        console.error("Failed to load FEN:", error);
        newGame.reset();
      }
    }

    // Play all moves to reach the target position
    const moves = node.getAllMoves();
    let success = true;

    for (const move of moves) {
      try {
        const result = newGame.move(move.san);
        if (!result) {
          console.error(
            `Invalid move: ${move.san} at position: ${newGame.fen()}`
          );
          success = false;
          break;
        }
      } catch (e) {
        console.error(`Error making move ${move.san}:`, e);
        success = false;
        break;
      }
    }

    if (success) {
      setGame(newGame);
      setCurrentPosition(newPosition);
    } else {
      console.error("Failed to navigate to position:", newPosition);
    }
  };

  const onDrop = (source, target, piece) => {
    const promotion = piece[1]?.toLowerCase() ?? "q";
    const testGame = new Chess(game.fen());

    try {
      const move = testGame.move({ from: source, to: target, promotion });
      if (!move) return false;

      const currentNode = getCurrentNode();
      if (!currentNode) return false;

      // Check if this move already exists as a child
      const existingChild = currentNode.children.find(
        (child) => child.move && child.move.san === move.san
      );

      if (existingChild) {
        // Move exists, navigate to it
        const childIndex = currentNode.children.indexOf(existingChild);
        navigateToPosition([...currentPosition, childIndex]);
      } else {
        // Create new move - UNIFIED BEHAVIOR: always add as variation if children exist
        const isBlackMove = game.turn() === "b";
        const lastMove = currentNode.move;

        let moveNumber;
        if (lastMove) {
          moveNumber = lastMove.isBlackMove
            ? lastMove.moveNumber + 1
            : lastMove.moveNumber;
        } else {
          const fullmoveNumber = parseInt(game.fen().split(" ")[5]);
          moveNumber = fullmoveNumber;
        }

        const newMove = {
          san: move.san,
          comment: null,
          isBlackMove,
          moveNumber,
          ply: (moveNumber - 1) * 2 + (isBlackMove ? 2 : 1),
        };

        // UNIFIED BEHAVIOR: First child becomes main line, subsequent ones are variations
        const newChild = currentNode.addChild(newMove);
        const childIndex = currentNode.children.indexOf(newChild);
        navigateToPosition([...currentPosition, childIndex]);
      }

      return true;
    } catch (error) {
      console.error("Move error:", error);
      return false;
    }
  };

  const handleNextMove = () => {
    if (showVariationPrompt) return;

    const currentNode = getCurrentNode();
    if (!currentNode || currentNode.children.length === 0) return;

    if (currentNode.children.length === 1) {
      navigateToPosition([...currentPosition, 0]);
    } else {
      const variations = currentNode.children.map((child, index) => ({
        index,
        move: child.move,
        isMainLine: index === 0,
        depth: child.depth,
        hasSubVariations: child.children.length > 1,
        nodeCount: getSubtreeNodeCount(child),
      }));

      setAvailableVariations(variations);
      setShowVariationPrompt(true);
    }
  };

  const getSubtreeNodeCount = (node) => {
    let count = 1;
    node.children.forEach((child) => {
      count += getSubtreeNodeCount(child);
    });
    return count;
  };

  const createVariation = (moveData) => {
    const currentNode = getCurrentNode();
    if (!currentNode) return;

    const newChild = currentNode.addChild(moveData);
    const childIndex = currentNode.children.indexOf(newChild);
    navigateToPosition([...currentPosition, childIndex]);
  };

  const deleteVariation = (targetPath) => {
    if (!gameTree || targetPath.length === 0) return;

    const parentPath = targetPath.slice(0, -1);
    const parentNode = gameTree.getNodeByPath(parentPath);
    const childIndex = targetPath[targetPath.length - 1];

    if (parentNode && childIndex < parentNode.children.length) {
      const childToRemove = parentNode.children[childIndex];
      parentNode.removeChild(childToRemove);

      if (
        isCurrentMove(targetPath) ||
        isDescendantPath(currentPosition, targetPath)
      ) {
        navigateToPosition(parentPath);
      }
    }
  };

  const isDescendantPath = (descendantPath, ancestorPath) => {
    if (descendantPath.length <= ancestorPath.length) return false;

    for (let i = 0; i < ancestorPath.length; i++) {
      if (descendantPath[i] !== ancestorPath[i]) return false;
    }
    return true;
  };

  const promoteVariation = (targetPath) => {
    if (!gameTree || targetPath.length === 0) return;

    const parentPath = targetPath.slice(0, -1);
    const parentNode = gameTree.getNodeByPath(parentPath);
    const childIndex = targetPath[targetPath.length - 1];

    if (parentNode && childIndex > 0) {
      parentNode.promoteVariation(childIndex);
      if (isCurrentMove(targetPath)) {
        const newPath = [...parentPath, 0];
        navigateToPosition(newPath);
      }
    }
  };

  const handlePreviousMove = () => {
    if (currentPosition.length === 0) return;

    const newPosition = currentPosition.slice(0, -1);
    navigateToPosition(newPosition);
  };

  const handleVariationChoice = (chosenIndex) => {
    setShowVariationPrompt(false);
    if (chosenIndex !== null) {
      navigateToPosition([...currentPosition, chosenIndex]);
    }
    setAvailableVariations([]);
  };

  const getFormattedMove = (
    move,
    isFirstMoveInLine = false,
    isFirstMoveInVariation = false
  ) => {
    if (!move) return "";

    if (move.isBlackMove) {
      // For black moves at the start of variations or when game starts with black
      if (isFirstMoveInLine || isFirstMoveInVariation) {
        return `${move.moveNumber}...${move.san}`;
      } else {
        return move.san;
      }
    } else {
      // White moves always show move number
      return `${move.moveNumber}.${move.san}`;
    }
  };

  const isCurrentMove = (path) => {
    if (path.length !== currentPosition.length) return false;
    return path.every((index, i) => index === currentPosition[i]);
  };

  const renderGameTreeChessBaseStyle = (
    node,
    path = [],
    depth = 0,
    isVariation = false,
    isFirstInVariation = false
  ) => {
    if (!node) return null;

    const isRoot = path.length === 0;
    const isCurrent = isCurrentMove(path);

    // For root node, render ALL children (mainline and variations)
    if (isRoot) {
      return (
        <div className="game-tree font-mono text-xl font-bold leading-relaxed">
          {/* Render main line (first child) */}
          {node.children[0] && (
            <div>
              {renderGameTreeChessBaseStyle(
                node.children[0],
                [0],
                depth,
                false,
                node.children[0].move?.isBlackMove && isBlackToMoveStart
              )}
            </div>
          )}

          {/* Render variations at root level (children after first) */}
          {node.children.length > 1 && (
            <div className="mt-2">
              {node.children.slice(1).map((child, index) => {
                const variationPath = [index + 1];
                return (
                  <div
                    key={`root-variation-${index + 1}`}
                    className="block my-1"
                  >
                    <span className="text-gray-400 font-mono text-xl font-bold">
                      (
                    </span>
                    {renderGameTreeChessBaseStyle(
                      child,
                      variationPath,
                      depth + 1,
                      true,
                      true
                    )}
                    <span className="text-gray-400 font-mono text-xl font-bold">
                      )
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isMainLine =
      depth === 0 || (node.parent && node.parent.children[0] === node);

    return (
      <React.Fragment key={path.join("-")}>
        {/* Render current move */}
        <span
          className={`cursor-pointer transition-all duration-200 hover:bg-blue-50 px-1 py-0.5 rounded ${
            isCurrent
              ? "font-bold text-blue-600 bg-blue-100 ring-1 ring-blue-300"
              : isMainLine
              ? "text-gray-800 font-medium"
              : "text-blue-600"
          }`}
          onClick={() => navigateToPosition(path)}
        >
          {getFormattedMove(
            node.move,
            path.length === 1 && node.move?.isBlackMove && isBlackToMoveStart,
            isFirstInVariation && node.move?.isBlackMove
          )}
        </span>

        {node.move?.comment && (
          <span className="text-green-600 text-sm italic ml-1">
            {`{${node.move.comment}}`}
          </span>
        )}

        {/* Render variations inline at this position (but NOT at root level) */}
        {node.children.length > 1 && !isRoot && (
          <div className="inline-block">
            {/* Render variations (not main line) immediately after current move */}
            {node.children.slice(1).map((child, index) => {
              const variationPath = [...path, index + 1];
              return (
                <div
                  key={`inline-variation-${index + 1}`}
                  className="block ml-4 my-1"
                >
                  <span className="text-gray-400 font-mono">(</span>
                  {renderGameTreeChessBaseStyle(
                    child,
                    variationPath,
                    depth + 1,
                    true,
                    true
                  )}
                  <span className="text-gray-400 font-mono">)</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Continue with main line (first child) */}
        {node.children[0] && (
          <>
            {" "}
            {renderGameTreeChessBaseStyle(
              node.children[0],
              [...path, 0],
              depth,
              isVariation,
              false
            )}
          </>
        )}
      </React.Fragment>
    );
  };
  return (
    <div className="bg-green-200 p-4 rounded-lg shadow-lg mb-4 w-full">
      <div className="flex flex-col md:flex-row bg-white rounded-md shadow-md border border-gray-300">
        {/* Chess Board Container */}
        <div className="flex-none p-2 w-full md:w-1/2">
          {game && (
            <div
              className="flex items-center justify-center border-8 border-gray-400 h-auto w-full"
              ref={boardRef}
              style={{
                maxWidth: `${boardSize}px`,
                maxHeight: `${boardSize}px`,
                margin: "0 auto",
              }}
            >
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

        {/* Game Details Container */}
        <div className="flex-1 p-4 relative min-h-0 min-w-0 overflow-hidden">
          <div className="flex flex-col h-full w-full">
            {/* Scrollable Content Area */}
            <div className="flex-1 p-4 border rounded-lg bg-gray-100 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full">
              <h4 className="font-semibold text-xl text-blue-600 select-none">
                Event Details:
              </h4>
              <p className="mb-2 select-none break-words">
                <strong>Topic:</strong> {whitePlayer} vs {blackPlayer}
              </p>
              <p className="mb-2 select-none break-words">
                <strong>Annotator:</strong> {annotator}
              </p>

              {questionVisible && (
                <div className="mt-4 space-y-3">
                  {/* Display existing specific comment if it exists */}
                  {specificComment && specificComment.trim() && (
                    <div className="p-3 bg-white rounded-md border border-gray-200 max-h-64 overflow-y-auto overflow-x-hidden w-full max-w-full">
                      <h5 className="font-semibold text-sm text-gray-600 mb-2"></h5>
                      <div
                        className="text-gray-700 font-semibold italic text-sm leading-relaxed w-full"
                        style={{
                          wordWrap: "break-word",
                          wordBreak: "break-all",
                          overflowWrap: "break-word",
                          whiteSpace: "pre-wrap",
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          display: "block",
                          boxSizing: "border-box",
                          overflow: "hidden",
                          textAlign: "justify",
                        }}
                      >
                        {specificComment.replace(/\s+/g, " ").trim()}
                      </div>
                    </div>
                  )}

                  {/* Display game-level comments from PGN */}
                  {gameComments && gameComments.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200 max-h-64 overflow-y-auto overflow-x-hidden w-full max-w-full">
                      <h5 className="font-semibold text-sm text-blue-600 mb-2">
                        Game Comments:
                      </h5>
                      <div className="space-y-2">
                        {gameComments.map((comment, index) => (
                          <div
                            key={index}
                            className="text-blue-700 italic text-sm leading-relaxed p-2 bg-white rounded border-l-4 border-blue-400"
                            style={{
                              wordWrap: "break-word",
                              wordBreak: "break-all",
                              overflowWrap: "break-word",
                              whiteSpace: "pre-wrap",
                              width: "100%",
                              maxWidth: "100%",
                              minWidth: 0,
                              display: "block",
                              boxSizing: "border-box",
                              overflow: "hidden",
                              textAlign: "justify",
                            }}
                          >
                            {comment.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <h4 className="font-semibold text-lg mt-4">Moves:</h4>

              {movesVisible && gameTree && (
                <div className="mt-4 overflow-x-hidden w-full max-w-full overflow-y-auto max-h-44 ">
                  <pre className="whitespace-pre-wrap  text-gray-700 break-all m-0 p-0 leading-tight w-full max-w-full overflow-hidden text-xl font-bold">
                    {renderGameTreeChessBaseStyle(gameTree)}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex-none mt-4 pt-2 border-t border-gray-200">
              <div className="flex flex-wrap gap-2 justify-start">
                <button
                  onClick={resetHighlights}
                  className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition duration-200 text-sm font-medium"
                >
                  Reset Highlights
                </button>

                <button
                  onClick={() =>
                    setBoardOrientation(
                      boardOrientation === "white" ? "black" : "white"
                    )
                  }
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition duration-200 text-sm font-medium"
                >
                  Flip Board
                </button>
                <button
                  onClick={() => {
                    setQuestionVisible(!questionVisible);
                    setMovesVisible(!movesVisible);
                  }}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition duration-200 text-sm font-medium"
                >
                  {questionVisible ? "Hide" : "Show"} Event
                </button>

                <button
                  onClick={() => setShowSizeDialog(true)}
                  className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition duration-200 text-sm font-medium"
                >
                  Board Size
                </button>

                <button
                  onClick={handlePreviousMove}
                  className="p-2 rounded-lg text-lg bg-slate-400 hover:bg-slate-500 transition duration-200 disabled:opacity-50"
                  disabled={showVariationPrompt}
                >
                  <HiArrowSmLeft />
                </button>

                <button
                  onClick={handleNextMove}
                  className="p-2 rounded-lg text-lg bg-slate-400 hover:bg-slate-500 transition duration-200 disabled:opacity-50"
                  disabled={showVariationPrompt}
                >
                  <HiArrowSmRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showVariationPrompt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl border border-blue-500 w-96 max-w-[90vw] max-h-[80vh] overflow-y-auto transform transition-all scale-100">
            <h3 className="text-xl font-semibold text-blue-700 text-center mb-4">
              Choose Variation
            </h3>
            <p className="text-gray-700 text-center mb-6">
              Multiple moves available. Choose which line to follow:
            </p>

            <div className="space-y-3 mb-6">
              {availableVariations.map((variation, index) => (
                <div key={index} className="relative">
                  <button
                    onClick={() => handleVariationChoice(variation.index)}
                    className={`w-full p-3 rounded-lg text-left transition-all duration-300 relative ${
                      variation.isMainLine
                        ? "bg-blue-100 border-2 border-blue-500 text-blue-800 font-semibold"
                        : "bg-gray-100 border-2 border-gray-300 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm">
                          {variation.isMainLine
                            ? "Main Line: "
                            : `Variation ${index}: `}
                        </span>
                        <span className="font-mono">
                          {getFormattedMove(variation.move)}
                        </span>
                      </div>

                      {/* ENHANCED: Show variation complexity */}
                      <div className="flex flex-col items-end text-xs text-gray-500">
                        {variation.hasSubVariations && (
                          <span className="bg-yellow-200 text-yellow-800 px-1 rounded">
                            Has sub-variations
                          </span>
                        )}
                        <span>{variation.nodeCount} moves</span>
                      </div>
                    </div>

                    {/* ENHANCED: Visual depth indicator */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-400 rounded-l-lg opacity-30"></div>
                  </button>

                  {/* ENHANCED: Right-click context menu for advanced options */}
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Show context menu for promote/delete operations
                        handleVariationContextMenu(variation.index);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ⋮
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleVariationChoice(null)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
              >
                Cancel
              </button>

              {/* ENHANCED: Add new variation button */}
              <button
                onClick={() => setShowNewVariationDialog(true)}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-md text-sm"
              >
                + New
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Size Dialog */}
      {showSizeDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl border border-blue-500 w-full max-w-md transform transition-all scale-100">
            <h3 className="text-xl font-semibold text-blue-700 text-center mb-6">
              Adjust Board Size
            </h3>

            <div className="text-center mb-4">
              <span className="text-2xl font-bold text-blue-600">
                {boardSize}px
              </span>
            </div>

            <div className="mb-6">
              <div className="relative">
                <input
                  type="range"
                  min="400"
                  max="650"
                  value={boardSize}
                  onChange={(e) => setBoardSize(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                      ((boardSize - 400) / 250) * 100
                    }%, #e5e7eb ${
                      ((boardSize - 400) / 250) * 100
                    }%, #e5e7eb 100%)`,
                  }}
                />
                <style jsx>{`
                  .slider::-webkit-slider-thumb {
                    appearance: none;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  }
                  .slider::-moz-range-thumb {
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  }
                `}</style>
              </div>

              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>Small (400px)</span>
                <span>Large (650px)</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2 text-center">
                Quick sizes:
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setBoardSize(450)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    boardSize === 450
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Small
                </button>
                <button
                  onClick={() => setBoardSize(550)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    boardSize === 550
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setBoardSize(650)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    boardSize === 650
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Large
                </button>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleSizeDialogClose}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
              >
                Apply
              </button>
              <button
                onClick={() => setBoardSize(550)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default NOTFEN;
