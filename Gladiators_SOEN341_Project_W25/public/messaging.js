// Initialize global variables
let socket;
let currentChannel = null;
let username = localStorage.getItem('username') || 'Anonymous';
let userRole = localStorage.getItem('userRole') || 'user';
let editingMessageId = null; // Track which message is being edited
let replyingTo = null;

document.addEventListener("DOMContentLoaded", function () {
    // Ensure username is set properly at initialization
    username = localStorage.getItem('username') || 'Anonymous';
    userRole = localStorage.getItem('userRole') || 'user';
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

        setTimeout(() => {
            console.log("Client rooms:", socket.rooms);
        }, 1000); // Wait 1s for join to complete

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

    socket.on("message edited", (data) => {
        console.log("Message edited:", data);
        updateEditedMessage(data.messageId, data.newMessage, data.editHistory);
    });

    socket.on('reminder', (data) => {
        console.log("Received 'reminder' event:", data);
        showToast(data.message, data.channelId, data.messageId);
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
        displaySystemMessage("Error: " + error);
    });

    // Send message functionality
function sendMessage(e) {
    if (e) e.preventDefault(); // Prevent form submission if event is provided

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

    // Check if we're editing a message
    if (editingMessageId) {
        // Send edit to server
        const editData = {
            messageId: editingMessageId,
            newMessage: message
        };
        console.log("Editing message:", editData);
        socket.emit("edit message", editData);
        // Removed unused messageData object

        // Reset editing state
        editingMessageId = null;
        resetChatForm();
    } else {
        // Send new message
        const messageData = {
            channelId: currentChannel,
            username: username,
            message: message,
            replyTo: replyingTo || undefined // Include replyTo if set
        };
        console.log("Sending message:", messageData);
        socket.emit("message", messageData);
    }

    messageInput.value = "";
    if (replyingTo) {
        const replyIndicator = document.getElementById('replyIndicator');
        if (replyIndicator) replyIndicator.style.display = 'none';
        document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));
        replyingTo = null;
    }
}

    // Reset the chat form after editing
    function resetChatForm() {
        // Change submit button text back to "Send"
        const submitButton = document.querySelector("#chatForm button[type='submit']");
        if (submitButton) {
            submitButton.textContent = "Send";
        }

        // Remove cancel button if it exists
        const cancelButton = document.getElementById("cancelEditBtn");
        if (cancelButton) {
            cancelButton.remove();
        }

        // Remove editing class from form
        if (chatForm) {
            chatForm.classList.remove("editing");
        }
    }

    // Cancel editing
    function cancelEdit() {
        messageInput.value = ""; // Clear input
        editingMessageId = null; // Reset editing state
        resetChatForm(); // Reset form UI
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

    // Close dropdowns when clicking outside of them
    document.addEventListener('click', (e) => {
        const dropdowns = document.querySelectorAll('.Dropdown-menu');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target) && !e.target.matches('.message-actions')) {
                dropdown.classList.remove('show');
            }
        });
    });

    // Add event listener for canceling the reply
    document.getElementById('cancelReply').addEventListener('click', () => {
        const replyIndicator = document.getElementById('replyIndicator');
        replyIndicator.classList.remove('show'); // Start fade-out
        replyIndicator.style.display = 'none'; // Hide after animation
        document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));
        replyingTo = null; // Clear reply state
    });
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
    messageDiv.id = `message-${data._id}`;
    messageDiv.dataset.originalMessage = data.message; // Store original message for editing

    // Add reply button
    const replyButton = document.createElement("button");
    replyButton.className = "reply-button";
    replyButton.textContent = "Reply";
    replyButton.addEventListener("click", () => initiateReply(data._id));

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

    //check if the message is a reply
    if (data.replyTo) {
        const repliedMessageDiv = document.createElement("div");
        repliedMessageDiv.className = "replied-message";

        // Use populated replyTo data from the server
        if (data.replyTo && typeof data.replyTo === 'object' && data.replyTo.message) {
            const originalUsername = data.replyTo.username;
            const originalMessageText = data.replyTo.isDeleted ? "🚫 This message has been deleted" : data.replyTo.message;
            repliedMessageDiv.innerHTML = `<strong>${originalUsername}:</strong> ${originalMessageText}`;
        } else {
            repliedMessageDiv.textContent = "Original message not found";
        }

        repliedMessageDiv.addEventListener("click", () => {
            const original = document.getElementById(`message-${data.replyTo._id || data.replyTo}`);
            if (original) {
                original.scrollIntoView({ behavior: 'smooth' });
            }
        });
        messageDiv.appendChild(repliedMessageDiv);
    }

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

        // Add message actions (three dots) menu
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions";
        actionsDiv.textContent = "⋮";
        actionsDiv.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDropdown(data._id);
        });

        const dropdownDiv = document.createElement("div");
        dropdownDiv.className = "Dropdown-menu";

        const setReminderOption = document.createElement('div');
        setReminderOption.className = 'set-reminder-option';
        setReminderOption.textContent = 'Set reminder';
        setReminderOption.addEventListener('click', (e) => {
            e.stopPropagation();
            showReminderModal(data._id, data.channelId);
            dropdownDiv.classList.remove('show');
        });

        // Only add edit option for own messages
        if (isOwnMessage && !data.isDeleted) {
            const editOption = document.createElement("div");
            editOption.className = "edit-option";
            editOption.textContent = "Edit message";
            editOption.addEventListener("click", (e) => {
                e.stopPropagation();
                editMessage(data._id);
                dropdownDiv.classList.remove("show");
            });
            dropdownDiv.appendChild(editOption);
        }

        // Admin (or own message) can delete
        if (currentUserRole === 'admin' || isOwnMessage) {
            const deleteOption = document.createElement("div");
            deleteOption.className = "delete-option";
            deleteOption.textContent = "Delete message";
            deleteOption.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteMessage(data._id);
                dropdownDiv.classList.remove("show");
            });
            dropdownDiv.appendChild(deleteOption);
        }

        // Add history option for edited messages
        if (data.isEdited) {
            const historyOption = document.createElement("div");
            historyOption.className = "history-option";
            historyOption.textContent = "View edit history";
            historyOption.addEventListener("click", (e) => {
                e.stopPropagation();
                viewMessageHistory(data._id);
                dropdownDiv.classList.remove("show");
            });
            dropdownDiv.appendChild(historyOption);
        }

        dropdownDiv.appendChild(setReminderOption);
        messageDiv.appendChild(actionsDiv);
        messageDiv.appendChild(dropdownDiv);
    }

    // Add username display at the top
    const usernameSpan = document.createElement("span");
    usernameSpan.className = "message-username";
    usernameSpan.textContent = data.username;

    // Add edited indicator if message was edited
    if (data.isEdited) {
        const editedSpan = document.createElement("span");
        editedSpan.className = "edited-indicator";
        editedSpan.textContent = " (edited)";
        usernameSpan.appendChild(editedSpan);
    }

    messageDiv.appendChild(usernameSpan);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(replyButton);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function initiateReply(messageId) {
    replyingTo = messageId; // Store the message ID being replied to
    document.getElementById("replyIndicator").style.display = "block"; // Show reply indicator
    document.getElementById("replyIndicator").style.opacity = 1; // Show reply indicator
    
    const originalMessageDiv = document.getElementById(`message-${messageId}`);
    if (!originalMessageDiv) {
        console.error("Original message not found");
        return;
    }
    if (originalMessageDiv.querySelector('.message-text').classList.contains('deleted')) {
        console.log("Cannot reply to a deleted message");
        return;
    }
    // Remove existing highlights
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));
    originalMessageDiv.classList.add('replying-to');

    const username = originalMessageDiv.querySelector('.message-username').textContent;
    const messageText = originalMessageDiv.querySelector('.message-text').textContent;
    const preview = messageText.length > 20 ? messageText.substring(0, 20) + '...' : messageText;

    const replyText = `Replying to ${username}: ${preview}`;
    document.getElementById('replyText').textContent = replyText;
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

    if (replyingTo === messageId) {
        document.getElementById('replyIndicator').style.display = 'none';
        document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));
        replyingTo = null;
    }
}

