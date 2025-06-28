// Content script for LinkedIn comment tracking
let commentHistory: string[] = [];

// Initialize by loading existing comments
chrome.storage.local.get(["userCommentHistory"], (data) => {
  if (data.userCommentHistory) {
    commentHistory = data.userCommentHistory;
  }
});

// Listen for focus events on LinkedIn comment areas
document.addEventListener(
  "focus",
  (event) => {
    const target = event.target as HTMLElement;

    // Check if user focused on a comment input
    if (
      target &&
      target.matches(
        '[data-artdeco-is-focused="true"], .ql-editor, [contenteditable="true"]'
      )
    ) {
      // Get the post content for this comment field
      const postContent = extractPostContent(target);
      if (postContent) {
        showCommentSuggestions(target, postContent);
      }
    }
  },
  true
);

// Listen for input events on LinkedIn comment areas (for learning)
document.addEventListener("input", (event) => {
  const target = event.target as HTMLElement;

  // Check if the target is a LinkedIn comment input
  if (
    target &&
    target.matches(
      '[data-artdeco-is-focused="true"], .ql-editor, [contenteditable="true"]'
    )
  ) {
    const textContent = target.textContent || "";
    if (textContent.trim().length > 15) {
      // Increased minimum length for better quality
      // Check if this comment is different from the last one
      if (
        commentHistory.length === 0 ||
        commentHistory[commentHistory.length - 1] !== textContent.trim()
      ) {
        commentHistory.push(textContent.trim());

        // Keep only the last 10 comments
        if (commentHistory.length > 10) {
          commentHistory = commentHistory.slice(-10);
        }

        // Save to storage
        chrome.storage.local.set({ userCommentHistory: commentHistory });

        // Show visual feedback
        showCaptureNotification(commentHistory.length);
      }
    }
  }
});

// Show a notification when a comment is captured
function showCaptureNotification(totalComments: number) {
  // Remove any existing notification
  const existingNotification = document.getElementById("echotype-notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.id = "echotype-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    opacity: 0;
    transform: translateX(100px);
    transition: all 0.3s ease;
  `;

  const needMoreComments = totalComments < 6;
  notification.textContent = needMoreComments
    ? `EchoType: Comment captured! (${totalComments}/6)`
    : `EchoType: Comment captured! (${totalComments}) ✓`;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";
  }, 100);

  // Animate out and remove
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100px)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Extract post content from the LinkedIn post
function extractPostContent(commentField: HTMLElement): string | null {
  try {
    // Find the parent post container
    let postContainer =
      commentField.closest("[data-urn]") ||
      commentField.closest(".feed-shared-update-v2") ||
      commentField.closest(".occludable-update");

    if (!postContainer) {
      // Try to find post container by going up the DOM
      let current = commentField.parentElement;
      let attempts = 0;
      while (current && attempts < 10) {
        if (
          current.querySelector(
            ".feed-shared-text, .feed-shared-inline-show-more-text"
          )
        ) {
          postContainer = current;
          break;
        }
        current = current.parentElement;
        attempts++;
      }
    }

    if (!postContainer) return null;

    // Extract post text
    const postTextElement = postContainer.querySelector(
      ".feed-shared-text, .feed-shared-inline-show-more-text, .feed-shared-update-v2__description"
    );

    let postText = "";
    if (postTextElement) {
      postText = postTextElement.textContent?.trim() || "";
    }

    // Extract author name
    const authorElement = postContainer.querySelector(
      ".feed-shared-actor__name, .feed-shared-update-v2__actor-name"
    );
    const authorName = authorElement?.textContent?.trim() || "Someone";

    // Combine context
    if (postText) {
      return `${authorName} posted: "${postText}"`;
    }

    return null;
  } catch (error) {
    console.log("Error extracting post content:", error);
    return null;
  }
}

// Show comment suggestions overlay
function showCommentSuggestions(
  commentField: HTMLElement,
  postContent: string
) {
  // Remove any existing suggestions
  const existingSuggestions = document.getElementById("echotype-suggestions");
  if (existingSuggestions) {
    existingSuggestions.remove();
  }

  // Check if user has API key and comments
  chrome.storage.local.get(
    ["geminiApiKey", "userToneProfile", "userCommentHistory"],
    (data) => {
      if (!data.geminiApiKey) {
        showQuickNotification("Please set your API key in EchoType extension");
        return;
      }

      if (!data.userCommentHistory || data.userCommentHistory.length < 3) {
        showQuickNotification(
          "EchoType needs 3+ sample comments to generate suggestions"
        );
        return;
      }

      // Create suggestions container
      const suggestionsContainer = document.createElement("div");
      suggestionsContainer.id = "echotype-suggestions";
      suggestionsContainer.style.cssText = `
      position: absolute;
      background: white;
      border: 2px solid #0073b1;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

      // Position the container near the comment field
      const rect = commentField.getBoundingClientRect();
      suggestionsContainer.style.left = `${rect.left}px`;
      suggestionsContainer.style.top = `${rect.bottom + 5}px`;

      // Add loading state
      suggestionsContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #0073b1; font-weight: 500; margin-bottom: 8px;">
        <div style="width: 16px; height: 16px; border: 2px solid #0073b1; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        EchoType generating suggestions...
      </div>
      <div style="font-size: 12px; color: #666; max-height: 60px; overflow: hidden;">
        Post: ${postContent.substring(0, 150)}${
        postContent.length > 150 ? "..." : ""
      }
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;

      document.body.appendChild(suggestionsContainer);

      // Generate suggestions
      chrome.runtime.sendMessage(
        {
          type: "generate_comments",
          post: postContent,
          tone: data.userToneProfile || "professional",
        },
        (response) => {
          if (response.success && response.comments) {
            displaySuggestions(
              suggestionsContainer,
              response.comments,
              commentField,
              postContent
            );
          } else {
            suggestionsContainer.innerHTML = `
          <div style="color: #d32f2f; font-weight: 500; margin-bottom: 8px;">
            ❌ Error generating suggestions
          </div>
          <div style="font-size: 12px; color: #666;">
            ${response.error || "Unknown error occurred"}
          </div>
        `;
          }
        }
      );
    }
  );
}

