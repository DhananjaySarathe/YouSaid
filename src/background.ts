interface GenerateCommentsMessage {
  type: "generate_comments";
  post: string;
  tone: string;
}

interface CommentResponse {
  success: boolean;
  comments?: string[];
  error?: string;
}

chrome.runtime.onMessage.addListener(
  (message: GenerateCommentsMessage, _sender, sendResponse) => {
    if (message.type === "generate_comments") {
      // Get API key from user's local storage
      chrome.storage.local.get(["geminiApiKey"], (result) => {
        if (!result.geminiApiKey) {
          sendResponse({
            success: false,
            error: "Please set your Gemini API key in the extension settings",
          });
          return;
        }
        callGeminiWithUserKey(message, result.geminiApiKey, sendResponse);
      });
      return true;
    }
  }
);

// Call Gemini API with user's API key
function callGeminiWithUserKey(
  message: GenerateCommentsMessage,
  apiKey: string,
  sendResponse: (response: CommentResponse) => void
) {
  fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Write 3 short, human-sounding LinkedIn comments for the following post. Each comment should be on a separate line. Make them ${message.tone} in style. Post: "${message.post}"`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      }),
    }
  )
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        sendResponse({
          success: false,
          error: `API Error: ${
            data.error.message || "Invalid API key or request"
          }`,
        });
        return;
      }

      sendResponse({
        success: true,
        comments:
          data.candidates?.[0]?.content?.parts?.[0]?.text
            ?.split("\n")
            .filter(Boolean) || [],
      });
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
}
