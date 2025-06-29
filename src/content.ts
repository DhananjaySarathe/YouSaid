// YouSaid Chrome Extension - Content Script for LinkedIn
let commentHistory: string[] = [];
const insertedSuggestions = new Set<string>();

// Track active comment fields and their content
const activeCommentFields = new Map<HTMLElement, string>();
let typingTimeout: number | null = null;

// Simple session tracking - one comment per typing session
let currentTypingField: HTMLElement | null = null;
let currentTypingContent = "";
let currentSessionCommentIndex = -1; // Index of comment being updated in this session

// Prevent multiple modal instances
let isShowingSuggestions = false;

// Initialize by loading existing comments
try {
  chrome.storage.local.get(["userCommentHistory"], (data) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (data.userCommentHistory && data.userCommentHistory.length > 0) {
      commentHistory = data.userCommentHistory;
      console.log("📚 Loaded existing comments:", commentHistory.length);
    } else {
      // No comments in storage - reset session state
      commentHistory = [];
      currentTypingField = null;
      currentTypingContent = "";
      currentSessionCommentIndex = -1;
      activeCommentFields.clear();
      console.log("🧹 No comments in storage - starting fresh");
    }
  });
} catch (error) {
  console.error("Error loading existing comments:", error);
}

// Helper function to count words in a text
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

// Function to capture or update a comment with simple session tracking
function captureTypedComment(commentText: string, source: string = "typing") {
  const trimmedComment = commentText.trim();
  const wordCount = countWords(trimmedComment);

  // Check if this is an AI-generated suggestion (don't capture it)
  if (insertedSuggestions.has(trimmedComment)) {
    insertedSuggestions.delete(trimmedComment);
    return;
  }

  // If too short, remove the session comment if it exists
  if (wordCount < 3) {
    if (
      currentSessionCommentIndex >= 0 &&
      currentSessionCommentIndex < commentHistory.length
    ) {
      commentHistory.splice(currentSessionCommentIndex, 1);
      currentSessionCommentIndex = -1;

      // Save to storage
      try {
        chrome.storage.local.set({ userCommentHistory: commentHistory });
      } catch {
        console.log("Extension context invalidated - please reload the page");
      }
    }
    return;
  }

  // If we're updating an existing comment in this session
  if (
    currentSessionCommentIndex >= 0 &&
    currentSessionCommentIndex < commentHistory.length
  ) {
    commentHistory[currentSessionCommentIndex] = trimmedComment;
  } else {
    // Add new comment and track it for this session
    commentHistory.push(trimmedComment);
    currentSessionCommentIndex = commentHistory.length - 1;
    console.log(
      `✅ Added new comment via ${source} (${wordCount} words):`,
      trimmedComment.substring(0, 80) + "..."
    );

    // Keep only the last 6 user comments
    if (commentHistory.length > 6) {
      const removedCount = commentHistory.length - 6;
      commentHistory = commentHistory.slice(-6);
      currentSessionCommentIndex = Math.max(
        0,
        currentSessionCommentIndex - removedCount
      );
    }
  }

  // Save to storage
  try {
    chrome.storage.local.set({ userCommentHistory: commentHistory });
    console.log(
      "💾 Saved comments to storage:",
      commentHistory.length,
      "comments"
    );
  } catch {
    console.log("Extension context invalidated - please reload the page");
    return;
  }

  // Show visual feedback
  showCaptureNotification(
    commentHistory.length,
    wordCount,
    currentSessionCommentIndex >= 0
  );
}

