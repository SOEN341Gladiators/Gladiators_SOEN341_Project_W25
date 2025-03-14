// channel_requests.js - Direct implementation that should work
let currentChannelId = null;

document.addEventListener('DOMContentLoaded', function () {
    // Get the View Requests button and panel elements
    const viewRequestsBtn = document.getElementById('viewRequestsBtn');
    const requestsPanel = document.getElementById('requestsPanel');
    const closeRequestsPanel = document.getElementById('closeRequestsPanel');

    // Hide the requests button initially
    if (viewRequestsBtn) {
        viewRequestsBtn.style.display = 'none';
    }

    // Add View Requests button click handler
    if (viewRequestsBtn) {
        viewRequestsBtn.addEventListener('click', function () {
            // Always fetch fresh data when button is clicked
            if (currentChannelId) {
                const token = localStorage.getItem('token');

                // Make direct API call to get pending requests
                fetch(`http://localhost:5000/channel/pending-requests/${currentChannelId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                    .then(response => response.json())
                    .then(requests => {
                        // Show the requests panel
                        if (requestsPanel) {
                            requestsPanel.style.display = 'block';

                            // Update the panel content
                            const content = document.getElementById('requestsPanelContent');
                            if (content) {
                                if (requests.length === 0) {
                                    content.innerHTML = '<div class="no-requests-message">No pending requests</div>';
                                } else {
                                    content.innerHTML = '';
                                    requests.forEach(request => {
                                        const item = document.createElement('div');
                                        item.className = 'join-request-item';
                                        item.innerHTML = `
                                        <div class="request-username">${request.username}</div>
                                        <div class="request-actions">
                                            <button class="accept-btn" data-user-id="${request._id}">Accept</button>
                                            <button class="reject-btn" data-user-id="${request._id}">Reject</button>
                                        </div>
                                    `;

                                        // Add event listeners for accept/reject buttons
                                        const acceptBtn = item.querySelector('.accept-btn');
                                        const rejectBtn = item.querySelector('.reject-btn');

                                        if (acceptBtn) {
                                            acceptBtn.addEventListener('click', function () {
                                                const userId = this.getAttribute('data-user-id');
                                                acceptRequest(currentChannelId, userId, item);
                                            });
                                        }

                                        if (rejectBtn) {
                                            rejectBtn.addEventListener('click', function () {
                                                const userId = this.getAttribute('data-user-id');
                                                rejectRequest(currentChannelId, userId, item);
                                            });
                                        }

                                        content.appendChild(item);
                                    });
                                }
                            }
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching requests:", error);
                    });
            }
        });
    }

    // Close button event handler
    if (closeRequestsPanel) {
        closeRequestsPanel.addEventListener('click', function () {
            if (requestsPanel) {
                requestsPanel.style.display = 'none';
            }
        });
    }

    // Check if current user is channel creator when joining a channel
    // Override the joinChannel function
    const originalJoinChannel = window.joinChannel;
    window.joinChannel = function (channelId) {
        // Call original function
        if (typeof originalJoinChannel === 'function') {
            originalJoinChannel(channelId);
        }

        // Store current channel ID
        currentChannelId = channelId;

        // Check if user is creator
        checkCreatorStatus(channelId);
    };
});

// Function to accept a join request
function acceptRequest(channelId, userId, element) {
    const token = localStorage.getItem('token');

    fetch(`http://localhost:5000/channel/accept-request/${channelId}/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => response.json())
        .then(data => {
            if (element) {
                element.remove();
            }

            // Check if there are no more requests
            const content = document.getElementById('requestsPanelContent');
            if (content && content.children.length === 0) {
                content.innerHTML = '<div class="no-requests-message">No pending requests</div>';
            }

            // Alert success
            alert('User has been added to the channel');
        })
        .catch(error => {
            console.error("Error accepting request:", error);
            alert("Failed to accept request");
        });
}

// Function to reject a join request
function rejectRequest(channelId, userId, element) {
    const token = localStorage.getItem('token');

    fetch(`http://localhost:5000/channel/reject-request/${channelId}/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => response.json())
        .then(data => {
            if (element) {
                element.remove();
            }

            // Check if there are no more requests
            const content = document.getElementById('requestsPanelContent');
            if (content && content.children.length === 0) {
                content.innerHTML = '<div class="no-requests-message">No pending requests</div>';
            }

            // Alert success
            alert('Request has been rejected');
        })
        .catch(error => {
            console.error("Error rejecting request:", error);
            alert("Failed to reject request");
        });
}

// Function to check if user is channel creator
function checkCreatorStatus(channelId) {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    if (!token || !userId || !channelId) return;

    // First try to get all channels with status
    fetch('http://localhost:5000/all-channels-with-status', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => response.json())
        .then(channels => {
            // Find the current channel
            const channel = channels.find(c => c._id === channelId);

            if (channel) {
                // Check if user is creator
                const isCreator = channel.isCreator ||
                    (channel.createdBy &&
                        (channel.createdBy === userId ||
                            channel.createdBy.toString() === userId));

                // Show/hide button based on creator status
                const viewRequestsBtn = document.getElementById('viewRequestsBtn');
                if (viewRequestsBtn) {
                    viewRequestsBtn.style.display = isCreator ? 'inline-block' : 'none';
                }
            }
        })
        .catch(error => {
            console.error("Error checking creator status:", error);
        });
}

// Add this to the channel_requests.js file or create a separate file

// Function to allow users to leave a channel
async function leaveChannel(channelId, channelName) {
    // Confirm the action with the user
    if (!confirm(`Are you sure you want to leave the "${channelName}" channel?\nOnce you leave you will have to request access to join again.`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');

        if (!token || !channelId) {
            console.error("Missing required data for leaving channel");
            return;
        }

        const response = await fetch(`http://localhost:5000/channel/leave/${channelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to leave channel');
        }

        const data = await response.json();

        // Show success message
        alert(data.message || 'You have left the channel successfully');

        // Close the chat
        if (typeof window.closeChat === 'function') {
            window.closeChat();
        }

        // Refresh the channel list
        if (typeof window.fetchChannels === 'function') {
            window.fetchChannels();
        }

    } catch (error) {
        console.error("Error leaving channel:", error);
        alert(error.message || "Failed to leave channel. Please try again.");
    }
}

// Modify the joinChannel function to add a Leave Channel button
const originalJoinChannel = window.joinChannel;
window.joinChannel = function (channelId) {
    // Call the original function first
    if (typeof originalJoinChannel === 'function') {
        originalJoinChannel(channelId);
    }

    // Set current channel ID
    currentChannelId = channelId;

    // Add Leave Channel button for non-creators
    checkMembershipStatus(channelId);
};

// Function to check if user is a member and not the creator
async function checkMembershipStatus(channelId) {
    try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');

        if (!token || !userId || !channelId) {
            return;
        }

        const response = await fetch('http://localhost:5000/all-channels-with-status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return;
        }

        const channels = await response.json();
        const currentChannel = channels.find(channel => channel._id === channelId);

        if (!currentChannel) {
            return;
        }

        const isMember = currentChannel.isMember ||
            (currentChannel.users &&
                currentChannel.users.some(id =>
                    typeof id === 'string' ? id === userId : id.toString() === userId
                ));

        const isCreator = currentChannel.isCreator ||
            (currentChannel.createdBy &&
                (currentChannel.createdBy === userId ||
                    currentChannel.createdBy.toString() === userId));

        // If user is a member but not the creator, show leave button
        const chatHeader = document.querySelector('.chat-header');

        // Remove existing leave button if there is one
        const existingLeaveBtn = document.getElementById('leaveChannelBtn');
        if (existingLeaveBtn) {
            existingLeaveBtn.remove();
        }

        if (isMember && !isCreator && chatHeader && currentChannel.type !== 'dm') {
            // Create leave button
            const leaveBtn = document.createElement('button');
            leaveBtn.id = 'leaveChannelBtn';
            leaveBtn.className = 'leave-channel-btn';
            leaveBtn.textContent = 'Leave Channel';
            leaveBtn.style.backgroundColor = '#dc3545';
            leaveBtn.style.color = 'white';
            leaveBtn.style.border = 'none';
            leaveBtn.style.borderRadius = '4px';
            leaveBtn.style.padding = '5px 10px';
            leaveBtn.style.fontSize = '0.9rem';
            leaveBtn.style.cursor = 'pointer';
            leaveBtn.style.marginRight = '8px';

            // Add event listener
            leaveBtn.addEventListener('click', () => {
                leaveChannel(channelId, currentChannel.name);
            });

            // Insert before the other buttons
            const headerButtons = chatHeader.querySelector('div');
            if (headerButtons) {
                headerButtons.insertBefore(leaveBtn, headerButtons.firstChild);
            }
        }

    } catch (error) {
        console.error("Error checking membership status:", error);
    }
}

// Make the functions available globally
window.leaveChannel = leaveChannel;
window.checkMembershipStatus = checkMembershipStatus;