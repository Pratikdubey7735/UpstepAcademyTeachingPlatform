import React, { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { HiArrowSmLeft, HiArrowSmRight } from "react-icons/hi";
import { parse } from "pgn-parser";

function NOTFEN({ event }) {
  const [moveHistory, setMoveHistory] = useState([]); // Simple array of moves
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 means at start position
  const [boardPosition, setBoardPosition] = useState({}); // Track piece positions

  const [highlightedSquares, setHighlightedSquares] = useState([]);
  const [arrowColor, setArrowColor] = useState("rgba(0, 255, 0, 0.7)");
  const [arrows, setArrows] = useState([]);
  const [currentHighlightColor, setCurrentHighlightColor] = useState(
    "rgba(0, 255, 0, 0.7)"
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
  const [boardSize, setBoardSize] = useState(600);
  const [textSize, setTextSize] = useState(24);
  const [showNewVariationDialog, setShowNewVariationDialog] = useState(false);

  const boardRef = useRef(null);
  class GameNode {
    constructor(move = null, parent = null) {
      this.move = move; // { from, to, piece, captured, promotion }
      this.parent = parent;
      this.children = [];
      this.isMainLine = parent === null || parent.children[0] === this;
      this.depth = parent ? parent.depth + 1 : 0;
      this.initialComments = null;
      this.boardState = null; // Store board state after this move
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

    getAllMoves() {
      const moves = [];
      let current = this;
      while (current.parent !== null) {
        moves.unshift(current.move);
        current = current.parent;
      }
      return moves;
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

  const getStartingPosition = () => {
    return {
      a8: "bR",
      b8: "bN",
      c8: "bB",
      d8: "bQ",
      e8: "bK",
      f8: "bB",
      g8: "bN",
      h8: "bR",
      a7: "bP",
      b7: "bP",
      c7: "bP",
      d7: "bP",
      e7: "bP",
      f7: "bP",
      g7: "bP",
      h7: "bP",
      a2: "wP",
      b2: "wP",
      c2: "wP",
      d2: "wP",
      e2: "wP",
      f2: "wP",
      g2: "wP",
      h2: "wP",
      a1: "wR",
      b1: "wN",
      c1: "wB",
      d1: "wQ",
      e1: "wK",
      f1: "wB",
      g1: "wN",
      h1: "wR",
    };
  };

  const fenToPositionObject = (fen) => {
    const position = {};
    const rows = fen.split(" ")[0].split("/");
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    rows.forEach((row, rankIndex) => {
      const rank = 8 - rankIndex;
      let fileIndex = 0;

      for (let char of row) {
        if (isNaN(char)) {
          const color = char === char.toUpperCase() ? "w" : "b";
          const piece = char.toUpperCase();
          const square = files[fileIndex] + rank;
          position[square] = color + piece;
          fileIndex++;
        } else {
          fileIndex += parseInt(char);
        }
      }
    });

    return position;
  };

  const positionObjectToFen = (position) => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let fen = "";

    for (let rank = 8; rank >= 1; rank--) {
      let emptyCount = 0;
      let rankString = "";

      for (let file of files) {
        const square = file + rank;
        const piece = position[square];

        if (piece) {
          if (emptyCount > 0) {
            rankString += emptyCount;
            emptyCount = 0;
          }
          const [color, pieceType] = [piece[0], piece[1]];
          rankString += color === "w" ? pieceType : pieceType.toLowerCase();
        } else {
          emptyCount++;
        }
      }

      if (emptyCount > 0) {
        rankString += emptyCount;
      }

      fen += rankString;
      if (rank > 1) fen += "/";
    }

    return fen + " w - - 0 1"; // Simplified FEN
  };

  const resetGameState = (currentEvent) => {
    const newEventKey = Date.now().toString();
    setEventKey(newEventKey);

    setHighlightedSquares([]);
    setArrows([]);
    setSelectedSquare(null);
    setGameOutcome(null);
    setCurrentPosition([]);
    setHasAutoMoved(false);
    setShowVariationPrompt(false);
    setAvailableVariations([]);
    setBoardOrientation("white");

    // Initialize simple move storage
    setMoveHistory([]);
    setCurrentMoveIndex(-1);

    // Initialize board position from FEN or starting position
    const fenMatch = currentEvent.match(/FEN \"([^\"]+)\"/);
    let initialPosition = getStartingPosition();

    if (fenMatch && fenMatch[1]) {
      try {
        initialPosition = fenToPositionObject(fenMatch[1]);
        const blackToMove = fenMatch[1].split(" ")[1] === "b";
        setIsBlackToMoveStart(blackToMove);
      } catch (error) {
        console.error("Invalid FEN format:", error);
        setIsBlackToMoveStart(false);
      }
    } else {
      setIsBlackToMoveStart(false);
    }

    setBoardPosition(initialPosition);

    // Initialize game tree
    const root = new GameNode();
    root.boardState = initialPosition;
    setGameTree(root);

    parseEventMetadata(currentEvent);
  };

  const checkForPgnMoves = (currentEvent) => {
    try {
      const parsed = parse(currentEvent);
      // Always return true if we have a valid PGN structure, even without moves
      // This allows us to process comments-only PGNs
      return parsed.length > 0;
    } catch (error) {
      return false;
    }
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
      } else if (event.ctrlKey && event.altKey && event.shiftKey) {
        // Red
        setArrowColor("rgba(255, 0, 0, 0.7)");
        setCurrentHighlightColor("rgba(255, 0, 0, 0.7)");
      } else if (event.ctrlKey && event.altKey) {
        // Yellow
        setArrowColor("rgba(255, 255, 0, 0.7)");
        setCurrentHighlightColor("rgba(255, 255, 0, 0.5)");
      } else if (event.altKey) {
        // Purple
        setArrowColor("rgba(128, 0, 128, 0.7)");
        setCurrentHighlightColor("rgba(128, 0, 128, 0.5)");
      } else if (event.shiftKey) {
        // Green
        setArrowColor("rgba(0, 255, 0, 0.7)");
        setCurrentHighlightColor("rgba(0, 255, 0, 0.7)");
      }
    };

    const handleKeyUp = () => {
      setArrowColor("rgba(0, 255, 0, 0.7)");
      setCurrentHighlightColor("rgba(0, 255, 0, 0.7)");
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
      if (parsed.length > 0) {
        const game = parsed[0];

        // Enhanced function to extract ONLY initial comments (before any moves)
        const extractInitialComments = (pgnText) => {
          const comments = [];

          // Remove headers first
          let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();

          // Split by moves to find the initial part
          // Look for the first move pattern (like "1.", "1...", etc.)
          const movePattern =
            /\b\d+\s*\.+\s*[NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:[NBRQK])?[+#]?/;
          const firstMoveMatch = cleanPGN.match(movePattern);

          let initialPart = cleanPGN;
          if (firstMoveMatch) {
            // Extract only the part before the first move
            initialPart = cleanPGN.substring(0, firstMoveMatch.index);
          }

          // Extract comments from the initial part only
          const commentRegex = /\{([^}]+)\}/g;
          let match;
          while ((match = commentRegex.exec(initialPart)) !== null) {
            const commentText = match[1].trim();
            if (commentText.length > 0) {
              comments.push(commentText);
            }
          }

          return comments;
        };

        // Get only initial comments from the PGN
        const initialComments = extractInitialComments(pgn);

        // Store initial comments in the root node
        if (initialComments.length > 0) {
          root.initialComments = initialComments.join("\n\n");
        }

        // Process moves if they exist
        if (game.moves && game.moves.length > 0) {
          const fenMatch = pgn.match(/FEN \"([^\"]+)\"/);
          let moveNumber = 1;
          let isBlackToMove = false;

          if (fenMatch && fenMatch[1]) {
            const fenParts = fenMatch[1].split(" ");
            isBlackToMove = fenParts[1] === "b";
            moveNumber = parseInt(fenParts[5]) || 1;
          }

          buildGameTree(game.moves, root, moveNumber, isBlackToMove);
        }
      }
    } catch (err) {
      console.error("Invalid PGN:", err);

      // Fallback: try to extract initial comments manually even if PGN parsing fails
      const fallbackComments = extractInitialCommentsManually(pgn);
      if (fallbackComments.length > 0) {
        root.initialComments = fallbackComments.join("\n\n");
      }
    }
  };

  // Updated fallback function to extract only initial comments
  const extractInitialCommentsManually = (pgnText) => {
    const comments = [];

    // Remove headers
    let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();

    // Find the first move pattern to determine where moves start
    const movePattern =
      /\b\d+\s*\.+\s*[NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:[NBRQK])?[+#]?/;
    const firstMoveMatch = cleanPGN.match(movePattern);

    let initialPart = cleanPGN;
    if (firstMoveMatch) {
      // Extract only the part before the first move
      initialPart = cleanPGN.substring(0, firstMoveMatch.index);
    }

    // Extract comments from the initial part only
    const commentRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = commentRegex.exec(initialPart)) !== null) {
      const commentText = match[1].trim();
      if (commentText.length > 0) {
        comments.push(commentText);
      }
    }

    return comments;
  };

  // Add this new helper function after the parsePGNIntoTree function:
  const extractCommentsManually = (pgnText) => {
    const comments = [];

    // Remove headers
    let cleanPGN = pgnText.replace(/\[([^\]]*)\]/g, "").trim();

    // Extract comments using regex
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

  const onDrop = (source, target, piece) => {
    // Allow ANY move - no validation
    const currentNode = getCurrentNode();
    if (!currentNode) return false;

    // Get current board state
    const newPosition = { ...boardPosition };
    const capturedPiece = newPosition[target];

    // Make the move
    newPosition[target] = newPosition[source];
    delete newPosition[source];

    // Handle promotion if needed (simple logic)
    const isPromotion =
      piece[1] === "P" && (target[1] === "8" || target[1] === "1");
    if (isPromotion) {
      const color = piece[0];
      newPosition[target] = color + "Q"; // Default to Queen
    }

    // Create move object
    const move = {
      from: source,
      to: target,
      piece: piece,
      captured: capturedPiece,
      promotion: isPromotion ? "q" : null,
      timestamp: Date.now(),
    };

    // Check if this move already exists as a child
    const existingChild = currentNode.children.find(
      (child) =>
        child.move && child.move.from === move.from && child.move.to === move.to
    );

    if (existingChild) {
      // Move exists, navigate to it
      const childIndex = currentNode.children.indexOf(existingChild);
      navigateToPosition([...currentPosition, childIndex]);
    } else {
      // Create new move
      const newChild = currentNode.addChild(move);
      newChild.boardState = newPosition;

      const childIndex = currentNode.children.indexOf(newChild);
      navigateToPosition([...currentPosition, childIndex]);
    }

    return true;
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

  const navigateToPosition = (newPosition) => {
    if (!gameTree) return;

    const node = gameTree.getNodeByPath(newPosition);
    if (!node) return;

    // Reconstruct board state by playing all moves
    let currentBoardState = gameTree.boardState || getStartingPosition();
    const moves = node.getAllMoves();

    // Apply each move to get final position
    for (const move of moves) {
      const newState = { ...currentBoardState };
      newState[move.to] = newState[move.from];
      delete newState[move.from];

      if (move.promotion) {
        const color = move.piece[0];
        newState[move.to] = color + move.promotion.toUpperCase();
      }

      currentBoardState = newState;
    }

    setBoardPosition(currentBoardState);
    setCurrentPosition(newPosition);

    // Update move history for simple navigation
    setMoveHistory(moves);
    setCurrentMoveIndex(moves.length - 1);
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

  const handlePreviousMove = () => {
    if (currentPosition.length === 0) return;
    const newPosition = currentPosition.slice(0, -1);
    navigateToPosition(newPosition);
  };

  // Update the move formatting for display:
  const formatMoveForDisplay = (move) => {
    if (!move) return "";

    const pieceSymbols = {
      K: "♔",
      Q: "♕",
      R: "♖",
      B: "♗",
      N: "♘",
      P: "♙",
    };

    const piece = move.piece[1];
    const symbol = pieceSymbols[piece] || piece;
    const capture = move.captured ? "x" : "";

    return `${symbol}${move.from}${capture}${move.to}`;
  };

  const handleVariationChoice = (chosenIndex) => {
    setShowVariationPrompt(false);
    if (chosenIndex !== null) {
      navigateToPosition([...currentPosition, chosenIndex]);
    }
    setAvailableVariations([]);
  };

  // Add a simple move list display (optional):
  const renderSimpleMoveList = () => {
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h5 className="font-semibold mb-2">Move History:</h5>
        <div className="flex flex-wrap gap-2">
          {moveHistory.map((move, index) => (
            <span
              key={index}
              className={`px-2 py-1 rounded text-sm cursor-pointer transition-colors ${
                index === currentMoveIndex
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
              onClick={() => {
                // Navigate to specific move in history
                const targetPath = Array(index + 1)
                  .fill()
                  .map((_, i) => 0);
                navigateToPosition(targetPath);
              }}
            >
              {Math.floor(index / 2) + 1}
              {index % 2 === 0 ? "." : "..."}
              {formatMoveForDisplay(move)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Add keyboard shortcuts for easier navigation:
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === "Delete" && currentPosition.length > 0) {
        // Delete current move/variation
        const parentPath = currentPosition.slice(0, -1);
        const childIndex = currentPosition[currentPosition.length - 1];

        if (gameTree) {
          const parentNode = gameTree.getNodeByPath(parentPath);
          if (parentNode && childIndex < parentNode.children.length) {
            parentNode.children.splice(childIndex, 1);
            // Update main line flags
            parentNode.children.forEach((child, index) => {
              child.isMainLine = index === 0;
            });
            navigateToPosition(parentPath);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [currentPosition, gameTree]);
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

    if (isRoot) {
      return (
        <div className="game-tree font-mono text-xl font-bold leading-relaxed">
          {/* Render initial comments inline if they exist */}
          {node.initialComments && (
            <span className="text-green-600 text-sm italic mr-2">
              {`{${node.initialComments}}`}
            </span>
          )}

          {/* Only render moves if they exist */}
          {node.children.length > 0 && (
            <>
              {/* Render main line (first child) */}
              {node.children[0] && (
                <div>
                  {renderGameTreeChessBaseStyle(
                    node.children[0],
                    [0],
                    depth,
                    false,
                    false
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
            </>
          )}
        </div>
      );
    }

    // For non-root nodes, display the move
    const isMainLine =
      depth === 0 || (node.parent && node.parent.children[0] === node);
    const moveNumber = Math.floor(path.length / 2) + 1;
    const isWhiteMove = path.length % 2 === 1;

    return (
      <React.Fragment key={path.join("-")}>
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
          {/* Display move number for white moves or first moves in variations */}
          {(isWhiteMove || isFirstInVariation) && `${moveNumber}.`}
          {!isWhiteMove && isFirstInVariation && ".."}
          {formatMoveForDisplay(node.move)}
        </span>

        {/* Handle variations */}
        {node.children.length > 1 && !isRoot && (
          <div className="inline-block">
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

        {/* Continue with main line */}
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
                position={boardPosition} // Changed from game.fen()
                onPieceDrop={onDrop}
                boardOrientation={boardOrientation}
                customArrowColor={arrowColor}
                customArrows={arrows}
                customSquareStyles={renderHighlightedSquares()}
                onSquareClick={onSquareClick}
                customNotationStyle={{
                  fontSize: `${textSize}px`,
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
              <h4 className="font-semibold text-lg mt-4">Moves:</h4>

              {movesVisible && gameTree && (
                <div className="mt-4 overflow-x-hidden w-full max-w-full overflow-y-auto max-h-96 ">
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
                  {questionVisible ? "Hide" : "Show"} Moves
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
              Adjust Board & Text Size
            </h3>

            {/* Board Size */}
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
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>Small (400px)</span>
                <span>Large (650px)</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2 text-center">
                Quick board sizes:
              </p>
              <div className="flex justify-center gap-2">
                {[450, 550, 650].map((size) => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      boardSize === size
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {size === 450 ? "Small" : size === 550 ? "Medium" : "Large"}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Size */}
            <div className="text-center mb-4">
              <span className="text-2xl font-bold text-green-600">
                {textSize}px
              </span>
            </div>

            <div className="mb-6">
              <div className="relative">
                <input
                  type="range"
                  min="12"
                  max="30"
                  value={textSize}
                  onChange={(e) => setTextSize(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                      ((textSize - 12) / 18) * 100
                    }%, #e5e7eb ${
                      ((textSize - 12) / 18) * 100
                    }%, #e5e7eb 100%)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>Small (12px)</span>
                <span>Large (30px)</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2 text-center">
                Quick text sizes:
              </p>
              <div className="flex justify-center gap-2">
                {[14, 18, 24].map((size) => (
                  <button
                    key={size}
                    onClick={() => setTextSize(size)}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      textSize === size
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {size === 14 ? "Small" : size === 18 ? "Medium" : "Large"}
                  </button>
                ))}
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
                onClick={() => {
                  setBoardSize(550);
                  setTextSize(18);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Slider Thumb Styles */}
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
      )}
    </div>
  );
}
export default NOTFEN;