function updateEditedMessage(messageId, newMessage, editHistory) {
    const messageDiv = document.getElementById(`message-${messageId}`);
    if (!messageDiv) return;

    // Update the message text
    const messageText = messageDiv.querySelector('.message-text');
    if (messageText) {
        messageText.textContent = newMessage;
    }

    // Update dataset for future editing
    messageDiv.dataset.originalMessage = newMessage;

    // Add edited indicator if not already present
    const usernameSpan = messageDiv.querySelector('.message-username');
    if (usernameSpan && !usernameSpan.querySelector('.edited-indicator')) {
        const editedSpan = document.createElement("span");
        editedSpan.className = "edited-indicator";
        editedSpan.textContent = " (edited)";
        usernameSpan.appendChild(editedSpan);
    }

    // Make sure there's a view history option in the dropdown
    const dropdown = messageDiv.querySelector('.Dropdown-menu');
    if (dropdown && !dropdown.querySelector('.history-option')) {
        const historyOption = document.createElement("div");
        historyOption.className = "history-option";
        historyOption.textContent = "View edit history";
        historyOption.addEventListener("click", (e) => {
            e.stopPropagation();
            viewMessageHistory(messageId);
            dropdown.classList.remove("show");
        });
        dropdown.appendChild(historyOption);
    }
}