// Real-time typing detection in comment fields
function setupTypingDetection() {
  // Monitor all input events on the page
  document.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;

      // Ignore input events from elements inside the suggestions modal
      if (target.closest("#yousaid-suggestions")) {
        return;
      }

      // Check if this is a LinkedIn comment field
      if (
        target &&
        (target.matches(".ql-editor") ||
          target.matches('[contenteditable="true"]') ||
          target.matches("textarea") ||
          target.closest(".comments-comment-box") ||
          target.closest(".comments-comment-texteditor"))
      ) {
        const currentContent =
          target.textContent || (target as HTMLInputElement).value || "";
        const previousContent = activeCommentFields.get(target) || "";

        // Only process if content actually changed and has some length
        if (
          currentContent !== previousContent &&
          currentContent.trim().length > 0
        ) {
          console.log(
            "⌨️ User typing in comment field:",
            currentContent.length,
            "chars,",
            countWords(currentContent),
            "words"
          );

          // Update tracking
          activeCommentFields.set(target, currentContent);

          // Reset session if user switched to different field
          if (currentTypingField !== target) {
            currentSessionCommentIndex = -1;

            // Close any existing suggestions modal when switching fields
            const existingSuggestions = document.getElementById(
              "yousaid-suggestions"
            );
            if (existingSuggestions) {
              existingSuggestions.style.transform = "translateY(100px)";
              existingSuggestions.style.opacity = "0";
              setTimeout(() => {
                existingSuggestions.remove();
                isShowingSuggestions = false;
              }, 300);
            }
          }

          currentTypingField = target;
          currentTypingContent = currentContent;

          // Clear existing timeout
          if (typingTimeout) {
            clearTimeout(typingTimeout);
          }

          // Only capture after user stops typing - no immediate capture to prevent duplicates
          typingTimeout = setTimeout(() => {
            const finalContent =
              target.textContent || (target as HTMLInputElement).value || "";
            if (
              finalContent.trim().length > 0 &&
              countWords(finalContent) >= 3
            ) {
              captureTypedComment(finalContent, "typing-complete");
            }
          }, 1500);
        } else if (
          currentContent.trim().length === 0 &&
          previousContent.length > 0
        ) {
          // User cleared the field - reset tracking
          currentTypingField = null;
          currentTypingContent = "";
          currentSessionCommentIndex = -1;
        }
      }
    },
    true
  );

  // Monitor focus events to track when users enter comment fields
  document.addEventListener(
    "focus",
    (event) => {
      const target = event.target as HTMLElement;

      // Ignore focus events from elements inside the suggestions modal
      if (target.closest("#yousaid-suggestions")) {
        return;
      }

      if (
        target &&
        (target.matches(".ql-editor") ||
          target.matches('[contenteditable="true"]') ||
          target.matches("textarea") ||
          target.closest(".comments-comment-box") ||
          target.closest(".comments-comment-texteditor"))
      ) {
        // Initialize tracking for this field
        const currentContent =
          target.textContent || (target as HTMLInputElement).value || "";
        activeCommentFields.set(target, currentContent);

        // Reset session for new field
        if (currentTypingField !== target) {
          currentSessionCommentIndex = -1;

          // Close any existing suggestions modal when switching fields
          const existingSuggestions = document.getElementById(
            "yousaid-suggestions"
          );
          if (existingSuggestions) {
            existingSuggestions.style.transform = "translateY(100px)";
            existingSuggestions.style.opacity = "0";
            setTimeout(() => {
              existingSuggestions.remove();
              isShowingSuggestions = false;
            }, 300);
          }
        }

        currentTypingField = target;
        currentTypingContent = currentContent;

        // Get the post content for suggestions
        const postContent = extractPostContent(target);
        if (postContent) {
          showCommentSuggestions(target, postContent);
        }
      }
    },
    true
  );

  // Monitor blur events to finalize comment capture
  document.addEventListener(
    "blur",
    (event) => {
      const target = event.target as HTMLElement;

      // Ignore blur events from elements inside the suggestions modal
      if (target.closest("#yousaid-suggestions")) {
        return;
      }

      if (
        target === currentTypingField &&
        currentTypingContent.trim().length > 0
      ) {
        const wordCount = countWords(currentTypingContent);
        if (wordCount >= 3) {
          captureTypedComment(currentTypingContent, "field-blur");
        }
      }
    },
    true
  );
}

// Initialize typing detection when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupTypingDetection);
} else {
  setupTypingDetection();
}

// Also setup detection when new content is dynamically loaded (LinkedIn is SPA)
const pageObserver = new MutationObserver((mutations) => {
  let shouldReinitialize = false;

  mutations.forEach((mutation) => {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          // Check if new comment fields were added
          if (
            element.querySelector(
              '.ql-editor, [contenteditable="true"], .comments-comment-box'
            )
          ) {
            shouldReinitialize = true;
          }
        }
      });
    }
  });

  if (shouldReinitialize) {
    setupTypingDetection();
  }
});

pageObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

