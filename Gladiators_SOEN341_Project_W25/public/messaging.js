/* global io */

// Initialize global variables
let socket;
let currentChannel = null;
let username = typeof localStorage !== 'undefined' ? localStorage.getItem('username') || 'Anonymous' : 'Anonymous'; //allow for testing
let userRole = typeof localStorage !== 'undefined' ? localStorage.getItem('userRole') || 'user' : 'user';


// Declare these functions in the global scope so they can be exported
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

function sendMessage(e) {
    if (e) e.preventDefault(); // Prevent form submission if event is provided

    // Always refresh username from localStorage before sending
    username = localStorage.getItem('username') || 'Anonymous';

    const messageInput = document.getElementById("chatInput");
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

    if (socket) socket.emit("message", messageData); //if active socket, "if" for tests
    messageInput.value = "";
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
    if (socket) socket.emit("join channel", channelId);
    displaySystemMessage(`Joined channel ${channelId}`);
}

function closeChat() {
    const chatArea = document.getElementById("chatArea");
    const welcomeText = document.getElementById("welcomeText");
    const startConversationText = document.getElementById("startConversationText");

    if (currentChannel) {
        if (socket) socket.emit("leave channel", currentChannel);
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
        if (socket) socket.emit("join channel", dmChannelId);
        displaySystemMessage(`Joined DM with ${recipientUsername}`);
    } catch (error) {
        console.error("Error joining DM:", error);
    }
}

