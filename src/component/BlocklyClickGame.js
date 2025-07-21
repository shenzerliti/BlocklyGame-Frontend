import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import "blockly/blocks";
import "blockly/msg/en";
import "./styles.css";

const BlocklyClickGame = () => {
  const blocklyDiv = useRef(null);
  const toolbox = useRef(null);
  const workspaceRef = useRef(null);

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [gameRunning, setGameRunning] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [difficulty, setDifficulty] = useState("easy");
  const [playerName, setPlayerName] = useState("");

  const getDelay = useCallback(() => {
    switch (difficulty) {
      case "hard":
        return 300;
      case "medium":
        return 600;
      default:
        return 1000;
    }
  }, [difficulty]);

  const fetchScores = useCallback(async () => {
    try {
      await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/scores`);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const saveScoreToDB = useCallback(async () => {
    if (!playerName.trim()) {
      alert("Please enter your player name before playing.");
      return;
    }
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/scores`, {
        playerId: playerName,
        score,
      });
      fetchScores();
    } catch (err) {
      console.error("Error saving score:", err);
    }
  }, [playerName, score, fetchScores]);

  const runCode = async () => {
    if (gameRunning) return;

    const blockCount = workspaceRef.current.getAllBlocks().length;
    if (blockCount === 0) {
      alert("⚠️ Please add some blocks before running the game.");
      return;
    }

    const blocks = workspaceRef.current.getAllBlocks(false);
    let repeatCount = 0;
    let waitTime = 0;

    blocks.forEach((block) => {
      if (block.type === "controls_repeat_ext") {
        const repeatInput = block.getInputTargetBlock("TIMES");
        if (repeatInput && repeatInput.getField("NUM")) {
          repeatCount = parseInt(repeatInput.getField("NUM").getValue());
        }
      }
      if (block.type === "controls_wait") {
        const waitInput = block.getInputTargetBlock("TIME");
        if (waitInput && waitInput.getField("NUM")) {
          waitTime = parseInt(waitInput.getField("NUM").getValue());
        }
      }
    });

    if (repeatCount * waitTime > 25000) {
      alert("⚠️ Your game blocks will exceed the time limit (25s). Please adjust repeat or wait duration.");
      return;
    }

    setScore(0);
    setTimeLeft(25);
    setShowPopup(false);
    setGameRunning(true);

    const code = javascriptGenerator.workspaceToCode(workspaceRef.current);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    try {
      const run = new AsyncFunction(code);
      await run();
    } catch (e) {
      console.error("Blockly Execution Error:", e);
    }
  };

  useEffect(() => {
    if (!workspaceRef.current) {
      const initCustomBlocks = () => {
        Blockly.Blocks["move_target_random"] = {
          init: function () {
            this.appendDummyInput().appendField("move target randomly");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
          },
        };

        javascriptGenerator.forBlock["move_target_random"] = () => {
          return "moveTargetRandom();\n";
        };

        Blockly.Blocks["increase_score"] = {
          init: function () {
            this.appendDummyInput().appendField("increase score");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(160);
          },
        };

        javascriptGenerator.forBlock["increase_score"] = () => {
          return "increaseScore();\n";
        };

        Blockly.Blocks["controls_wait"] = {
          init: function () {
            this.appendValueInput("TIME").setCheck("Number").appendField("wait (ms)");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
          },
        };

        javascriptGenerator.forBlock["controls_wait"] = () => {
          const delay = getDelay();
          return `await new Promise(r => setTimeout(r, ${delay}));\n`;
        };
      };

      initCustomBlocks();

      const workspace = Blockly.inject(blocklyDiv.current, {
        toolbox: toolbox.current,
      });
      workspaceRef.current = workspace;
    }
  }, [getDelay]);

  useEffect(() => {
    window.moveTargetRandom = moveTargetRandom;
    window.increaseScore = () => {
      if (!gameRunning) return;
      setScore((prev) => prev + 1);
    };
  }, [gameRunning]);

  useEffect(() => {
    if (!gameRunning) return;

    if (timeLeft <= 0) {
      setGameRunning(false);
      saveScoreToDB();
      setShowPopup(true);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameRunning, timeLeft, saveScoreToDB]);

  const moveTargetRandom = () => {
    const target = document.getElementById("target");
    const container = target.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const targetSize = 50;

    const x = Math.random() * (containerWidth - targetSize);
    const y = Math.random() * (containerHeight - targetSize);

    target.style.left = `${x}px`;
    target.style.top = `${y}px`;
  };

  const restartGame = () => {
    setShowPopup(false);
    setScore(0);
    setTimeLeft(25);
    setGameRunning(true);

    const code = javascriptGenerator.workspaceToCode(workspaceRef.current);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const run = new AsyncFunction(code);
    run().catch(console.error);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 className="heading">Blockly Click Target Game</h2>

      <div style={{ marginBottom: "20px" }}>
        <label>🎮 Difficulty:</label>
        <select
          onChange={(e) => setDifficulty(e.target.value)}
          value={difficulty}
          style={{ marginLeft: "10px", padding: "5px" }}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="playerName">🧑 Enter Player Name: </label>
        <input
          id="playerName"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter name"
          style={{
            padding: "6px",
            borderRadius: "4px",
            marginLeft: "10px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      <div className="main-container">
        <div id="blocklyDiv" ref={blocklyDiv}></div>

        <div>
          <div className="game-area">
            <div
              id="target"
              onClick={() => window.increaseScore()}
              style={{
                position: "absolute",
                width: "70px",
                height: "70px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <img
                src="./images/target.jpg"
                alt="target"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>

          <div className="info-panel">
            <p>⏳ Time Left: {timeLeft}s</p>
            <p>🏆 Score: {score}</p>

               <button onClick={runCode} disabled={gameRunning}>
        ▶️ Run Blockly Code
      </button>
          </div>
        </div>
      </div>

      <xml
        xmlns="https://developers.google.com/blockly/xml"
        style={{ display: "none" }}
        ref={toolbox}
      >
        <category name="Game Actions" colour="#5CA699">
          <block type="move_target_random" />
          <block type="increase_score" />
        </category>
        <category name="Control" colour="%{BKY_LOGIC_HUE}">
          <block type="controls_repeat_ext">
            <value name="TIMES">
              <shadow type="math_number">
                <field name="NUM">10</field>
              </shadow>
            </value>
          </block>
          <block type="controls_wait" />
        </category>
        <category name="Math" colour="%{BKY_MATH_HUE}">
          <block type="math_number" />
          <block type="math_arithmetic" />
        </category>
      </xml>


      {showPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <h2>⏰ Time's Up!</h2>
            <p>
              Your final score is: <strong>{score}</strong>
            </p>
            <button onClick={restartGame}>Restart Game</button>
            <button onClick={() => setShowPopup(false)}>❌ Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlocklyClickGame;
