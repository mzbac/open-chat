document.addEventListener("DOMContentLoaded", (event) => {
  const chatHistory = document.querySelector(".chat-history");
  const input = document.querySelector(".input-container textarea");
  const sendButton = document.querySelector(".input-container button");
  const clearButton = document.querySelector(".clear-button");
  const historyButton = document.querySelector(".history-button");
  const endpointInput = document.getElementById("endpoint");
  const stopWordInput = document.getElementById("stopWord");
  const maxTokensInput = document.getElementById("maxTokens");
  const modelInput = document.getElementById("model");
  const temperatureInput = document.getElementById("temperature");
  const topPInput = document.getElementById("topP");
  const saveSettingsButton = document.getElementById("saveSettings");
  const settingsContainer = document.querySelector(".settings-container");
  const settingsToggle = document.getElementById("settings-toggle");
  settingsToggle.addEventListener("change", () => {
    settingsContainer.classList.toggle("hidden");
  });
  const chatHistoryToggle = document.getElementById("chat-history-toggle");

  const sessionsContainer = document.querySelector(".sessions-container");
  const sessionListContainer = document.querySelector(".session-list");

  chatHistoryToggle.addEventListener("click", () => {
    sessionsContainer.classList.toggle("hidden");
  });

  let messages = JSON.parse(localStorage.getItem("chatHistory")) || [];
  let settings = JSON.parse(localStorage.getItem("settings")) || {
    endpoint: "",
    stopWord: "",
    maxTokens: 200,
    model: "meta-llama/Meta-Llama-3-8B-Instruct",
    temperature: 0.0,
    topP: 0.95,
  };

  function renderMessages() {
    if (!marked) {
      console.error("Marked library is not loaded correctly.");
      return;
    }

    chatHistory.innerHTML = messages
      .map((msg) => {
        if (msg.role === "assistant") {
          return `<div class="message ${msg.role}">${marked.parse(
            msg.content
          )}</div>`;
        } else {
          return `<div class="message ${msg.role}"><p>${msg.content}</p></div>`;
        }
      })
      .join("");
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  clearButton.addEventListener("click", () => {
    Object.keys(localStorage).forEach((key) => {
      if (key !== "settings") {
        localStorage.removeItem(key);
      }
    });
    sessionListContainer.innerHTML = ""; // Clear the sessions list display
    messages = [];
    renderMessages();
  });

  historyButton.addEventListener("click", () => {
    const now = new Date();
    const defaultSessionName = `Session ${now.getFullYear()}-${
      now.getMonth() + 1
    }-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    const sessionName = prompt(
      "Please enter a name for this session:",
      defaultSessionName
    );
    if (sessionName) {
      localStorage.setItem(sessionName, JSON.stringify(messages));
      addSessionToList(sessionName);
    }
    messages = [];
    renderMessages();
  });

  function addSessionToList(sessionName) {
    const sessionDiv = document.createElement("div");
    sessionDiv.className = "session";
    sessionDiv.textContent = sessionName;
    sessionDiv.onclick = function () {
      messages = JSON.parse(localStorage.getItem(sessionName));
      renderMessages();
    };
    sessionListContainer.appendChild(sessionDiv);
  }

  Object.keys(localStorage).forEach((key) => {
    if (key !== "settings" && key !== "chatHistory") {
      addSessionToList(key);
    }
  });

  saveSettingsButton.addEventListener("click", () => {
    settings.endpoint = endpointInput.value.trim();
    settings.stopWord = stopWordInput.value.trim();
    settings.maxTokens = parseInt(maxTokensInput.value);
    settings.model = modelInput.value.trim();
    settings.temperature = parseFloat(temperatureInput.value);
    settings.topP = parseFloat(topPInput.value);
    localStorage.setItem("settings", JSON.stringify(settings));
  });

  async function handleSendMessage() {
    const userInput = input.value.trim();
    if (userInput === "") return;

    const userMessage = { role: "user", content: userInput };
    messages.push(userMessage);
    renderMessages();
    input.value = "";

    sendButton.disabled = true;
    sendButton.textContent = "Generating...";

    try {
      const response = await fetch(settings.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer YOUR_API_KEY`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: messages, // Send the entire conversation history
          stream: true,
          stop: settings.stopWord,
          max_tokens: settings.maxTokens,
          temperature: settings.temperature,
          top_p: settings.topP,
        }),
      });

      const reader = response.body.getReader();
      let currentResponse = "";
      let initial = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        if (chunk.trim()) {
          const lines = chunk.split("\n");
          for (let line of lines) {
            if (line.startsWith("data:")) {
              if (line === "data: [DONE]") break;

              const data = JSON.parse(line.substring(5));
              if (data.choices) {
                data.choices.forEach((choice) => {
                  currentResponse += choice.delta.content;
                });
              }
            }
          }
        }
        if (initial) {
          messages.push({ role: "assistant", content: currentResponse });
          initial = false;
        } else {
          messages[messages.length - 1].content = currentResponse;
        }
        renderMessages();
      }
    } catch (error) {
      console.error("Error processing message:", error);
      messages.push({
        role: "error",
        content: "An error occurred while processing your message.",
      });
      renderMessages();
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }
  sendButton.addEventListener("click", handleSendMessage);
  renderMessages();

  // Load settings from localStorage
  endpointInput.value = settings.endpoint;
  stopWordInput.value = settings.stopWord;
  maxTokensInput.value = settings.maxTokens;
  modelInput.value = settings.model;
  temperatureInput.value = settings.temperature;
  topPInput.value = settings.topP;
});
