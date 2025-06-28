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
        if (data.userCommentHistory && data.userCommentHistory.length >= 6) {
          generateComments(data.userToneProfile);
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
      <div className="popup-container p-4 w-80 bg-white shadow-md rounded-lg">
        <h1 className="text-lg font-semibold text-gray-800 mb-4">
          Setup Required
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Please enter your Gemini API key to use this extension.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from{" "}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        </div>
        <button
          onClick={saveApiKey}
          disabled={!apiKey.trim()}
          className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Save API Key
        </button>
      </div>
    );
  }

  return (
    <div className="popup-container p-4 w-80 bg-white shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-lg font-semibold text-gray-800">
          LinkedIn Tone Assistant
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Settings
        </button>
      </div>
      <p className="mt-2 text-gray-600">Current Tone: {tone || "Not set"}</p>
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
        disabled={!apiKey || isLoading}
        className="mt-4 w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isLoading ? "Generating..." : "Generate Comments"}
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
