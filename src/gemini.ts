const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with your Gemini API key

// Function to get tone summary
export const getToneSummary = (comments: string[]): Promise<string> => {
  return fetch(
    "https://api.googleapis.com/v1alpha/generativeai/text:generate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Summarize the tone of the following 6 comments:\n\n${comments.join(
          "\n"
        )}`,
        maxOutputTokens: 100,
      }),
    }
  )
    .then((res) => res.json())
    .then((data) => data.choices[0].text);
};

// Function to generate comment suggestions based on tone
export const generateComments = (
  post: string,
  tone: string
): Promise<string[]> => {
  return fetch(
    "https://api.googleapis.com/v1alpha/generativeai/text:generate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Write 3 short, human-sounding LinkedIn comments for the following post. Post: "${post}" Tone: "${tone}"`,
        maxOutputTokens: 200,
      }),
    }
  )
    .then((res) => res.json())
    .then((data) => data.choices[0].text.split("\n"));
};
