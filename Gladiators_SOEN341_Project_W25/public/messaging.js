// Initialize global variables
let socket;
let currentChannel = null;
let username = localStorage.getItem('username') || 'Anonymous';

document.addEventListener("DOMContentLoaded", function () {
    // Initialize Socket.IO connection
    socket = io("http://localhost:5000", {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // DOM elements
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");

    // Debug log socket connection status
    console.log("Socket.IO initialization started");

    // Socket event listeners
    socket.on("connect", () => {
        console.log("Connected to chat server. Socket ID:", socket.id);
        displaySystemMessage("Connected to chat server");
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from chat server");
        displaySystemMessage("Disconnected from chat server");
    });

    socket.on("message", (data) => {
        console.log("Received message:", data);
        displayMessage(data);
    });

    socket.on("message history", (messages) => {
        console.log("Received message history:", messages);
        chatMessages.innerHTML = ''; // Clear existing messages
        messages.forEach(msg => displayMessage(msg));
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
        displaySystemMessage("Error: " + error);
    });

    // Send message functionality
    function sendMessage(e) {
        e.preventDefault(); // Prevent form submission

        if (!messageInput || !currentChannel) {
            console.log("Cannot send message - missing input or channel", {
                messageInput: !!messageInput,
                currentChannel
            });
            return;
        }

        const message = messageInput.value.trim();
        if (message === "") return;

        const messageData = {
            channelId: currentChannel,
            username: username,
            message: message
        };

        console.log("Sending message:", messageData);

        socket.emit("message", messageData);
        messageInput.value = "";
    }

    // Event listeners for sending messages
    if (chatForm) {
        chatForm.addEventListener("submit", sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener("keypress", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(event);
            }
        });
    }
});

// Helper functions
function displayMessage(data) {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) {
        console.error("Chat messages container not found");
        return;
    }

    console.log("Displaying message:", data);

    const messageDiv = document.createElement("div");
    messageDiv.className = "message";

    if (data.username === username) {
        messageDiv.classList.add("own-message");
    }

    const timestamp = new Date(data.timestamp).toLocaleTimeString();

    messageDiv.innerHTML = `
        <span class="message-username">${data.username}</span>
        <span class="message-time">${timestamp}</span>
        <div class="message-content">${data.message}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displaySystemMessage(message) {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) {
        console.error("Chat messages container not found");
        return;
    }

    console.log("Displaying system message:", message);

    const messageDiv = document.createElement("div");
    messageDiv.className = "message system-message";
    messageDiv.textContent = message;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function joinChannel(channelId) {
    if (!channelId) {
        console.error("Invalid channel ID provided");
        return;
    }

    if (currentChannel === channelId) {
        console.log("Already in channel:", channelId);
        return;
    }

    console.log("Joining channel:", channelId);
    currentChannel = channelId;
    socket.emit("join channel", channelId);
    displaySystemMessage(`Joined channel ${channelId}`);
}

// Function to close the chat
function closeChat() {
    const chatArea = document.getElementById("chatArea");
    const welcomeText = document.getElementById("welcomeText");
    const startConversationText = document.getElementById("startConversationText");

    if (currentChannel) {
        socket.emit("leave channel", currentChannel);
        currentChannel = null;
    }

    if (chatArea) chatArea.style.display = "none";
    if (welcomeText) welcomeText.style.display = "block";
    if (startConversationText) startConversationText.style.display = "block";

    // Clear the chat messages
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
}

// Export functions for use in other files
window.joinChannel = joinChannel;
window.displaySystemMessage = displaySystemMessage;
window.closeChat = closeChat;