// Display generated suggestions
function displaySuggestions(
  container: HTMLElement,
  suggestions: string[],
  commentField: HTMLElement,
  postContent: string
) {
  container.innerHTML = `
    <div style="display: flex; justify-between; align-items: center; margin-bottom: 12px;">
      <div style="color: #0073b1; font-weight: 600; font-size: 14px;">
        🤖 EchoType Suggestions
      </div>
      <button id="echotype-close" style="background: none; border: none; color: #666; cursor: pointer; font-size: 18px;">×</button>
    </div>
    <div style="font-size: 11px; color: #666; margin-bottom: 8px; max-height: 40px; overflow: hidden;">
      Post: ${postContent.substring(0, 120)}${
    postContent.length > 120 ? "..." : ""
  }
    </div>
    <div id="suggestions-list"></div>
  `;

  const suggestionsList = container.querySelector("#suggestions-list");
  const closeButton = container.querySelector("#echotype-close");

  // Add close functionality
  closeButton?.addEventListener("click", () => {
    container.remove();
  });

  // Add suggestions
  suggestions.forEach((suggestion) => {
    if (suggestion.trim()) {
      const suggestionElement = document.createElement("div");
      suggestionElement.style.cssText = `
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        line-height: 1.4;
      `;

      suggestionElement.textContent = suggestion.trim();

      // Add hover effect
      suggestionElement.addEventListener("mouseenter", () => {
        suggestionElement.style.background = "#e3f2fd";
        suggestionElement.style.borderColor = "#0073b1";
      });

      suggestionElement.addEventListener("mouseleave", () => {
        suggestionElement.style.background = "#f8f9fa";
        suggestionElement.style.borderColor = "#e0e0e0";
      });

      // Add click to insert
      suggestionElement.addEventListener("click", () => {
        insertSuggestion(commentField, suggestion.trim());
        container.remove();
      });

      suggestionsList?.appendChild(suggestionElement);
    }
  });
}

// Insert suggestion into comment field
function insertSuggestion(commentField: HTMLElement, suggestion: string) {
  try {
    if (commentField.contentEditable === "true") {
      // For contenteditable elements
      commentField.textContent = suggestion;
      commentField.focus();

      // Trigger input event to notify LinkedIn
      const inputEvent = new Event("input", { bubbles: true });
      commentField.dispatchEvent(inputEvent);
    } else if (
      commentField instanceof HTMLTextAreaElement ||
      commentField instanceof HTMLInputElement
    ) {
      // For textarea/input elements
      commentField.value = suggestion;
      commentField.focus();

      // Trigger input event
      const inputEvent = new Event("input", { bubbles: true });
      commentField.dispatchEvent(inputEvent);
    }

    showQuickNotification("✅ Comment suggestion inserted!");
  } catch (error) {
    console.log("Error inserting suggestion:", error);
    showQuickNotification("❌ Failed to insert suggestion");
  }
}

// Show quick notification
function showQuickNotification(message: string) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #0073b1;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 10000;
    opacity: 0;
    transform: translateX(100px);
    transition: all 0.3s ease;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";
  }, 100);

  // Remove after delay
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100px)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2500);
}

// Analyze user's writing style after collecting enough samples
chrome.storage.local.get(["userCommentHistory"], (data) => {
  if (data.userCommentHistory && data.userCommentHistory.length >= 6) {
    analyzeWritingTone(data.userCommentHistory);
  }
});

function analyzeWritingTone(comments: string[]) {
  // Simple tone analysis based on patterns
  let tone = "professional";

  const casualWords = ["awesome", "cool", "great", "love", "amazing"];
  const professionalWords = [
    "pleased",
    "excellent",
    "appreciate",
    "congratulations",
    "insights",
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

  // Save the detected tone
  chrome.storage.local.set({ userToneProfile: tone });
}