function editMessage(messageId) {
    const messageDiv = document.getElementById(`message-${messageId}`);
    if (!messageDiv) return;

    const originalMessage = messageDiv.dataset.originalMessage;
    const chatInput = document.getElementById("chatInput");
    const chatForm = document.getElementById("chatForm");

    if (!chatInput || !chatForm) return;

    // Set the input value to the original message
    chatInput.value = originalMessage;
    chatInput.focus();

    // Change the submit button text to "Save"
    const submitButton = chatForm.querySelector("button[type='submit']");
    if (submitButton) {
        submitButton.textContent = "Save";
    }

    // Add a class to the form to indicate editing mode
    chatForm.classList.add("editing");

    // Add a cancel button if it doesn't exist
    if (!document.getElementById("cancelEditBtn")) {
        const cancelButton = document.createElement("button");
        cancelButton.id = "cancelEditBtn";
        cancelButton.type = "button";
        cancelButton.className = "cancel-edit-btn";
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", cancelEdit);

        // Insert before the submit button
        if (submitButton) {
            chatForm.insertBefore(cancelButton, submitButton);
        } else {
            chatForm.appendChild(cancelButton);
        }
    }

    // Set the editing state
    editingMessageId = messageId;
}

function cancelEdit() {
    const chatInput = document.getElementById("chatInput");
    chatInput.value = ""; // Clear input
    editingMessageId = null; // Reset editing state

    // Reset form UI
    const submitButton = document.querySelector("#chatForm button[type='submit']");
    if (submitButton) {
        submitButton.textContent = "Send";
    }

    const cancelButton = document.getElementById("cancelEditBtn");
    if (cancelButton) {
        cancelButton.remove();
    }

    // Remove editing class
    const chatForm = document.getElementById("chatForm");
    if (chatForm) {
        chatForm.classList.remove("editing");
    }
}

