import React, { useState, useMemo, useRef, lazy } from "react";
import { ChessboardDnDProvider, SparePiece } from "react-chessboard";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
// Lazy import the Play component
import Play from "./Play";
import Training from "./Training";

const DemoComponent = () => {
  const game = useMemo(
    () => new Chess("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    []
  );
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [fenPosition, setFenPosition] = useState(game.fen());
  const [promotionPiece, setPromotionPiece] = useState("q");
  const fileInputRef = useRef(null);

  // NEW: Selection state
  const [selectedPiece, setSelectedPiece] = useState(null);

  const [castlingRights, setCastlingRights] = useState({
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: true,
    blackQueenside: true,
  });

  // Add player turn state
  const [playerTurn, setPlayerTurn] = useState("w");

  // Updated states for different input modes - now includes direct PGN input
  const [activeTab, setActiveTab] = useState("position"); // "position", "pgn", "fen", "directPgn"
  const [pgnContent, setPgnContent] = useState("");
  const [directFenInput, setDirectFenInput] = useState("");
  const [directPgnInput, setDirectPgnInput] = useState(""); // New state for direct PGN input
  const [uploadedFileName, setUploadedFileName] = useState("");

  // New state for training mode toggle
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  // State to control which component to show and store the event
  const [showPlay, setShowPlay] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);

  // NEW: Handle spare piece selection
  const handleSparePieceSelect = (piece) => {
    setSelectedPiece(selectedPiece === piece ? null : piece);
  };

  // NEW: Handle square click for piece placement
  const handleSquareClick = (square) => {
    if (selectedPiece) {
      const color = selectedPiece[0];
      const type = selectedPiece[1].toLowerCase();

      // Check if trying to place a king when one already exists
      if (type === "k") {
        const currentBoard = game.board();
        let hasKing = false;
        for (let rank of currentBoard) {
          for (let boardSquare of rank) {
            if (
              boardSquare &&
              boardSquare.type === "k" &&
              boardSquare.color === color
            ) {
              hasKing = true;
              break;
            }
          }
          if (hasKing) break;
        }

        if (hasKing) {
          alert(
            `The board already contains a ${
              color === "w" ? "WHITE" : "BLACK"
            } KING`
          );
          return;
        }
      }

      const success = game.put({ type, color }, square);
      if (success) {
        setFenPosition(game.fen());
        setSelectedPiece(null); // Clear selection after successful placement
      }
    }
  };

  // NEW: Custom SelectablePiece component
  const SelectablePiece = ({ piece, isSelected, onClick }) => {
    return (
      <div
        onClick={() => onClick(piece)}
        style={{
          width: "45px",
          height: "45px",
          cursor: "pointer",
          border: isSelected ? "3px solid #22c55e" : "2px solid transparent",
          borderRadius: "8px",
          padding: "2px",
          margin: "2px",
          backgroundColor: isSelected ? "#dcfce7" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          boxShadow: isSelected ? "0 0 10px rgba(34, 197, 94, 0.5)" : "none",
        }}
      >
        <SparePiece piece={piece} width={35} dndId="ManualBoardEditor" />
      </div>
    );
  };

  const handleGoButtonClick = () => {
    let updatedFen = fenPosition;

    // Build castling string
    let castlingString = "";
    if (castlingRights.whiteKingside) castlingString += "K";
    if (castlingRights.whiteQueenside) castlingString += "Q";
    if (castlingRights.blackKingside) castlingString += "k";
    if (castlingRights.blackQueenside) castlingString += "q";
    if (castlingString === "") castlingString = "-";

    // Update FEN with all required fields
    const fenParts = updatedFen.split(" ");

    // Ensure we have all 6 fields
    while (fenParts.length < 6) {
      fenParts.push("-");
    }

    fenParts[1] = playerTurn; // Active color (whose turn it is)
    fenParts[2] = castlingString; // Castling availability
    fenParts[3] = "-"; // En passant target square (none for manual setup)
    fenParts[4] = "0"; // Halfmove clock (reset for manual setup)
    fenParts[5] = "1"; // Fullmove number (start from 1)

    updatedFen = fenParts.join(" ");

    // Create PGN format with the complete structure including training mode
    const pgn = `[Event "Manual Position Setup"]
[Site "Custom Board"]
[Date "2024.01.01"]
[Round "1"]
[White "White Player"]
[Black "Black Player"]
[Result "*"]
[Annotator "Manual Setup"]
[SetUp "1"]
[FEN "${updatedFen}"]
[PlyCount "0"]
[EventDate "2024.01.01"]
[TrainingMode "${isTrainingMode ? "1" : "0"}"]
[ComponentMode "${isTrainingMode ? "Training" : "Play"}"]

{Manual chess position setup} `;

    // Set the event and show the appropriate component
    setCurrentEvent(pgn);
    setShowPlay(true);
    // Clear selection when going to play mode
    setSelectedPiece(null);
  };

  // Handle PGN file upload
  const handlePgnFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setPgnContent(content);
        setUploadedFileName(file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleSendPgn = () => {
    if (!pgnContent.trim()) {
      alert("Please upload a PGN file first.");
      return;
    }

    // Add training mode to the PGN content
    const enhancedPgn = addTrainingModeToPgn(pgnContent);

    // Set the event and show the appropriate component
    setCurrentEvent(enhancedPgn);
    setShowPlay(true);
  };

  const handleSendDirectFen = () => {
    if (!directFenInput.trim()) {
      alert("Please enter a FEN string.");
      return;
    }

    try {
      // Validate the FEN by trying to load it
      const testGame = new Chess();
      testGame.load(directFenInput);

      // Create PGN format with the FEN and training mode
      const pgn = `[Event "Direct FEN Input"]
[Site "Custom Board"]
[Date "2024.01.01"]
[Round "1"]
[White "White Player"]
[Black "Black Player"]
[Result "*"]
[Annotator "Direct FEN Input"]
[SetUp "1"]
[FEN "${directFenInput}"]
[PlyCount "0"]
[EventDate "2024.01.01"]
[TrainingMode "${isTrainingMode ? "1" : "0"}"]
[ComponentMode "${isTrainingMode ? "Training" : "Play"}"]

{Position from direct FEN input} `;

      // Set the event and show the appropriate component
      setCurrentEvent(pgn);
      setShowPlay(true);
    } catch (error) {
      alert(`Invalid FEN: ${error.message}`);
    }
  };

  const handleSendDirectPgn = () => {
    if (!directPgnInput.trim()) {
      alert("Please enter PGN content.");
      return;
    }

    try {
      // Basic PGN validation - check if it has some required structure
      if (!directPgnInput.includes("[") || !directPgnInput.includes("]")) {
        throw new Error("Invalid PGN format - missing headers");
      }

      // Add training mode to the PGN content
      const enhancedPgn = addTrainingModeToPgn(directPgnInput);

      // Set the event and show the appropriate component
      setCurrentEvent(enhancedPgn);
      setShowPlay(true);
    } catch (error) {
      alert(`Invalid PGN: ${error.message}`);
    }
  };

  const addTrainingModeToPgn = (pgnContent) => {
    const lines = pgnContent.split("\n");
    let headerEnded = false;
    let hasTrainingMode = false;
    let hasComponentMode = false;

    // Check if TrainingMode and ComponentMode already exist
    for (let line of lines) {
      if (line.includes("[TrainingMode")) {
        hasTrainingMode = true;
      }
      if (line.includes("[ComponentMode")) {
        hasComponentMode = true;
      }
    }

    let result = pgnContent;

    // Handle TrainingMode
    if (hasTrainingMode) {
      // Replace existing TrainingMode value
      result = result.replace(
        /\[TrainingMode\s+"[^"]*"\]/,
        `[TrainingMode "${isTrainingMode ? "1" : "0"}"]`
      );
    } else {
      // Add TrainingMode header
      const lines = result.split("\n");
      const resultLines = [];
      for (let line of lines) {
        resultLines.push(line);
        if (line.trim().startsWith("[") && line.trim().endsWith("]")) {
          // Still in headers
        } else if (!headerEnded && line.trim() === "") {
          // Empty line after headers, add TrainingMode before this
          resultLines.splice(
            -1,
            0,
            `[TrainingMode "${isTrainingMode ? "1" : "0"}"]`
          );
          headerEnded = true;
        }
      }

      // If no empty line was found, add TrainingMode at the end of headers
      if (!headerEnded) {
        const lastHeaderIndex = resultLines.findLastIndex(
          (line) => line.trim().startsWith("[") && line.trim().endsWith("]")
        );
        if (lastHeaderIndex >= 0) {
          resultLines.splice(
            lastHeaderIndex + 1,
            0,
            `[TrainingMode "${isTrainingMode ? "1" : "0"}"]`
          );
        }
      }

      result = resultLines.join("\n");
    }

    // Handle ComponentMode
    if (hasComponentMode) {
      // Replace existing ComponentMode value
      result = result.replace(
        /\[ComponentMode\s+"[^"]*"\]/,
        `[ComponentMode "${isTrainingMode ? "Training" : "Play"}"]`
      );
    } else {
      // Add ComponentMode header
      const lines = result.split("\n");
      const resultLines = [];
      headerEnded = false;
      for (let line of lines) {
        resultLines.push(line);
        if (line.trim().startsWith("[") && line.trim().endsWith("]")) {
          // Still in headers
        } else if (!headerEnded && line.trim() === "") {
          // Empty line after headers, add ComponentMode before this
          resultLines.splice(
            -1,
            0,
            `[ComponentMode "${isTrainingMode ? "Training" : "Play"}"]`
          );
          headerEnded = true;
        }
      }

      // If no empty line was found, add ComponentMode at the end of headers
      if (!headerEnded) {
        const lastHeaderIndex = resultLines.findLastIndex(
          (line) => line.trim().startsWith("[") && line.trim().endsWith("]")
        );
        if (lastHeaderIndex >= 0) {
          resultLines.splice(
            lastHeaderIndex + 1,
            0,
            `[ComponentMode "${isTrainingMode ? "Training" : "Play"}"]`
          );
        }
      }

      result = resultLines.join("\n");
    }

    return result;
  };

  // Function to go back to the setup interface
  const handleBackToSetup = () => {
    setShowPlay(false);
    setCurrentEvent(null);
    setSelectedPiece(null); // Clear selection when going back
  };

  // Clear PGN upload
  const handleClearPgn = () => {
    setPgnContent("");
    setUploadedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSparePieceDrop = (piece, targetSquare) => {
    const color = piece[0];
    const type = piece[1].toLowerCase();

    // Check if trying to place a king when one already exists
    if (type === "k") {
      const currentBoard = game.board();
      let hasKing = false;
      for (let rank of currentBoard) {
        for (let square of rank) {
          if (square && square.type === "k" && square.color === color) {
            hasKing = true;
            break;
          }
        }
        if (hasKing) break;
      }

      if (hasKing) {
        alert(
          `The board already contains a ${
            color === "w" ? "WHITE" : "BLACK"
          } KING`
        );
        return false;
      }
    }

    const success = game.put({ type, color }, targetSquare);
    if (success) {
      setFenPosition(game.fen());
    }
    return success;
  };

  const handlePieceDrop = (sourceSquare, targetSquare) => {
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: promotionPiece,
    });
    if (move) {
      setFenPosition(game.fen());
      return true;
    }
    return false;
  };

  const handlePieceDropOffBoard = (sourceSquare) => {
    game.remove(sourceSquare);
    setFenPosition(game.fen());
  };

  const handleFenInputChange = (e) => {
    const fen = e.target.value;
    try {
      game.load(fen);
      setFenPosition(game.fen());

      // Update player turn based on FEN
      const fenParts = fen.split(" ");
      if (fenParts.length > 1) {
        setPlayerTurn(fenParts[1]);
      }

      // Update castling rights based on FEN
      if (fenParts.length > 2) {
        const castling = fenParts[2];
        setCastlingRights({
          whiteKingside: castling.includes("K"),
          whiteQueenside: castling.includes("Q"),
          blackKingside: castling.includes("k"),
          blackQueenside: castling.includes("q"),
        });
      }
    } catch (error) {
      console.error("Invalid FEN:", error);
    }
  };

  const pieces = [
    "wP",
    "wN",
    "wB",
    "wR",
    "wQ",
    "wK",
    "bP",
    "bN",
    "bB",
    "bR",
    "bQ",
    "bK",
  ];

  const boardWrapperStyle = {
    margin: "0 auto",
    maxWidth: "650px",
    position: "relative",
    display: "flex",
    justifyContent: "center",
  };

  const buttonStyle = {
    margin: "10px",
    padding: "5px 10px",
    cursor: "pointer",
  };

  const inputStyle = { margin: "10px", padding: "5px", width: "100%" };

  const tabButtonStyle = (isActive) => ({
    padding: "10px 20px",
    margin: "5px",
    cursor: "pointer",
    backgroundColor: isActive ? "#3b82f6" : "#64748b",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: isActive ? "bold" : "normal",
  });

  // If showPlay is true, render the Play component
  if (showPlay && currentEvent) {
    return (
      <div>
        {/* Back button */}
        <div style={{ padding: "20px" }}>
          <button
            className="bg-gray-500 rounded-2xl text-white"
            style={buttonStyle}
            onClick={handleBackToSetup}
          >
            ← Back to Setup
          </button>
        </div>

        {/* Conditionally render Training or Play component based on training mode */}
        <React.Suspense fallback={<div>Loading...</div>}>
          {isTrainingMode ? (
            <Training event={currentEvent} />
          ) : (
            <Play event={currentEvent} />
          )}
        </React.Suspense>
      </div>
    );
  }

  return (
    <div className="bg-slate-500  min-h-screen mt-2">
      {/* Training Mode Toggle - Global across all tabs */}
      <div></div>
      <div
        style={{
          textAlign: "center",
          paddingTop: "20px",
          paddingBottom: "20px",
          backgroundColor: "#1e293b",
          margin: "5px 20px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <div className="flex items-center justify-center gap-6">
          <div className="text-white text-lg">
            <span className="font-bold">Training Mode: </span>
            <span
              className={isTrainingMode ? "text-green-400" : "text-red-400"}
            >
              {isTrainingMode
                ? "ON (Chess Rules Not Applied)"
                : "OFF (Chess Rules Applied)"}
            </span>
          </div>

          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isTrainingMode}
              onChange={(e) => setIsTrainingMode(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                isTrainingMode ? "bg-green-500" : "bg-gray-600"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 ${
                  isTrainingMode ? "translate-x-6" : "translate-x-0"
                }`}
              ></div>
            </div>
            <span className="ml-3 text-white font-medium">
              {isTrainingMode ? "Free Play" : "Rules Enforced"}
            </span>
          </label>
        </div>
      </div>
      );
      {/* Tab Navigation */}
      <div style={{ textAlign: "center", paddingBottom: "20px" }}>
        <button
          style={tabButtonStyle(activeTab === "position")}
          onClick={() => setActiveTab("position")}
        >
          Create Position
        </button>
        <button
          style={tabButtonStyle(activeTab === "pgn")}
          onClick={() => setActiveTab("pgn")}
        >
          Upload PGN File
        </button>
        <button
          style={tabButtonStyle(activeTab === "directPgn")}
          onClick={() => setActiveTab("directPgn")}
        >
          Direct PGN Input
        </button>
        <button
          style={tabButtonStyle(activeTab === "fen")}
          onClick={() => setActiveTab("fen")}
        >
          Direct FEN Input
        </button>
      </div>
      {/* Position Creation Tab */}
      {activeTab === "position" && (
        <ChessboardDnDProvider>
          <div style={boardWrapperStyle}>
            {/* MODIFIED: Black pieces with selection */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "10px",
              }}
              className="bg-slate-600 rounded-xl"
            >
              {pieces.slice(6, 12).map((piece) => (
                <SelectablePiece
                  key={piece}
                  piece={piece}
                  isSelected={selectedPiece === piece}
                  onClick={handleSparePieceSelect}
                />
              ))}
            </div>
            <div
              style={{
                border: "8px solid #FF8C00",
                borderRadius: "8px",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "8px",
              }}
            >
              <Chessboard
                id="ManualBoardEditor"
                position={fenPosition}
                boardOrientation={boardOrientation}
                boardWidth={550}
                onSparePieceDrop={handleSparePieceDrop}
                onPieceDrop={handlePieceDrop}
                onPieceDropOffBoard={handlePieceDropOffBoard}
                onSquareClick={handleSquareClick} // NEW: Handle square clicks
                dropOffBoardAction="trash"
                customBoardStyle={{
                  borderRadius: "0px",
                  backgroundColor: "#ffffff",
                }}
                customNotationStyle={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "black",
                }}
              />
            </div>
            {/* MODIFIED: White pieces with selection */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "10px",
              }}
              className="bg-slate-600 rounded-xl"
            >
              {pieces.slice(0, 6).map((piece) => (
                <SelectablePiece
                  key={piece}
                  piece={piece}
                  isSelected={selectedPiece === piece}
                  onClick={handleSparePieceSelect}
                />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              className="bg-blue-500 rounded-2xl text-white"
              style={buttonStyle}
              onClick={() => {
                game.reset();
                setFenPosition(game.fen());
                setPlayerTurn("w");
                setSelectedPiece(null); // Clear selection
                setCastlingRights({
                  whiteKingside: true,
                  whiteQueenside: true,
                  blackKingside: true,
                  blackQueenside: true,
                });
              }}
            >
              Start position ♟️
            </button>
            <button
              className="bg-blue-500 rounded-2xl text-white"
              style={buttonStyle}
              onClick={() => {
                game.clear();
                setFenPosition(game.fen());
                setPlayerTurn("w");
                setSelectedPiece(null); // Clear selection
                setCastlingRights({
                  whiteKingside: false,
                  whiteQueenside: false,
                  blackKingside: false,
                  blackQueenside: false,
                });
              }}
            >
              Clear board 🗑️
            </button>
            <button
              className="bg-blue-500 rounded-2xl text-white"
              style={buttonStyle}
              onClick={() =>
                setBoardOrientation(
                  boardOrientation === "white" ? "black" : "white"
                )
              }
            >
              Flip board 🔁
            </button>
            {/* NEW: Clear selection button */}
            {selectedPiece && (
              <button
                className="bg-orange-500 rounded-2xl text-white"
                style={buttonStyle}
                onClick={() => setSelectedPiece(null)}
              >
                Clear Selection ✖️
              </button>
            )}
            <button
              className="bg-green-500 rounded-2xl text-white"
              style={buttonStyle}
              onClick={handleGoButtonClick}
            >
              Send Position ➡️
            </button>
          </div>

          {/* Castling Rights */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              marginTop: "10px",
            }}
            className="text-2xl"
          >
            <label>
              <input
                type="checkbox"
                checked={castlingRights.whiteKingside}
                onChange={() =>
                  setCastlingRights((prev) => ({
                    ...prev,
                    whiteKingside: !prev.whiteKingside,
                  }))
                }
              />
              White 0-0
            </label>
            <label>
              <input
                type="checkbox"
                checked={castlingRights.whiteQueenside}
                onChange={() =>
                  setCastlingRights((prev) => ({
                    ...prev,
                    whiteQueenside: !prev.whiteQueenside,
                  }))
                }
              />
              White 0-0-0
            </label>
            <label>
              <input
                type="checkbox"
                checked={castlingRights.blackKingside}
                onChange={() =>
                  setCastlingRights((prev) => ({
                    ...prev,
                    blackKingside: !prev.blackKingside,
                  }))
                }
              />
              Black 0-0
            </label>
            <label>
              <input
                type="checkbox"
                checked={castlingRights.blackQueenside}
                onChange={() =>
                  setCastlingRights((prev) => ({
                    ...prev,
                    blackQueenside: !prev.blackQueenside,
                  }))
                }
              />
              Black 0-0-0
            </label>
          </div>

          {/* Player Turn */}
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <label className="text-black text-xl">
              Select player turn:{" "}
              <select
                value={playerTurn}
                onChange={(e) => setPlayerTurn(e.target.value)}
                style={{ padding: "5px", fontSize: "16px" }}
              >
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </label>
          </div>

          {/* Current FEN */}
          <input
            value={fenPosition}
            style={inputStyle}
            onChange={handleFenInputChange}
            placeholder="Current FEN position (you can edit this directly)"
          />
        </ChessboardDnDProvider>
      )}
      {/* PGN Upload Tab */}
      {activeTab === "pgn" && (
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <div style={{ textAlign: "center" }}>
            <h2 className="text-white text-2xl mb-4">Upload PGN File</h2>

            <div style={{ marginBottom: "20px" }}>
              <input
                type="file"
                accept=".pgn,.txt"
                onChange={handlePgnFileUpload}
                ref={fileInputRef}
                style={{
                  padding: "10px",
                  fontSize: "16px",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "2px solid #3b82f6",
                }}
              />
            </div>

            {uploadedFileName && (
              <div className="text-white text-lg mb-4">
                📁 Uploaded: {uploadedFileName}
              </div>
            )}

            {pgnContent && (
              <div style={{ marginBottom: "20px" }}>
                <textarea
                  value={pgnContent}
                  onChange={(e) => setPgnContent(e.target.value)}
                  style={{
                    width: "100%",
                    height: "300px",
                    padding: "10px",
                    fontSize: "14px",
                    borderRadius: "8px",
                    border: "2px solid #3b82f6",
                    fontFamily: "monospace",
                  }}
                  placeholder="PGN content will appear here..."
                />
              </div>
            )}

            <div
              style={{ display: "flex", justifyContent: "center", gap: "10px" }}
            >
              <button
                className="bg-green-500 rounded-2xl text-white"
                style={{ ...buttonStyle, fontSize: "18px" }}
                onClick={handleSendPgn}
              >
                Send PGN ➡️
              </button>
              <button
                className="bg-red-500 rounded-2xl text-white"
                style={buttonStyle}
                onClick={handleClearPgn}
              >
                Clear 🗑️
              </button>
            </div>
          </div>
        </div>
      )}
      {/* New Direct PGN Input Tab */}
      {activeTab === "directPgn" && (
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <div style={{ textAlign: "center" }}>
            <h2 className="text-white text-2xl mb-4">Direct PGN Input</h2>

            <div style={{ marginBottom: "20px" }}>
              <textarea
                value={directPgnInput}
                onChange={(e) => setDirectPgnInput(e.target.value)}
                style={{
                  width: "100%",
                  height: "400px",
                  padding: "10px",
                  fontSize: "14px",
                  borderRadius: "8px",
                  border: "2px solid #3b82f6",
                  fontFamily: "monospace",
                }}
                placeholder="Paste your complete PGN content here...

Example:
[Event 'Sample Game']
[Site 'Chess.com']
[Date '2024.01.01']
[Round '1']
[White 'Player1']
[Black 'Player2']
[Result '1-0']

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"
              />
            </div>

            <div className="text-white text-sm mb-4">
              <p>Enter complete PGN with headers and moves</p>
            </div>

            <div
              style={{ display: "flex", justifyContent: "center", gap: "10px" }}
            >
              <button
                className="bg-green-500 rounded-2xl text-white"
                style={{ ...buttonStyle, fontSize: "18px" }}
                onClick={handleSendDirectPgn}
              >
                Send PGN ➡️
              </button>
              <button
                className="bg-blue-500 rounded-2xl text-white"
                style={buttonStyle}
                onClick={() =>
                  setDirectPgnInput(`[Event "Sample Game"]
[Site "Chess.com"]
[Date "2024.01.01"]
[Round "1"]
[White "Player1"]
[Black "Player2"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5`)
                }
              >
                Use Sample PGN
              </button>
              <button
                className="bg-red-500 rounded-2xl text-white"
                style={buttonStyle}
                onClick={() => setDirectPgnInput("")}
              >
                Clear 🗑️
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Direct FEN Input Tab */}
      {activeTab === "fen" && (
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <div style={{ textAlign: "center" }}>
            <h2 className="text-white text-2xl mb-4">Direct FEN Input</h2>

            <div style={{ marginBottom: "20px" }}>
              <textarea
                value={directFenInput}
                onChange={(e) => setDirectFenInput(e.target.value)}
                style={{
                  width: "100%",
                  height: "100px",
                  padding: "10px",
                  fontSize: "16px",
                  borderRadius: "8px",
                  border: "2px solid #3b82f6",
                  fontFamily: "monospace",
                }}
                placeholder="Paste your FEN string here..."
              />
            </div>

            <div className="text-white text-sm mb-4">
              <p>Example FEN:</p>
              <p className="font-mono text-xs">
                rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
              </p>
            </div>

            <div
              style={{ display: "flex", justifyContent: "center", gap: "10px" }}
            >
              <button
                className="bg-green-500 rounded-2xl text-white"
                style={{ ...buttonStyle, fontSize: "18px" }}
                onClick={handleSendDirectFen}
              >
                Send FEN ➡️
              </button>
              <button
                className="bg-blue-500 rounded-2xl text-white"
                style={buttonStyle}
                onClick={() =>
                  setDirectFenInput(
                    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  )
                }
              >
                Use Starting Position
              </button>
              <button
                className="bg-red-500 rounded-2xl text-white"
                style={buttonStyle}
                onClick={() => setDirectFenInput("")}
              >
                Clear 🗑️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DemoComponent;