//if (typeof document !== "undefined") {
document.addEventListener("DOMContentLoaded", function () {
    // Ensure username is set properly at initialization
    username = typeof localStorage !== 'undefined' ? localStorage.getItem('username') || 'Anonymous' : 'Anonymous';
    userRole = typeof localStorage !== 'undefined' ? localStorage.getItem('userRole') || 'user' : 'user';
    console.log("Current username:", username);
    console.log("Current user role:", userRole);

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

    // Parse DM user from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const dmUser = urlParams.get('dm');

    // Check for channel selected from another page (via localStorage)
    const selectedChannelId = localStorage.getItem('selectedChannelId');
    const selectedChannelName = localStorage.getItem('selectedChannelName');
    const selectedDmUser = localStorage.getItem('selectedDmUser');

    console.log("Socket.IO initialization started");

    // Socket event listeners
    socket.on("connect", () => {
        console.log("Connected to chat server. Socket ID:", socket.id);

        // Send user info to server
        const currentUsername = localStorage.getItem('username') || 'Anonymous';
        const currentUserRole = localStorage.getItem('userRole') || 'user';
        console.log("Sending user info to server:", { username: currentUsername, role: currentUserRole });
        socket.emit('user info', {
            username: currentUsername,
            role: currentUserRole
        });

        displaySystemMessage("Connected to chat server");

        // Handle channel join from localStorage (e.g., from channel list)
        if (selectedChannelId && chatArea) {
            console.log("Auto-joining channel:", selectedChannelId);
            joinChannel(selectedChannelId);
            chatArea.style.display = 'flex';
            if (welcomeText) welcomeText.style.display = 'none';
            if (startConversationText) startConversationText.style.display = 'none';
            if (document.getElementById('chatTitle')) {
                document.getElementById('chatTitle').textContent = selectedChannelName;
            }
            localStorage.removeItem('selectedChannelId');
            localStorage.removeItem('selectedChannelName');
        }
        // Handle DM from localStorage (if set elsewhere)
        else if (selectedDmUser && chatArea) {
            console.log("Auto-joining DM with:", selectedDmUser);
            chatArea.style.display = 'flex';
            if (welcomeText) welcomeText.style.display = 'none';
            if (startConversationText) startConversationText.style.display = 'none';
            if (document.getElementById('chatTitle')) {
                document.getElementById('chatTitle').textContent = selectedDmUser;
            }
            joinDM(selectedDmUser);
            localStorage.removeItem('selectedDmUser');
        }
        // Handle DM from URL query parameter
        else if (dmUser && chatArea) {
            console.log("Initiating DM from URL with:", dmUser);
            chatArea.style.display = 'flex';
            if (welcomeText) welcomeText.style.display = 'none';
            if (startConversationText) startConversationText.style.display = 'none';
            if (document.getElementById('chatTitle')) {
                document.getElementById('chatTitle').textContent = dmUser;
            }
            joinDM(dmUser);
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

    socket.on("message deleted", (data) => {
        console.log("Message deleted:", data);
        updateDeletedMessage(data.messageId);
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
        displaySystemMessage("Error: " + error);
    });

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

    // Close dropdowns when clicking outside of them
    document.addEventListener('click', (e) => {
        const dropdowns = document.querySelectorAll('.Dropdown-menu');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target) && !e.target.matches('.message-actions')) {
                dropdown.classList.remove('show');
            }
        });
    });
});
//};

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
    messageDiv.id = `message-${data._id}`;

    // Get current username and role again to ensure it's up to date
    const currentUsername = localStorage.getItem('username') || 'Anonymous';
    const currentUserRole = localStorage.getItem('userRole') || 'user';

    // Determine if this is the current user's message
    const isOwnMessage = data.username === currentUsername;

    // Apply appropriate class based on who sent the message
    if (isOwnMessage) {
        messageDiv.classList.add("own-message");
    } else {
        messageDiv.classList.add("other-message");
    }

    const timestamp = new Date(data.timestamp).toLocaleTimeString();

    // Create message content
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    if (data.isDeleted) {
        contentDiv.innerHTML = `
            <div class="message-text deleted">🚫 This message has been deleted</div>
            <div class="message-timestamp">${timestamp}</div>
        `;
        contentDiv.classList.add("deleted");
    } else {
        contentDiv.innerHTML = `
            <div class="message-text">${data.message}</div>
            <div class="message-timestamp">${timestamp}</div>
        `;

        // Only add delete option if user is an admin
        if (currentUserRole === 'admin') {
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "message-actions";
            actionsDiv.textContent = "⋮";
            actionsDiv.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleDropdown(data._id);
            });

            const dropdownDiv = document.createElement("div");
            dropdownDiv.className = "Dropdown-menu";

            const deleteOption = document.createElement("div");
            deleteOption.className = "delete-option";
            deleteOption.textContent = "Delete message";
            deleteOption.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteMessage(data._id);
                dropdownDiv.classList.remove("show");
            });

            dropdownDiv.appendChild(deleteOption);
            messageDiv.appendChild(actionsDiv);
            messageDiv.appendChild(dropdownDiv);
        }
    }

    // Add username display at the top
    const usernameSpan = document.createElement("span");
    usernameSpan.className = "message-username";
    usernameSpan.textContent = data.username;

    messageDiv.appendChild(usernameSpan);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleDropdown(messageId) {
    // Close all other dropdowns first
    document.querySelectorAll('.Dropdown-menu').forEach(dropdown => {
        dropdown.classList.remove('show');
    });

    // Show the clicked dropdown
    const dropdown = document.querySelector(`#message-${messageId} .Dropdown-menu`);
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function updateDeletedMessage(messageId) {
    const messageDiv = document.getElementById(`message-${messageId}`);
    if (!messageDiv) return;

    // Remove action buttons
    const actions = messageDiv.querySelector('.message-actions');
    const dropdown = messageDiv.querySelector('.Dropdown-menu');
    if (actions) actions.remove();
    if (dropdown) dropdown.remove();

    // Update content to show deleted message
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.classList.add('deleted');
        const messageText = contentDiv.querySelector('.message-text');
        if (messageText) {
            messageText.classList.add('deleted');
            messageText.textContent = '🚫 This message has been deleted';
        }
    }
}

function deleteMessage(messageId) {
    // Get the current user role directly from localStorage
    const currentUserRole = localStorage.getItem('userRole') || 'user';

    console.log("Current user role when deleting:", currentUserRole);

    // Only allow admins to delete messages
    if (currentUserRole !== 'admin') {
        console.log("Only admins can delete messages");
        return;
    }

    console.log("Requesting message deletion for message ID:", messageId);
    socket.emit("delete message", messageId);
}

// Export functions for use in other files
// Export functions for testing
if (typeof window !== "undefined") {    // Allow for testing and more robustness 
    window.displaySystemMessage = displaySystemMessage;
    window.sendMessage = sendMessage; 
    window.closeChat = closeChat;
    window.joinChannel = joinChannel;
    window.joinDM = joinDM;
    window.socket = socket; // Expose socket for testing purposes
}

function setCurrentChannel(channel) {
    currentChannel = channel;
}

function getCurrentChannel() {
    return currentChannel;
}
// Export functions for testing
module.exports = {
    displaySystemMessage,
    sendMessage,
    closeChat,
    joinChannel,
    setCurrentChannel,
    getCurrentChannel
};

