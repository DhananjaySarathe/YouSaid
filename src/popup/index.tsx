import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

interface CommentResponse {
  success: boolean;
  comments?: string[];
  error?: string;
}

function Popup() {
  const [tone, setTone] = useState<string>("");
  const [comments, setComments] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [capturedComments, setCapturedComments] = useState<string[]>([]);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualComments, setManualComments] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  useEffect(() => {
    // Retrieve the user's tone, comment history, and API key from storage
    chrome.storage.local.get(
      ["userToneProfile", "userCommentHistory", "geminiApiKey"],
      (data) => {
        if (data.userToneProfile) {
          setTone(data.userToneProfile);
        }
        if (data.geminiApiKey) {
          setApiKey(data.geminiApiKey);
        } else {
          setShowSettings(true); // Show settings if no API key
        }
        if (data.userCommentHistory) {
          setCapturedComments(data.userCommentHistory);
          if (data.userCommentHistory.length >= 6) {
            generateComments(data.userToneProfile);
          }
        }
      }
    );
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      chrome.storage.local.set({ geminiApiKey: apiKey.trim() }, () => {
        setShowSettings(false);
        alert("API key saved successfully!");
      });
    }
  };

  const saveManualComments = () => {
    const validComments = manualComments.filter(
      (comment) => comment.trim().length > 0
    );
    if (validComments.length >= 3) {
      chrome.storage.local.set(
        {
          userCommentHistory: validComments,
          userToneProfile: analyzeWritingTone(validComments),
        },
        () => {
          setCapturedComments(validComments);
          setTone(analyzeWritingTone(validComments));
          setShowManualInput(false);
          alert(`${validComments.length} comments saved successfully!`);
        }
      );
    } else {
      alert("Please enter at least 3 comments to analyze your writing style.");
    }
  };

  const editCapturedComment = (index: number, newComment: string) => {
    const updatedComments = [...capturedComments];
    updatedComments[index] = newComment;
    setCapturedComments(updatedComments);
    chrome.storage.local.set(
      {
        userCommentHistory: updatedComments,
        userToneProfile: analyzeWritingTone(updatedComments),
      },
      () => {
        setTone(analyzeWritingTone(updatedComments));
      }
    );
    setEditingIndex(-1);
  };

  const deleteCapturedComment = (index: number) => {
    const updatedComments = capturedComments.filter((_, i) => i !== index);
    setCapturedComments(updatedComments);
    chrome.storage.local.set(
      {
        userCommentHistory: updatedComments,
        userToneProfile:
          updatedComments.length > 0 ? analyzeWritingTone(updatedComments) : "",
      },
      () => {
        setTone(
          updatedComments.length > 0 ? analyzeWritingTone(updatedComments) : ""
        );
      }
    );
  };

  const clearAllComments = () => {
    if (confirm("Are you sure you want to clear all captured comments?")) {
      setCapturedComments([]);
      setTone("");
      chrome.storage.local.set({
        userCommentHistory: [],
        userToneProfile: "",
      });
    }
  };

  const analyzeWritingTone = (comments: string[]): string => {
    if (comments.length === 0) return "";

    let tone = "professional";
    const casualWords = [
      "awesome",
      "cool",
      "great",
      "love",
      "amazing",
      "wow",
      "nice",
      "lol",
    ];
    const professionalWords = [
      "pleased",
      "excellent",
      "appreciate",
      "congratulations",
      "insights",
      "valuable",
      "impressive",
    ];

    let casualCount = 0;
    let professionalCount = 0;

    comments.forEach((comment) => {
      const lowerComment = comment.toLowerCase();
      casualWords.forEach((word) => {
        if (lowerComment.includes(word)) casualCount++;
      });
      professionalWords.forEach((word) => {
        if (lowerComment.includes(word)) professionalCount++;
      });
    });

    if (casualCount > professionalCount) {
      tone = "casual and friendly";
    } else if (professionalCount > casualCount) {
      tone = "professional and formal";
    } else {
      tone = "balanced and approachable";
    }

    return tone;
  };

  const generateComments = (tone: string) => {
    if (tone && apiKey) {
      setIsLoading(true);
      chrome.runtime.sendMessage(
        { type: "generate_comments", tone, post: "Sample LinkedIn post" },
        (response: CommentResponse) => {
          setIsLoading(false);
          if (response.success && response.comments) {
            setComments(response.comments);
          } else {
            alert(response.error || "Failed to generate comments");
          }
        }
      );
    }
  };

  if (showSettings) {
    return (
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl rounded-xl border border-gray-700"
        style={{ width: "420px", padding: "24px" }}
      >
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
          🔑 Setup Required
        </h1>
        <p className="text-sm text-gray-300 mb-6 bg-white/5 p-3 rounded-lg border border-white/10">
          🤖 Please enter your Gemini API key to enable AI-powered comment
          suggestions.
        </p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            🗝️ Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-all"
          />
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            🔗 Get your API key from{" "}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              Google AI Studio
            </a>
          </p>
        </div>
        <button
          onClick={saveApiKey}
          disabled={!apiKey.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed font-medium transition-all transform hover:scale-105 disabled:hover:scale-100"
        >
          💾 Save API Key
        </button>
      </div>
    );
  }

  if (showManualInput) {
    return (
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl rounded-xl border border-gray-700"
        style={{ width: "420px", padding: "24px" }}
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            ✨ Manual Comment Input
          </h1>
          <button
            onClick={() => setShowManualInput(false)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            ← Back
          </button>
        </div>
        <p className="text-sm text-gray-300 mb-6 bg-white/5 p-3 rounded-lg border border-white/10">
          💭 Enter at least 3 sample comments to analyze your writing style:
        </p>
        {manualComments.map((comment, idx) => (
          <div key={idx} className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx < 3
                    ? "bg-blue-500 text-white"
                    : "bg-gray-600 text-gray-300"
                }`}
              >
                {idx + 1}
              </span>
              Comment {idx + 1} {idx < 3 ? "(Required)" : "(Optional)"}
            </label>
            <textarea
              value={comment}
              onChange={(e) => {
                const updatedComments = [...manualComments];
                updatedComments[idx] = e.target.value;
                setManualComments(updatedComments);
              }}
              placeholder={`Enter your sample LinkedIn comment ${idx + 1}...`}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 text-sm transition-all"
              rows={3}
              style={{ resize: "vertical" }}
            />
          </div>
        ))}
        <button
          onClick={saveManualComments}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 font-medium transition-all transform hover:scale-105 mt-6"
        >
          🚀 Save Comments & Analyze Style
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl rounded-xl border border-gray-700"
      style={{ width: "420px", padding: "24px" }}
    >
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          🤖 EchoType AI
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
        >
          ⚙️ Settings
        </button>
      </div>

      <div className="bg-white/5 p-3 rounded-lg border border-white/10 mb-6">
        <p className="text-sm text-gray-300">
          <span className="text-blue-400 font-medium">🎯 Current Tone:</span>{" "}
          {tone || "Not set"}
        </p>
      </div>

      {/* Captured Comments Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            💬 Captured Comments
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">
              {capturedComments.length}
            </span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Pre-populate with existing comments
                const existingComments = [...capturedComments];
                while (existingComments.length < 6) {
                  existingComments.push("");
                }
                setManualComments(existingComments.slice(0, 6));
                setShowManualInput(true);
              }}
              className="text-xs bg-gradient-to-r from-emerald-500 to-green-600 text-white px-3 py-2 rounded-lg hover:from-emerald-600 hover:to-green-700 font-medium transition-all transform hover:scale-105"
            >
              ✏️ Edit Manual
            </button>
            {capturedComments.length > 0 && (
              <button
                onClick={clearAllComments}
                className="text-xs bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-2 rounded-lg hover:from-red-600 hover:to-pink-700 font-medium transition-all transform hover:scale-105"
              >
                🗑️ Clear
              </button>
            )}
          </div>
        </div>

        {capturedComments.length > 0 ? (
          <div className="max-h-32 overflow-y-auto mb-3">
            {capturedComments.map((comment, idx) => (
              <div key={idx} className="mb-2 p-2 bg-gray-100 rounded text-sm">
                {editingIndex === idx ? (
                  <div>
                    <textarea
                      defaultValue={comment}
                      className="w-full p-1 border rounded text-xs"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey) {
                          editCapturedComment(idx, e.currentTarget.value);
                        }
                        if (e.key === "Escape") {
                          setEditingIndex(-1);
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={(e) => {
                          const textarea = e.currentTarget.parentElement
                            ?.previousElementSibling as HTMLTextAreaElement;
                          editCapturedComment(idx, textarea.value);
                        }}
                        className="text-xs bg-green-500 text-white px-2 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingIndex(-1)}
                        className="text-xs bg-gray-500 text-white px-2 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <span className="flex-1 mr-2">
                      {comment.substring(0, 60)}
                      {comment.length > 60 ? "..." : ""}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingIndex(idx)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteCapturedComment(idx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">
            No comments captured yet. Comments will appear here as you type on
            LinkedIn or you can add them manually.
          </p>
        )}
      </div>

      {/* Generated Comments Section */}
      <div className="comments-section mt-4">
        <h3 className="text-md font-medium text-gray-800">
          Suggested Comments:
        </h3>
        {isLoading ? (
          <p className="text-sm text-blue-600 mt-2">Generating comments...</p>
        ) : comments.length > 0 ? (
          comments.map((comment, idx) => (
            <div
              key={idx}
              className="comment mt-2 p-3 bg-gray-100 rounded-md text-gray-700"
            >
              {comment}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            No comments available yet.
          </p>
        )}
      </div>

      <button
        onClick={() => generateComments(tone)}
        disabled={!apiKey || isLoading || capturedComments.length < 3}
        className="mt-4 w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isLoading
          ? "Generating..."
          : `Generate Comments ${
              capturedComments.length < 3 ? "(Need 3+ samples)" : ""
            }`}
      </button>
    </div>
  );
}

// Render the popup
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}

export default Popup;
