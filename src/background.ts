interface GenerateCommentsMessage {
  type: "generate_comments";
  post: string;
  previousComments: string[];
}

interface CommentResponse {
  success: boolean;
  comments?: string[];
  error?: string;
}

chrome.runtime.onMessage.addListener(
  (message: GenerateCommentsMessage, _sender, sendResponse) => {
    console.log("📨 YouSaid: Received message:", message);

    if (message.type === "generate_comments") {
      console.log("🎯 Generate comments request received");

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
        console.log("🔑 API key found, proceeding with API call");
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
      console.log("📡 API Response status:", response.status);
      console.log("📡 API Response headers:", response.headers);
      return response.json();
    })
    .then((data) => {
      console.log("✅ Gemini API Response:", JSON.stringify(data, null, 2));

      if (data.error) {
        console.error("❌ API Error:", data.error);
        sendResponse({
          success: false,
          error: `API Error: ${
            data.error.message || "Invalid API key or request"
          }`,
        });
        return;
      }

      const generatedComments =
        data.candidates?.[0]?.content?.parts?.[0]?.text
          ?.split("\n")
          .filter(Boolean) || [];

      console.log("💬 Generated comments:", generatedComments);

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
