import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function Popup() {
  const [apiKey, setApiKey] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);
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
    // Retrieve the user's comment history and API key from storage
    chrome.storage.local.get(["userCommentHistory", "geminiApiKey"], (data) => {
      if (data.geminiApiKey) {
        setApiKey(data.geminiApiKey);
      } else {
        setShowSettings(true); // Show settings if no API key
      }
      if (data.userCommentHistory) {
        setCapturedComments(data.userCommentHistory);
      }
    });
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
        },
        () => {
          setCapturedComments(validComments);
          setShowManualInput(false);
          alert(`${validComments.length} comments saved successfully!`);
        }
      );
    } else {
      alert("Please enter at least 3 comments to learn your writing style.");
    }
  };

  const editCapturedComment = (index: number, newComment: string) => {
    const updatedComments = [...capturedComments];
    updatedComments[index] = newComment;
    setCapturedComments(updatedComments);
    chrome.storage.local.set({
      userCommentHistory: updatedComments,
    });
    setEditingIndex(-1);
  };

  const deleteCapturedComment = (index: number) => {
    const updatedComments = capturedComments.filter((_, i) => i !== index);
    setCapturedComments(updatedComments);
    chrome.storage.local.set({
      userCommentHistory: updatedComments,
    });
  };

  const clearAllComments = () => {
    if (confirm("Are you sure you want to clear all captured comments?")) {
      setCapturedComments([]);

      // Clear storage completely with callback
      chrome.storage.local.set(
        {
          userCommentHistory: [],
        },
        () => {
          console.log("✅ Storage cleared successfully");

          // Notify content script to reset session state
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs
                .sendMessage(tabs[0].id, {
                  action: "clearSession",
                })
                .then(() => {
                  console.log("✅ Content script session cleared");
                })
                .catch(() => {
                  // Content script might not be loaded, that's okay
                  console.log(
                    "⚠️ Could not reach content script (probably not loaded)"
                  );
                });
            }
          });
        }
      );
    }
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
            <p>Enter at least 3 sample comments to learn your writing style</p>
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
          Save Comments & Learn Style
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

      <div className="info-card">
        <div className="info-icon">💡</div>
        <div className="info-content">
          <h3>How it works</h3>
          <p>
            YouSaid learns from your LinkedIn comments to suggest personalized
            responses when you're browsing posts
          </p>
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
              className="icon-btn"
              title="Edit comments manually"
            >
              ✏️
            </button>
            {capturedComments.length > 0 && (
              <button
                onClick={clearAllComments}
                className="icon-btn danger"
                title="Clear all comments"
              >
                🗑️
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
                Comments will be captured automatically when you post on
                LinkedIn, or add them manually
              </p>
            </div>
          )}
        </div>
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