// Modal for users to select a reminder time
function showReminderModal(messageId, channelId) {
    console.log(`Showing reminder modal for message ${messageId}, channel ${channelId}`);
    const modal = document.createElement("div");
    modal.className = "reminder-modal";
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Set Reminder</h3>
            <div class="reminder-options">
                <button onclick="setReminder('${messageId}', '${channelId}', '5 min')">In 5 minutes</button>
                <button onclick="setReminder('${messageId}', '${channelId}', '30 min')">In 30 minutes</button>
                <button onclick="setReminder('${messageId}', '${channelId}', '1 hour')">In 1 hour</button>
                <div class="custom-time">
                    <input type="datetime-local" id="customReminderTime" placeholder="Custom time">
                    <button onclick="setCustomReminder('${messageId}', '${channelId}')">Set Custom</button>
                </div>
            </div>
            <button class="close-btn" onclick="this.closest('.reminder-modal').remove()">Close</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function setReminder(messageId, channelId, timeOption) {
    let reminderTime;
    const now = new Date();
    switch (timeOption) {
        case "5 min":
            reminderTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
            break;
        case "30 min":
            reminderTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
            break;
        case "1 hour":
            reminderTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
            break;
        default:
            console.error("Invalid time option:", timeOption);
            return;
    }

    sendReminderRequest(messageId, channelId, reminderTime);
}

function setCustomReminder(messageId, channelId) {
    const customTimeInput = document.getElementById("customReminderTime");
    const customTimeValue = customTimeInput.value;

    if (!customTimeValue) {
        alert("Please select a custom time");
        return;
    }

    const reminderTime = new Date(customTimeValue);
    const now = new Date();

    if (reminderTime <= now) {
        alert("Custom time must be in the future");
        return;
    }

    sendReminderRequest(messageId, channelId, reminderTime);
}

function sendReminderRequest(messageId, channelId, reminderTime) {
    fetch("http://localhost:5000/reminder", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ messageId, channelId, reminderTime })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert("Reminder set successfully");
            document.querySelector(".reminder-modal").remove(); // Close modal on success
        } else {
            alert("Failed to set reminder");
        }
    })
    .catch(error => {
        console.error("Error setting reminder:", error);
        alert("Failed to set reminder");
    });
}

//Display clickable toast notifications when reminders trigger
function showToast(message, channelId, messageId) {
    console.log("Showing toast with:", { message, channelId, messageId });
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // Enhanced inline styling
    toast.style.position = 'fixed';
    toast.style.bottom = '30px'; // Slightly higher for better visibility
    toast.style.right = '30px';
    toast.style.backgroundColor = '#1a1a1a'; // Darker, sleek background
    toast.style.color = '#ffffff'; // Clean white text
    toast.style.padding = '12px 20px'; // More padding for comfort
    toast.style.borderRadius = '8px'; // Softer corners
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'; // Subtle shadow for depth
    toast.style.fontSize = '16px'; // Readable text size
    toast.style.fontFamily = 'Arial, sans-serif'; // Clean font
    toast.style.zIndex = '1000'; // Ensure it’s on top
    toast.style.cursor = 'pointer'; // Indicate clickability
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; // Smooth fade and slide
    toast.style.opacity = '0'; // Start invisible for animation
    toast.style.transform = 'translateY(20px)'; // Start slightly below for slide-in

    // Append to body and trigger animation
    document.body.appendChild(toast);
    console.log("Toast appended to body:", toast.outerHTML);
    setTimeout(() => {
        toast.style.opacity = '1'; // Fade in
        toast.style.transform = 'translateY(0)'; // Slide up
    }, 10); // Small delay to ensure transition works

    // Hover effect
    toast.addEventListener('mouseover', () => {
        toast.style.backgroundColor = '#2a2a2a'; // Slightly lighter on hover
        toast.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'; // Larger shadow
    });
    toast.addEventListener('mouseout', () => {
        toast.style.backgroundColor = '#1a1a1a'; // Revert to original
        toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    // Click functionality
    toast.addEventListener('click', () => {
        console.log("Toast clicked, joining:", channelId);
        joinChannel(channelId);
        setTimeout(() => {
            const messageElement = document.getElementById(`message-${messageId}`);
            if (messageElement) messageElement.scrollIntoView({ behavior: 'smooth' });
        }, 500);
        toast.remove(); // Remove immediately on click
    });

    // Fade out and remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0'; // Fade out
        toast.style.transform = 'translateY(20px)'; // Slide down
        setTimeout(() => {
            console.log("Removing toast:", message);
            toast.remove();
        }, 300); // Wait for fade-out animation to finish
    }, 8000);
}

