# AI Mock Interview Simulator

This application uses Google's Gemini Models, specifically combining reasoning models with native audio (`gemini-3.1-flash-tts-preview`) to completely simulate an entire interview panel.

## Key Design Constraints & Things You Should Know Before Deployment

I've pushed several critical patches before your GitHub export, but here are the overarching issues you must keep in mind if you plan to launch this publicly or for production use:

### 1. The API Security Flaw (CRITICAL FOR DEPLOYMENT)
Currently, in this sandbox environment, the \`GEMINI_API_KEY\` is loaded via \`process.env\` but evaluated **client-side** inside the React app (\`AIService.ts\`). 
If you export this to GitHub and deploy it directly on a static site host (like Vercel or Netlify) without modifications, **your API key will be exposed in the Javascript bundle.**
*   **The Fix:** Before launching this to real users, you MUST create a backend layer. Move the logic in \`src/services/aiService.ts\` to a Node/Express server or Next.js API route. Make your React frontend call your backend, and let your backend securely call Gemini.

### 2. The Browser "Voice Search" Wildcard
The "Audio Input" (Speech-to-Text) microphone uses the native \`window.SpeechRecognition\` API. 
*   **The Issue:** This API is highly experimental. It works flawlessly in Google Chrome but is completely missing in Firefox and is occasionally spotty in Safari. 
*   **The Fix in place:** I have added graceful degradation. If someone clicks the Mic button on Firefox, they won't crash; they will get a warning telling them to type or switch to Chrome.
*   **Production Fix:** For a 100% cross-browser voice app, you should strip out \`window.SpeechRecognition\` and instead record the raw audio via \`MediaRecorder\`, send it to a backend, and transcribe it using an API like Whisper or Gemini's Audio API.

### 3. Latency & Token Bloat
If a user uploads a large PDF resume, its entire base64 string is included in the payload. At the time of this app's creation, I optimized the code to resend this file payload during every turn of the chat so the interviewers never "forget" their resume context.
*   **The Issue:** Gemini handles massive context windows easily, but resending a massive Base64 PDF document on *every single chat turn* increases network latency and wastes your token quota very quickly as the document gets re-processed.
*   **The Fix:** During production, extract the text from the PDF locally using a library like `pdf.js` *before* sending it to Gemini, or use the Gemini `File API` backend to upload the document once and reference its file URI dynamically.

### 4. Apple Safari Restrictions
Mobile Safari aggressively pauses \`AudioContext\` and auto-playing videos.
*   **The Fix in place:** We added the "Join Conference" overlay, which strictly obeys the "Must require user gesture" rule. However, on iOS, the \`AudioContext.decodeAudioData\` step can still be highly fickle depending on the encoding formats returned by Gemini TTS. If it fails, our new fallback kicks in successfully.