// Show a notification when a comment is captured
function showCaptureNotification(
  totalComments: number,
  wordCount: number,
  isUpdate: boolean = false
) {
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
    background: ${isUpdate ? "#f59e0b" : "#10b981"};
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
  const action = isUpdate ? "updated" : "captured";
  const icon = isUpdate ? "🔄" : "✅";

  if (needMoreComments) {
    notification.textContent = `${icon} YouSaid: Comment ${action}! (${totalComments}/6) - ${wordCount} words`;
  } else {
    notification.textContent = `${icon} YouSaid: Comment ${action}! (6/6) ✓ - ${wordCount} words - Ready!`;
  }

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

    // Combine context
    if (postText) {
      return `Post: "${postText}"`;
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
  // Prevent multiple modal instances
  if (isShowingSuggestions) {
    console.log("🚫 Suggestions already showing, ignoring duplicate request");
    return;
  }

  // Remove any existing suggestions
  const existingSuggestions = document.getElementById("yousaid-suggestions");
  if (existingSuggestions) {
    existingSuggestions.remove();
  }

  // Set flag to prevent duplicates
  isShowingSuggestions = true;

  // Check if user has API key and comments
  try {
    chrome.storage.local.get(["geminiApiKey", "userCommentHistory"], (data) => {
      if (chrome.runtime.lastError) {
        showQuickNotification(
          "Extension context invalidated - please reload the page"
        );
        isShowingSuggestions = false;
        return;
      }

      if (!data.geminiApiKey) {
        showQuickNotification("Please set your API key in YouSaid extension");
        isShowingSuggestions = false;
        return;
      }

      if (!data.userCommentHistory || data.userCommentHistory.length < 3) {
        showQuickNotification(
          "YouSaid needs 3+ sample comments to generate suggestions"
        );
        isShowingSuggestions = false;
        return;
      }

      console.log(
        "🤖 Loaded comments for AI suggestions:",
        data.userCommentHistory.length,
        "comments"
      );

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
      max-width: 420px;
      width: 420px;
      max-height: 80vh;
      overflow-y: auto;
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
      <div style="font-size: 13px; color: #a1a1aa; line-height: 1.5; background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;min-height: 80px; max-height: 100px; overflow: hidden;">
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

      // Generate suggestions
      try {
        chrome.runtime.sendMessage(
          {
            type: "generate_comments",
            post: postContent,
            previousComments: data.userCommentHistory || [],
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
    });
  } catch {
    showQuickNotification(
      "Extension context invalidated - please reload the page"
    );
    isShowingSuggestions = false;
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
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
    setTimeout(() => {
      container.remove();
      isShowingSuggestions = false; // Reset flag when modal is closed
    }, 300);
  });

  suggestions.forEach((suggestion) => {
    const suggestionElement = document.createElement("div");
    suggestionElement.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    `;

    suggestionElement.innerHTML = `
      <div style="font-size: 14px; line-height: 1.6; color: #e4e4e7;">
        ${suggestion.trim()}
      </div>
    `;

    // Add hover effect
    suggestionElement.addEventListener("mouseenter", () => {
      suggestionElement.style.background = "rgba(255, 255, 255, 0.08)";
      suggestionElement.style.borderColor = "rgba(96, 165, 250, 0.3)";
      suggestionElement.style.transform = "translateY(-2px)";
    });

    suggestionElement.addEventListener("mouseleave", () => {
      suggestionElement.style.background = "rgba(255, 255, 255, 0.05)";
      suggestionElement.style.borderColor = "rgba(255, 255, 255, 0.1)";
      suggestionElement.style.transform = "translateY(0)";
    });

    // Add click to insert
    suggestionElement.addEventListener("click", () => {
      insertSuggestion(commentField, suggestion.trim());
      container.style.transform = "translateY(100px)";
      container.style.opacity = "0";
      setTimeout(() => {
        container.remove();
        isShowingSuggestions = false; // Reset flag when suggestion is used
      }, 300);
    });

    suggestionsList?.appendChild(suggestionElement);
  });

  // Add manual comment input section
  const manualInputSection = document.createElement("div");
  manualInputSection.style.cssText = `
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  `;

  manualInputSection.innerHTML = `
    <div style="color: #a855f7; font-weight: 600; margin-bottom: 12px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
      <span>✍️</span>
      <span>Write Your Own Comment</span>
    </div>
    <textarea id="manual-comment-input" placeholder="Enter your own comment here..." style="
      width: 100%;
      min-height: 80px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 12px;
      color: #e4e4e7;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      margin-bottom: 12px;
      box-sizing: border-box;
    " rows="3"></textarea>
    <div id="manual-comment-actions" style="display: flex; gap: 8px; align-items: center;">
      <button id="correct-grammar-btn" style="
        background: linear-gradient(135deg, #8b5cf6, #a855f7);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span>📝</span>
        <span>Correct Grammar</span>
      </button>
      <button id="use-manual-comment-btn" style="
        background: linear-gradient(135deg, #10b981, #059669);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span>✅</span>
        <span>Use This Comment</span>
      </button>
    </div>
    <div id="grammar-correction-section" style="display: none; margin-top: 16px; padding: 16px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px;">
      <div style="color: #a855f7; font-weight: 600; margin-bottom: 8px; font-size: 13px;">📝 Grammar Corrected Version:</div>
      <div id="corrected-comment" style="
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 6px;
        color: #e4e4e7;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 12px;
        min-height: 40px;
      "></div>
      <div style="display: flex; gap: 8px;">
        <button id="accept-corrected-btn" style="
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        ">✅ Add Corrected Comment</button>
        <button id="discard-corrected-btn" style="
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #a1a1aa;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        ">❌ Discard</button>
      </div>
    </div>
  `;

  suggestionsList?.appendChild(manualInputSection);

  // Add event listeners for manual input functionality
  const manualCommentInput = manualInputSection.querySelector(
    "#manual-comment-input"
  ) as HTMLTextAreaElement;
  const correctGrammarBtn = manualInputSection.querySelector(
    "#correct-grammar-btn"
  ) as HTMLButtonElement;
  const useManualCommentBtn = manualInputSection.querySelector(
    "#use-manual-comment-btn"
  ) as HTMLButtonElement;
  const grammarCorrectionSection = manualInputSection.querySelector(
    "#grammar-correction-section"
  ) as HTMLElement;
  const correctedCommentDiv = manualInputSection.querySelector(
    "#corrected-comment"
  ) as HTMLElement;
  const acceptCorrectedBtn = manualInputSection.querySelector(
    "#accept-corrected-btn"
  ) as HTMLButtonElement;
  const discardCorrectedBtn = manualInputSection.querySelector(
    "#discard-corrected-btn"
  ) as HTMLButtonElement;

  // Correct Grammar functionality
  correctGrammarBtn?.addEventListener("click", async () => {
    const userComment = manualCommentInput?.value?.trim();
    if (!userComment) {
      showQuickNotification("Please enter a comment first");
      return;
    }

    correctGrammarBtn.innerHTML = `
      <div style="width: 12px; height: 12px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>Correcting...</span>
    `;
    correctGrammarBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "correct_grammar",
        comment: userComment,
      });

      if (response.success && response.correctedComment) {
        correctedCommentDiv.textContent = response.correctedComment;
        grammarCorrectionSection.style.display = "block";
      } else {
        showQuickNotification(
          "❌ Failed to correct grammar: " + (response.error || "Unknown error")
        );
      }
    } catch (error) {
      console.log("Error correcting grammar:", error);
      showQuickNotification("❌ Failed to correct grammar");
    } finally {
      correctGrammarBtn.innerHTML = `<span>📝</span><span>Correct Grammar</span>`;
      correctGrammarBtn.disabled = false;
    }
  });

  // Use manual comment directly
  useManualCommentBtn?.addEventListener("click", () => {
    const userComment = manualCommentInput?.value?.trim();
    if (!userComment) {
      showQuickNotification("Please enter a comment first");
      return;
    }

    insertSuggestion(commentField, userComment);
    container.style.transform = "translateY(100px)";
    container.style.opacity = "0";
    setTimeout(() => {
      container.remove();
      isShowingSuggestions = false;
    }, 300);
  });

  // Accept corrected comment
  acceptCorrectedBtn?.addEventListener("click", () => {
    const correctedComment = correctedCommentDiv?.textContent?.trim();
    if (correctedComment) {
      insertSuggestion(commentField, correctedComment);
      container.style.transform = "translateY(100px)";
      container.style.opacity = "0";
      setTimeout(() => {
        container.remove();
        isShowingSuggestions = false;
      }, 300);
    }
  });

  // Discard corrected comment
  discardCorrectedBtn?.addEventListener("click", () => {
    grammarCorrectionSection.style.display = "none";
    correctedCommentDiv.textContent = "";
  });
}

// Insert suggestion into comment field
function insertSuggestion(commentField: HTMLElement, suggestion: string) {
  try {
    // Track this suggestion so we don't capture it for learning
    insertedSuggestions.add(suggestion.trim());
    console.log(
      "🤖 Tracking AI suggestion to prevent capture:",
      suggestion.trim().substring(0, 50) + "..."
    );

    // Clean up old suggestions (keep only last 20 to prevent memory issues)
    if (insertedSuggestions.size > 20) {
      const suggestionsArray = Array.from(insertedSuggestions);
      insertedSuggestions.clear();
      // Keep the last 10
      suggestionsArray.slice(-10).forEach((s) => insertedSuggestions.add(s));
    }

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

    showQuickNotification("✅ Comment added!");
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
    background: #3b82f6;
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

  notification.textContent = message;
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

// Listen for messages from popup to reset session state
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "clearSession") {
    console.log(
      "🧹 CLEAR SESSION MESSAGE RECEIVED - Before:",
      commentHistory.length,
      "comments"
    );

    // Reset ALL comment data - this is the critical fix!
    commentHistory = [];

    // Reset all session tracking variables
    currentTypingField = null;
    currentTypingContent = "";
    currentSessionCommentIndex = -1;
    activeCommentFields.clear();

    // Clear any existing timeouts
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }

    console.log(
      "🔄 CLEAR SESSION COMPLETE - After:",
      commentHistory.length,
      "comments"
    );
    sendResponse({ success: true });
  }
});
