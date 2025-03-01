// Initialize global variables
let socket;
let currentChannel = null;
let username = localStorage.getItem('username') || 'Anonymous';

document.addEventListener("DOMContentLoaded", function () {
    // Ensure username is set properly at initialization
    username = localStorage.getItem('username') || 'Anonymous';
    console.log("Current username:", username);

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
    const chatArea = document.getElementById("chatArea");
    const welcomeText = document.getElementById("welcomeText");
    const startConversationText = document.getElementById("startConversationText");

    // Check for channel selected from admin page
    const selectedChannelId = localStorage.getItem('selectedChannelId');
    const selectedChannelName = localStorage.getItem('selectedChannelName');

    // Debug log socket connection status
    console.log("Socket.IO initialization started");

    // Socket event listeners
    socket.on("connect", () => {
        console.log("Connected to chat server. Socket ID:", socket.id);
        displaySystemMessage("Connected to chat server");

        // If there's a channel selected from admin page, join it immediately
        if (selectedChannelId && chatArea) {
            console.log("Auto-joining channel from admin page:", selectedChannelId);
            joinChannel(selectedChannelId);

            // Update UI
            chatArea.style.display = 'flex';
            if (welcomeText) welcomeText.style.display = 'none';
            if (startConversationText) startConversationText.style.display = 'none';

            // Update chat title
            if (document.getElementById('chatTitle')) {
                document.getElementById('chatTitle').textContent = selectedChannelName;
            }

            // Clear the localStorage items so we don't auto-join next time
            localStorage.removeItem('selectedChannelId');
            localStorage.removeItem('selectedChannelName');
        }
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

        // Always refresh username from localStorage before sending
        username = localStorage.getItem('username') || 'Anonymous';

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

    // Get current username again to ensure it's up to date
    const currentUsername = localStorage.getItem('username') || 'Anonymous';

    if (data.username === currentUsername) {
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

// Helper function to generate a unique DM channel ID
function generateDMChannelId(userA, userB) {
    // Sort the usernames to ensure consistency (e.g., "Alice_Bob")
    return [userA, userB].sort().join('_');
}

// Standalone function to join a direct message channel
async function joinDM(recipientUsername) {
    if (!recipientUsername) {
        console.error("Recipient username is required to join DM");
        return;
    }
    try {
        const token = localStorage.getItem("token");
        // Call the DM endpoint to get a valid DM channel ObjectId
        const response = await fetch(`http://localhost:5000/dm-channel?recipient=${recipientUsername}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error("Failed to get DM channel");
        }
        const data = await response.json();
        const dmChannelId = data.channelId;
        if (currentChannel === dmChannelId) {
            console.log("Already in DM channel:", dmChannelId);
            return;
        }
        console.log("Joining DM channel:", dmChannelId);
        currentChannel = dmChannelId;
        socket.emit("join channel", dmChannelId);
        displaySystemMessage(`Joined DM with ${recipientUsername}`);
    } catch (error) {
        console.error("Error joining DM:", error);
    }
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
window.joinDM = joinDM;
window.displaySystemMessage = displaySystemMessage;
window.closeChat = closeChat;