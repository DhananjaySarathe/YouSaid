// Content script for LinkedIn comment tracking
let commentHistory: string[] = [];

// Initialize by loading existing comments
chrome.storage.local.get(["userCommentHistory"], (data) => {
  if (data.userCommentHistory) {
    commentHistory = data.userCommentHistory;
  }
});

// Listen for input events on LinkedIn comment areas
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