// Display the reminders modal
document.getElementById('viewRemindersBtn').addEventListener('click', showRemindersModal);

function showRemindersModal() {
    fetch('http://localhost:5000/reminders', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(reminders => {
        const modal = document.createElement('div');
        modal.className = 'reminders-modal';
        let html = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>My Reminders</h3>
                    <button class="close-btn" aria-label="Close reminders modal">×</button>
                </div>
                <div class="reminders-body">
        `;
        if (reminders.length === 0) {
            html += '<p class="no-reminders">No reminders set yet</p>';
        } else {
            html += '<ul class="reminders-list">';
            reminders.forEach(reminder => {
                const message = reminder.messageId;
                const time = new Date(reminder.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                html += `
                    <li class="reminder-item">
                        <span class="reminder-message">${message.username}: ${message.message}</span>
                        <span class="reminder-time">${time}</span>
                        <button class="cancel-reminder-btn" onclick="cancelReminder('${reminder._id}')">×</button>
                    </li>
                `;
            });
            html += '</ul>';
        }
        html += '</div></div>';
        modal.innerHTML = html;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => modal.remove());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    })
    .catch(error => {
        console.error('Error fetching reminders:', error);
        alert('Failed to fetch reminders');
    });
}

function cancelReminder(reminderId) {
    fetch(`http://localhost:5000/reminder/${reminderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) alert('Reminder canceled successfully');
        else alert('Failed to cancel reminder');
    })
    .catch(error => {
        console.error('Error canceling reminder:', error);
        alert('Failed to cancel reminder');
    });
    const reminderElement = document.querySelector(`li:has(button[onclick="cancelReminder('${reminderId}')"])`);
    if (reminderElement) reminderElement.remove();
}

// View message edit history
async function viewMessageHistory(messageId) {
    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://localhost:5000/message/history/${messageId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Failed to fetch message history");
        }

        const data = await response.json();
        displayMessageHistory(messageId, data);
    } catch (error) {
        console.error("Error fetching message history:", error);
        displaySystemMessage("Error: Failed to fetch message history");
    }
}

