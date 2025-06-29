interface GenerateCommentsMessage {
  type: "generate_comments";
  post: string;
  previousComments: string[];
}

interface CorrectGrammarMessage {
  type: "correct_grammar";
  comment: string;
}

interface CommentResponse {
  success: boolean;
  comments?: string[];
  error?: string;
}

interface GrammarResponse {
  success: boolean;
  correctedComment?: string;
  error?: string;
}

chrome.runtime.onMessage.addListener(
  (
    message: GenerateCommentsMessage | CorrectGrammarMessage,
    _sender,
    sendResponse
  ) => {
    if (message.type === "generate_comments") {
      // Get API key from user's local storage
      chrome.storage.local.get(["geminiApiKey"], (result) => {
        if (!result.geminiApiKey) {
          console.warn("⚠️ No API key found");
          sendResponse({
            success: false,
            error: "Please set your Gemini API key in the extension settings",
          });
          return;
        }
        callGeminiWithUserKey(message, result.geminiApiKey, sendResponse);
      });
      return true;
    } else if (message.type === "correct_grammar") {
      // Handle grammar correction
      chrome.storage.local.get(["geminiApiKey"], (result) => {
        if (!result.geminiApiKey) {
          console.warn("⚠️ No API key found");
          sendResponse({
            success: false,
            error: "Please set your Gemini API key in the extension settings",
          });
          return;
        }
        correctGrammarWithUserKey(message, result.geminiApiKey, sendResponse);
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
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Write 3 short, human-sounding LinkedIn comments for the following post. 
The comments should be similar in style, tone, and punctuation as the previous comments made by the user.
Use these previous comments as a reference for how the user writes:
${message.previousComments
  .map((comment, idx) => `${idx + 1}. "${comment}"`)
  .join("\n")}
Ensure that the comments sound like they were written by the user, reflecting their unique style. If the user doesn't use full stops, commas, or other punctuation, then **don't** use them in the new comments either.

Make the comments fit the tone of this post:
"${message.post}"

Write each comment on a separate line. Make sure to keep the writing natural and conversational, just like the user would write.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7, // Controls randomness, you can tweak this for better responses
      maxOutputTokens: 200,
    },
  };

  fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }
      return response.json();
    })
    .then((data) => {
      if (data.error) {
        console.error("❌ API Error:", data.error);
        // Better error handling - try different error message properties
        let errorMessage = "Invalid API key or request";
        if (data.error) {
          if (typeof data.error === "string") {
            errorMessage = data.error;
          } else if (data.error.message) {
            errorMessage = data.error.message;
          } else if (data.error.details) {
            errorMessage = data.error.details;
          } else {
            errorMessage = JSON.stringify(data.error);
          }
        }
        sendResponse({
          success: false,
          error: `API Error: ${errorMessage}`,
        });
        return;
      }

      const generatedComments =
        data.candidates?.[0]?.content?.parts?.[0]?.text
          ?.split("\n")
          .filter(Boolean) || [];

      sendResponse({
        success: true,
        comments: generatedComments,
      });
    })
    .catch((error) => {
      console.error("🚨 Fetch Error:", error);
      sendResponse({ success: false, error: error.message });
    });
}

// Call Gemini API for grammar correction
function correctGrammarWithUserKey(
  message: CorrectGrammarMessage,
  apiKey: string,
  sendResponse: (response: GrammarResponse) => void
) {
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `Please correct ONLY the grammar and spelling errors in the following comment. Do not change the meaning, tone, style, or content in any way. Keep the exact same words and structure, just fix grammar and spelling mistakes:

"${message.comment}"

Return only the corrected version, nothing else.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Very low temperature for consistent grammar correction
      maxOutputTokens: 150,
    },
  };

  fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} ${response.statusText}`
        );
      }
      return response.json();
    })
    .then((data) => {
      if (data.error) {
        console.error("❌ API Error:", data.error);
        // Better error handling - try different error message properties
        let errorMessage = "Invalid API key or request";
        if (data.error) {
          if (typeof data.error === "string") {
            errorMessage = data.error;
          } else if (data.error.message) {
            errorMessage = data.error.message;
          } else if (data.error.details) {
            errorMessage = data.error.details;
          } else {
            errorMessage = JSON.stringify(data.error);
          }
        }
        sendResponse({
          success: false,
          error: `API Error: ${errorMessage}`,
        });
        return;
      }

      const correctedComment =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (correctedComment) {
        sendResponse({
          success: true,
          correctedComment: correctedComment,
        });
      } else {
        sendResponse({
          success: false,
          error: "No correction received from API",
        });
      }
    })
    .catch((error) => {
      console.error("🚨 Fetch Error:", error);
      sendResponse({ success: false, error: error.message });
    });
}
