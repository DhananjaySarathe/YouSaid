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
  const [hoveredComment, setHoveredComment] = useState<number>(-1);

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

  const getToneIcon = (toneText: string) => {
    if (toneText.includes("casual")) return "😊";
    if (toneText.includes("professional")) return "💼";
    return "⚖️";
  };

  if (showSettings) {
    return (
      <div className="modern-popup">
        <div className="popup-header">
          <div className="header-title">
            <div className="title-icon">🔐</div>
            <h1>API Setup</h1>
          </div>
        </div>

        <div className="info-card">
          <div className="info-icon">🤖</div>
          <div className="info-content">
            <h3>Gemini API Required</h3>
            <p>Enter your API key to enable AI-powered comment suggestions</p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <span className="label-icon">🗝️</span>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key..."
            className="form-input"
          />
          <div className="form-help">
            <span>Get your key from </span>
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="help-link"
            >
              Google AI Studio
            </a>
          </div>
        </div>

        <button
          onClick={saveApiKey}
          disabled={!apiKey.trim()}
          className="btn-primary full-width"
        >
          <span className="btn-icon">💾</span>
          Save API Key
        </button>
      </div>
    );
  }

  if (showManualInput) {
    return (
      <div className="modern-popup">
        <div className="popup-header">
          <div className="header-title">
            <div className="title-icon">✨</div>
            <h1>Manual Input</h1>
          </div>
          <button
            onClick={() => setShowManualInput(false)}
            className="btn-ghost"
          >
            <span className="btn-icon">←</span>
            Back
          </button>
        </div>

        <div className="info-card">
          <div className="info-icon">💭</div>
          <div className="info-content">
            <h3>Comment Analysis</h3>
            <p>
              Enter at least 3 sample comments to analyze your writing style
            </p>
          </div>
        </div>

        <div className="comments-input-grid">
          {manualComments.map((comment, idx) => (
            <div key={idx} className="comment-input-group">
              <label className="comment-label">
                <span
                  className={`comment-number ${
                    idx < 3 ? "required" : "optional"
                  }`}
                >
                  {idx + 1}
                </span>
                Comment {idx + 1}
                {idx < 3 && <span className="required-badge">Required</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => {
                  const updatedComments = [...manualComments];
                  updatedComments[idx] = e.target.value;
                  setManualComments(updatedComments);
                }}
                placeholder={`Enter your sample LinkedIn comment ${idx + 1}...`}
                className="comment-textarea"
                rows={3}
              />
            </div>
          ))}
        </div>

        <button onClick={saveManualComments} className="btn-primary full-width">
          <span className="btn-icon">🚀</span>
          Save Comments & Analyze Style
        </button>
      </div>
    );
  }

  return (
    <div className="modern-popup">
      <div className="popup-header">
        <div className="header-title">
          <div className="title-icon">🤖</div>
          <h1>YouSaid AI</h1>
        </div>
        <button onClick={() => setShowSettings(true)} className="btn-ghost">
          <span className="btn-icon">⚙️</span>
        </button>
      </div>

      {/* Tone Display */}
      <div className="tone-card">
        <div className="tone-icon">{getToneIcon(tone)}</div>
        <div className="tone-content">
          <span className="tone-label">Current Tone</span>
          <span className={`tone-value ${tone ? "" : "not-set"}`}>
            {tone || "Not analyzed yet"}
          </span>
        </div>
      </div>

      {/* Captured Comments Section */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon">💬</span>
            <h2>Captured Comments</h2>
            <div className="comment-badge">{capturedComments.length}</div>
          </div>
          <div className="section-actions">
            <button
              onClick={() => {
                const existingComments = [...capturedComments];
                while (existingComments.length < 6) {
                  existingComments.push("");
                }
                setManualComments(existingComments.slice(0, 6));
                setShowManualInput(true);
              }}
              className="btn-secondary"
            >
              <span className="btn-icon">✏️</span>
              Edit Manual
            </button>
            {capturedComments.length > 0 && (
              <button onClick={clearAllComments} className="btn-danger">
                <span className="btn-icon">🗑️</span>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="comments-container">
          {capturedComments.length > 0 ? (
            capturedComments.map((comment, idx) => (
              <div
                key={idx}
                className="comment-item"
                onMouseEnter={() => setHoveredComment(idx)}
                onMouseLeave={() => setHoveredComment(-1)}
              >
                {editingIndex === idx ? (
                  <div className="comment-edit">
                    <textarea
                      defaultValue={comment}
                      className="edit-textarea"
                      rows={3}
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
                    <div className="edit-actions">
                      <button
                        onClick={(e) => {
                          const textarea = e.currentTarget.parentElement
                            ?.previousElementSibling as HTMLTextAreaElement;
                          editCapturedComment(idx, textarea.value);
                        }}
                        className="btn-success"
                      >
                        <span className="btn-icon">✓</span>
                        Save
                      </button>
                      <button
                        onClick={() => setEditingIndex(-1)}
                        className="btn-ghost"
                      >
                        <span className="btn-icon">×</span>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="comment-text">
                      {hoveredComment === idx || comment.length <= 70
                        ? comment
                        : `${comment.substring(0, 70)}...`}
                    </div>
                    <div className="comment-actions">
                      <button
                        onClick={() => setEditingIndex(idx)}
                        className="action-btn edit"
                        title="Edit comment"
                      >
                        <span className="btn-icon">✏️</span>
                      </button>
                      <button
                        onClick={() => deleteCapturedComment(idx)}
                        className="action-btn delete"
                        title="Delete comment"
                      >
                        <span className="btn-icon">🗑️</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>No Comments Yet</h3>
              <p>
                Comments will appear here as you type on LinkedIn or add them
                manually
              </p>
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestions Section */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon">✨</span>
            <h2>AI Suggestions</h2>
            {comments.length > 0 && (
              <div className="comment-badge">{comments.length}</div>
            )}
          </div>
        </div>

        <div className="suggestions-container">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <div className="loading-text">
                <h3>Generating Comments...</h3>
                <p>AI is analyzing your tone and creating suggestions</p>
              </div>
            </div>
          ) : comments.length > 0 ? (
            comments.map((comment, idx) => (
              <div key={idx} className="suggestion-item">
                <div className="suggestion-header">
                  <span className="suggestion-number">{idx + 1}</span>
                  <button
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(comment);
                      // Could add a toast notification here
                    }}
                    title="Copy to clipboard"
                  >
                    <span className="btn-icon">📋</span>
                  </button>
                </div>
                <div className="suggestion-text">{comment}</div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h3>Ready to Generate</h3>
              <p>
                Click the button below to get AI-powered comment suggestions
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => generateComments(tone)}
          disabled={!apiKey || isLoading || capturedComments.length < 3}
          className={`btn-primary full-width ${isLoading ? "loading" : ""}`}
          style={{ marginTop: "16px" }}
        >
          {isLoading ? (
            <>
              <div className="btn-spinner"></div>
              Generating...
            </>
          ) : (
            <>
              <span className="btn-icon">🚀</span>
              {capturedComments.length < 3
                ? `Generate Comments (Need ${
                    3 - capturedComments.length
                  } more samples)`
                : "Generate Comments"}
            </>
          )}
        </button>
      </div>
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
