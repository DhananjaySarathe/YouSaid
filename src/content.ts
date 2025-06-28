// Content script for LinkedIn comment tracking
let commentHistory: string[] = [];

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
    if (textContent.trim().length > 10) {
      commentHistory.push(textContent.trim());

      // Keep only the last 10 comments
      if (commentHistory.length > 10) {
        commentHistory = commentHistory.slice(-10);
      }

      // Save to storage
      chrome.storage.local.set({ userCommentHistory: commentHistory });
    }
  }
});

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