// Display the message history modal
function displayMessageHistory(messageId, data) {
    // Remove any existing history modals
    const existingModal = document.getElementById('historyModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'historyModal';
    modal.className = 'history-modal';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'history-modal-content';

    // Create header
    const header = document.createElement('div');
    header.className = 'history-modal-header';

    const title = document.createElement('h3');
    title.textContent = 'Message Edit History';

    const closeButton = document.createElement('button');
    closeButton.className = 'history-close-btn';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => modal.remove());

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create body
    const body = document.createElement('div');
    body.className = 'history-modal-body';

    // Current version
    const currentVersion = document.createElement('div');
    currentVersion.className = 'history-item current';

    const currentHeader = document.createElement('div');
    currentHeader.className = 'history-item-header';
    currentHeader.innerHTML = '<strong>Current Version</strong>';

    const currentText = document.createElement('div');
    currentText.className = 'history-item-text';
    currentText.textContent = data.message;

    currentVersion.appendChild(currentHeader);
    currentVersion.appendChild(currentText);
    body.appendChild(currentVersion);

    // Previous versions
    if (data.editHistory && data.editHistory.length > 0) {
        data.editHistory.slice().reverse().forEach((edit, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const editNumber = data.editHistory.length - index;
            const timestamp = new Date(edit.editedAt).toLocaleString();

            const itemHeader = document.createElement('div');
            itemHeader.className = 'history-item-header';
            itemHeader.innerHTML = `<strong>Version ${editNumber}</strong> <span class="history-timestamp">${timestamp}</span>`;

            const itemText = document.createElement('div');
            itemText.className = 'history-item-text';
            itemText.textContent = edit.previousMessage;

            historyItem.appendChild(itemHeader);
            historyItem.appendChild(itemText);
            body.appendChild(historyItem);
        });
    } else {
        const noHistory = document.createElement('div');
        noHistory.className = 'no-history-message';
        noHistory.textContent = 'No previous versions found.';
        body.appendChild(noHistory);
    }

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);

    // Add to document
    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function deleteMessage(messageId) {
    // Get the current user role directly from localStorage
    const currentUserRole = localStorage.getItem('userRole') || 'user';
    const currentUsername = localStorage.getItem('username') || 'Anonymous';

    // Find the message element
    const messageDiv = document.getElementById(`message-${messageId}`);
    if (!messageDiv) return;

    // Get message author
    const messageUsername = messageDiv.querySelector('.message-username')?.textContent;
    const isOwnMessage = messageUsername === currentUsername;

    // Only allow admins or message owner to delete messages
    if (currentUserRole !== 'admin' && !isOwnMessage) {
        console.log("Only admins or message owners can delete messages");
        return;
    }

    console.log("Requesting message deletion for message ID:", messageId);
    socket.emit("delete message", messageId);
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

    replyingTo = null;
    document.getElementById('replyIndicator').style.display = 'none';
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));

    // Show chat area and hide welcome text
    const chatArea = document.getElementById("chatArea");
    const welcomeText = document.getElementById("welcomeText");
    const startConversationText = document.getElementById("startConversationText");

    if (chatArea) chatArea.style.display = 'flex';
    if (welcomeText) welcomeText.style.display = 'none';
    if (startConversationText) startConversationText.style.display = 'none';

    displaySystemMessage(`Joined channel ${channelId}`);
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

        replyingTo = null;
        document.getElementById('replyIndicator').style.display = 'none';
        document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));

        // Show chat area and hide welcome text
        const chatArea = document.getElementById("chatArea");
        const welcomeText = document.getElementById("welcomeText");
        const startConversationText = document.getElementById("startConversationText");

        if (chatArea) chatArea.style.display = 'flex';
        if (welcomeText) welcomeText.style.display = 'none';
        if (startConversationText) startConversationText.style.display = 'none';

        // Set chat title to recipient username
        if (document.getElementById('chatTitle')) {
            document.getElementById('chatTitle').textContent = recipientUsername;
        }

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

    replyingTo = null;
    document.getElementById('replyIndicator').style.display = 'none';
    document.querySelectorAll('.message').forEach(msg => msg.classList.remove('replying-to'));

    if (chatArea) chatArea.style.display = "none";
    if (welcomeText) welcomeText.style.display = "block";
    if (startConversationText) startConversationText.style.display = "block";

    // Clear the chat messages
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }

    // Remove active class from all channels
    document.querySelectorAll('.channel-button').forEach(btn => {
        btn.classList.remove('active');
    });
}

// Helper function for emoji insertion - will be used by emoji.js
function insertTextAtCursor(input, text) {
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;
    const currentValue = input.value;

    const newValue = currentValue.substring(0, startPos) + text + currentValue.substring(endPos);
    input.value = newValue;

    // Move cursor after inserted text
    const newCursorPos = startPos + text.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    input.focus();
}

// Export functions for use in other files
window.joinChannel = joinChannel;
window.joinDM = joinDM;
window.displaySystemMessage = displaySystemMessage;
window.closeChat = closeChat;
window.sendMessage = sendMessage; // Export for use in standalone buttons
window.insertTextAtCursor = insertTextAtCursor; // Export for use with emoji picker
window.cancelEdit = cancelEdit; // Export cancel edit function
