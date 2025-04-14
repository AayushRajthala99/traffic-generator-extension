console.log("Offscreen script loaded.");

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  // Check if the message is intended for the offscreen document and is the expected action
  if (
    message.target === "offscreen" &&
    message.action === "sendSingleRequest" &&
    message.url
  ) {
    console.log(`Offscreen: Received request for URL: ${message.url}`);
    await makeRequest(message.url);
  } else {
    // Optional: Log ignored messages for debugging
    // console.log("Offscreen: Ignored message:", message);
  }
  // Return true if async response is needed, otherwise false or undefined
  return false;
}

async function makeRequest(url) {
  console.log(`Offscreen: Attempting to fetch ${url}`);
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      // Optional: Set a timeout for the fetch request itself if needed
      // signal: AbortSignal.timeout(15000) // e.g., 15 second timeout
    });

    if (!response.ok) {
      console.error(
        `Offscreen: HTTP error for ${url}! Status: ${response.status} ${response.statusText}`
      );
      // Attempt to read body for more info even on error
      // const errorBody = await response.text().catch(e => `Could not read error body: ${e}`);
      // console.error("Offscreen: Error response body (first 500 chars):", errorBody.substring(0, 500));
    } else {
      console.log(
        `Offscreen: Successfully fetched ${url}, Status: ${response.status}`
      );
      // Optional: consume the response body to free up resources
      await response.text(); // Or response.blob(), response.json() etc.
    }
  } catch (error) {
    // Catches network errors, AbortSignal timeout, etc.
    console.error(
      `Offscreen: Network/Fetch error for ${url}:`,
      error.name === "AbortError" ? "Request timed out" : error.message
    );
  } finally {
    // IMPORTANT: Send a message back to the background script regardless of success/failure
    // This signals that processing for this URL is complete and the next one can be scheduled.
    console.log(
      `Offscreen: Finished processing ${url}. Sending requestComplete message.`
    );
    chrome.runtime.sendMessage({ action: "requestComplete" }).catch((e) => {
      // This error is critical if the background script isn't receiving the message
      console.error(
        "Offscreen: CRITICAL - Error sending requestComplete message back to background:",
        e
      );
    });
  }
}

console.log("Offscreen message listener ready.");
