// Content script for LinkedIn comment tracking
let commentHistory: string[] = [];

// Initialize by loading existing comments
try {
  chrome.storage.local.get(["userCommentHistory"], (data) => {
    if (chrome.runtime.lastError) {
      console.log(
        "Chrome extension context invalidated - please reload the page"
      );
      return;
    }
    if (data.userCommentHistory) {
      commentHistory = data.userCommentHistory;
    }
  });
} catch {
  console.log("Extension context invalidated - please reload the page");
}

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
        try {
          chrome.storage.local.set({ userCommentHistory: commentHistory });
        } catch {
          console.log("Extension context invalidated - please reload the page");
          return;
        }

        // Show visual feedback
        showCaptureNotification(commentHistory.length);
      }
    }
  }
});

// Show a notification when a comment is captured
function showCaptureNotification(totalComments: number) {
  // Remove any existing notification
  const existingNotification = document.getElementById("yousaid-notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.id = "yousaid-notification";
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
    ? `YouSaid: Comment captured! (${totalComments}/6)`
    : `YouSaid: Comment captured! (${totalComments}) ✓`;

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
  const existingSuggestions = document.getElementById("yousaid-suggestions");
  if (existingSuggestions) {
    existingSuggestions.remove();
  }

  // Check if user has API key and comments
  try {
    chrome.storage.local.get(
      ["geminiApiKey", "userToneProfile", "userCommentHistory"],
      (data) => {
        if (chrome.runtime.lastError) {
          showQuickNotification(
            "Extension context invalidated - please reload the page"
          );
          return;
        }

        if (!data.geminiApiKey) {
          showQuickNotification("Please set your API key in YouSaid extension");
          return;
        }

        if (!data.userCommentHistory || data.userCommentHistory.length < 3) {
          showQuickNotification(
            "YouSaid needs 3+ sample comments to generate suggestions"
          );
          return;
        }

        // Create suggestions container
        const suggestionsContainer = document.createElement("div");
        suggestionsContainer.id = "yousaid-suggestions";
        suggestionsContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 1px solid #404040;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 10000;
      max-width: 380px;
      width: 380px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      backdrop-filter: blur(10px);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;

        // Add loading state
        suggestionsContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; color: #60a5fa; font-weight: 600; margin-bottom: 16px; font-size: 16px;">
        <div style="width: 20px; height: 20px; border: 2px solid #60a5fa; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span style="background: linear-gradient(135deg, #60a5fa, #a855f7); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          YouSaid AI
        </span>
      </div>
      <div style="font-size: 13px; color: #a1a1aa; line-height: 1.5; background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; max-height: 60px; overflow: hidden;">
        📝 ${postContent.substring(0, 120)}${
          postContent.length > 120 ? "..." : ""
        }
      </div>
      <div style="text-align: center; color: #71717a; font-size: 12px;">
        Generating personalized suggestions...
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;

        document.body.appendChild(suggestionsContainer);

        // Animate in
        setTimeout(() => {
          suggestionsContainer.style.transform = "translateY(0)";
          suggestionsContainer.style.opacity = "1";
        }, 100);

        document.body.appendChild(suggestionsContainer);

        // Generate suggestions
        try {
          chrome.runtime.sendMessage(
            {
              type: "generate_comments",
              post: postContent,
              tone: data.userToneProfile || "professional",
            },
            (response) => {
              if (chrome.runtime.lastError) {
                suggestionsContainer.innerHTML = `
                <div style="color: #d32f2f; font-weight: 500; margin-bottom: 8px;">
                  ❌ Extension context invalidated
                </div>
                <div style="font-size: 12px; color: #666;">
                  Please reload the page and try again
                </div>
              `;
                return;
              }

              if (response.success && response.comments) {
                displaySuggestions(
                  suggestionsContainer,
                  response.comments,
                  commentField,
                  postContent
                );
              } else {
                suggestionsContainer.innerHTML = `
          <div style="color: #f87171; font-weight: 600; margin-bottom: 12px; font-size: 16px;">
            ❌ Error generating suggestions
          </div>
          <div style="font-size: 13px; color: #a1a1aa; background: rgba(248, 113, 113, 0.1); padding: 12px; border-radius: 8px;">
            ${response.error || "Unknown error occurred"}
          </div>
        `;
              }
            }
          );
        } catch {
          suggestionsContainer.innerHTML = `
           <div style="color: #d32f2f; font-weight: 500; margin-bottom: 8px;">
             ❌ Extension context invalidated
           </div>
           <div style="font-size: 12px; color: #666;">
             Please reload the page and try again
           </div>
         `;
        }
      }
    );
  } catch {
    showQuickNotification(
      "Extension context invalidated - please reload the page"
    );
  }
}

// Display generated suggestions
function displaySuggestions(
  container: HTMLElement,
  suggestions: string[],
  commentField: HTMLElement,
  postContent: string
) {
  container.innerHTML = `
    <div style="display: flex; justify-between; align-items: center; margin-bottom: 16px;">
      <div style="color: #60a5fa; font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px;">
        <span style="background: linear-gradient(135deg, #60a5fa, #a855f7); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          🤖 YouSaid AI
        </span>
      </div>
              <button id="yousaid-close" style="
        background: rgba(255, 255, 255, 0.1); 
        border: 1px solid rgba(255, 255, 255, 0.2); 
        color: #a1a1aa; 
        cursor: pointer; 
        width: 32px; 
        height: 32px; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'; this.style.color='white';" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.color='#a1a1aa';">×</button>
    </div>
    <div style="font-size: 12px; color: #71717a; margin-bottom: 16px; background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 8px; max-height: 40px; overflow: hidden;">
      📝 ${postContent.substring(0, 100)}${
    postContent.length > 100 ? "..." : ""
  }
    </div>
    <div id="suggestions-list"></div>
  `;

  const suggestionsList = container.querySelector("#suggestions-list");
  const closeButton = container.querySelector("#yousaid-close");

  // Add close functionality
  closeButton?.addEventListener("click", () => {
    container.style.transform = "translateY(100px)";
    container.style.opacity = "0";
    setTimeout(() => container.remove(), 300);
  });

  // Add suggestions
  suggestions.forEach((suggestion) => {
    if (suggestion.trim()) {
      const suggestionElement = document.createElement("div");
      suggestionElement.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-size: 14px;
        line-height: 1.5;
        color: #e5e5e5;
        position: relative;
        overflow: hidden;
      `;

      // Add hover gradient effect
      suggestionElement.innerHTML = `
        <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(168, 85, 247, 0.1)); opacity: 0; transition: opacity 0.3s ease; border-radius: 12px;"></div>
        <div style="position: relative; z-index: 1;">${suggestion.trim()}</div>
      `;

      // Add hover effect
      suggestionElement.addEventListener("mouseenter", () => {
        suggestionElement.style.background = "rgba(255, 255, 255, 0.1)";
        suggestionElement.style.borderColor = "rgba(96, 165, 250, 0.5)";
        suggestionElement.style.transform = "translateY(-2px)";
        const gradient = suggestionElement.querySelector("div") as HTMLElement;
        if (gradient) gradient.style.opacity = "1";
      });

      suggestionElement.addEventListener("mouseleave", () => {
        suggestionElement.style.background = "rgba(255, 255, 255, 0.05)";
        suggestionElement.style.borderColor = "rgba(255, 255, 255, 0.1)";
        suggestionElement.style.transform = "translateY(0)";
        const gradient = suggestionElement.querySelector("div") as HTMLElement;
        if (gradient) gradient.style.opacity = "0";
      });

      // Add click to insert
      suggestionElement.addEventListener("click", () => {
        insertSuggestion(commentField, suggestion.trim());
        container.style.transform = "translateY(100px)";
        container.style.opacity = "0";
        setTimeout(() => container.remove(), 300);
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
