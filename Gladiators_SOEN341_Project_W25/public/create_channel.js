// create_channel.js - Private channel creation and management
document.addEventListener('DOMContentLoaded', function () {
    const API_URL = "http://localhost:5000";
    const createPrivateChannelForm = document.getElementById('createPrivateChannelForm');
    const createResultDiv = document.getElementById('create-result');
    const userPrivateChannelsDiv = document.getElementById('userPrivateChannels');
    const pendingRequestsDiv = document.getElementById('pendingRequests');
    const pendingInvitesDiv = document.getElementById('pendingInvites');

    // Check if user is logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');

    if (!token || !username) {
        window.location.href = 'login.html';
        return;
    }

    console.log("User authentication info:", {
        token: token ? token.substring(0, 10) + "..." : "missing",
        username: username || "missing",
        userId: userId || "missing"
    });

    // Create Private Channel
    if (createPrivateChannelForm) {
        createPrivateChannelForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const channelName = document.getElementById('channelName').value.trim();
            const invitedUsersText = document.getElementById('invitedUsers').value.trim();

            // Process invited users
            let invitedUsers = [];
            if (invitedUsersText) {
                invitedUsers = invitedUsersText.split(',')
                    .map(username => username.trim())
                    .filter(username => username !== '');
            }

            if (!channelName) {
                showResultMessage('Channel name is required', false);
                return;
            }

            console.log("Sending request to create private channel:", {
                name: channelName,
                invitedUsers: invitedUsers
            });

            try {
                const response = await fetch(`${API_URL}/user/private-channel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: channelName,
                        invitedUsers
                    })
                });

                const data = await response.json();
                console.log("Server response:", data);

                if (response.ok) {
                    showResultMessage(data.message || 'Private channel created successfully!', true);
                    document.getElementById('channelName').value = '';
                    document.getElementById('invitedUsers').value = '';

                    // Refresh channel lists
                    loadUserPrivateChannels();
                    loadPendingInvites();

                    // Refresh nav bar channels
                    if (typeof window.fetchChannels === 'function') {
                        window.fetchChannels();
                    }
                } else {
                    showResultMessage(data.error || 'Failed to create private channel', false);
                }
            } catch (error) {
                console.error('Error creating private channel:', error);
                showResultMessage('Failed to create private channel. Please try again.', false);
            }
        });
    }

    // Load User's Private Channels
    async function loadUserPrivateChannels() {
        if (!userPrivateChannelsDiv) return;

        try {
            userPrivateChannelsDiv.innerHTML = '<div class="loading-text">Loading your channels...</div>';

            const response = await fetch(`${API_URL}/all-channels-with-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch channels');
            }

            const allChannels = await response.json();
            console.log("All fetched channels:", allChannels);

            // Filter to get only private channels where user is a member
            const privateChannels = allChannels.filter(channel =>
                channel.isPrivate && channel.isMember
            );

            console.log("Filtered private channels:", privateChannels);

            if (privateChannels.length === 0) {
                userPrivateChannelsDiv.innerHTML = '<div class="empty-text">You haven\'t joined any private channels yet.</div>';
                return;
            }

            userPrivateChannelsDiv.innerHTML = '';

            // Display private channels
            privateChannels.forEach(channel => {
                const isCreator = channel.isCreator;

                const channelItem = document.createElement('div');
                channelItem.className = 'channel-item';
                channelItem.innerHTML = `
                    <div class="channel-info">
                        <div class="channel-name">${channel.name} <span class="channel-badge private-badge">Private</span></div>
                        <div class="channel-meta">${channel.users ? channel.users.length : 0} members</div>
                    </div>
                    <div class="channel-actions">
                        ${isCreator ? `
                            <button class="btn-secondary invite-user-btn" data-channel-id="${channel._id}">Invite User</button>
                        ` : `
                            <button class="btn-danger leave-channel-btn" data-channel-id="${channel._id}">Leave Channel</button>
                        `}
                    </div>
                `;

                userPrivateChannelsDiv.appendChild(channelItem);

                // Add event listeners
                if (isCreator) {
                    const inviteUserBtn = channelItem.querySelector('.invite-user-btn');

                    inviteUserBtn.addEventListener('click', function () {
                        const channelId = this.getAttribute('data-channel-id');
                        promptInviteUser(channelId);
                    });
                } else {
                    const leaveChannelBtn = channelItem.querySelector('.leave-channel-btn');

                    leaveChannelBtn.addEventListener('click', function () {
                        const channelId = this.getAttribute('data-channel-id');
                        leaveChannel(channelId);
                    });
                }
            });
        } catch (error) {
            console.error('Error loading private channels:', error);
            userPrivateChannelsDiv.innerHTML = '<div class="error-text">Failed to load channels. Please try again.</div>';
        }
    }

    // Load Pending Invitations
    async function loadPendingInvites() {
        if (!pendingInvitesDiv) return;

        try {
            pendingInvitesDiv.innerHTML = '<div class="loading-text">Loading invitations...</div>';

            const response = await fetch(`${API_URL}/all-channels-with-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch channels');
            }

            const allChannels = await response.json();

            // Filter to get channels where user has pending invites
            const pendingInviteChannels = allChannels.filter(channel =>
                channel.hasPendingInvite
            );

            console.log("Channels with pending invites:", pendingInviteChannels);

            if (pendingInviteChannels.length === 0) {
                pendingInvitesDiv.innerHTML = '<div class="empty-text">No pending invitations.</div>';
                return;
            }

            pendingInvitesDiv.innerHTML = '';

            // Display pending invitations
            pendingInviteChannels.forEach(channel => {
                const inviteItem = document.createElement('div');
                inviteItem.className = 'invitation-item';
                inviteItem.innerHTML = `
                    <div class="invitation-info">
                        <div class="channel-name">${channel.name}</div>
                    </div>
                    <div class="invitation-actions">
                        <button class="btn-success accept-invite-btn" data-channel-id="${channel._id}">Accept</button>
                        <button class="btn-danger decline-invite-btn" data-channel-id="${channel._id}">Decline</button>
                    </div>
                `;

                pendingInvitesDiv.appendChild(inviteItem);

                // Add event listeners
                const acceptBtn = inviteItem.querySelector('.accept-invite-btn');
                const declineBtn = inviteItem.querySelector('.decline-invite-btn');

                acceptBtn.addEventListener('click', function () {
                    const channelId = this.getAttribute('data-channel-id');
                    acceptChannelInvitation(channelId);
                });

                declineBtn.addEventListener('click', function () {
                    const channelId = this.getAttribute('data-channel-id');
                    declineChannelInvitation(channelId);
                });
            });
        } catch (error) {
            console.error('Error loading pending invitations:', error);
            pendingInvitesDiv.innerHTML = '<div class="error-text">Failed to load invitations. Please try again.</div>';
        }
    }

    // Load Pending Join Requests
    async function loadPendingRequests(channelId) {
        if (!pendingRequestsDiv) return;

        try {
            pendingRequestsDiv.innerHTML = '<div class="loading-text">Loading pending requests...</div>';

            const response = await fetch(`${API_URL}/channel/pending-requests/${channelId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch pending requests');
            }

            const requests = await response.json();

            if (requests.length === 0) {
                pendingRequestsDiv.innerHTML = '<div class="empty-text">No pending join requests.</div>';
                return;
            }

            pendingRequestsDiv.innerHTML = '';

            // Display pending requests
            requests.forEach(request => {
                const requestItem = document.createElement('div');
                requestItem.className = 'request-item';
                requestItem.innerHTML = `
                    <div class="request-info">
                        <div class="requester-name">${request.username}</div>
                    </div>
                    <div class="request-actions">
                        <button class="btn-success accept-request-btn" data-channel-id="${channelId}" data-user-id="${request._id}">Accept</button>
                        <button class="btn-danger reject-request-btn" data-channel-id="${channelId}" data-user-id="${request._id}">Reject</button>
                    </div>
                `;

                pendingRequestsDiv.appendChild(requestItem);

                // Add event listeners
                const acceptBtn = requestItem.querySelector('.accept-request-btn');
                const rejectBtn = requestItem.querySelector('.reject-request-btn');

                acceptBtn.addEventListener('click', function () {
                    const channelId = this.getAttribute('data-channel-id');
                    const userId = this.getAttribute('data-user-id');
                    acceptJoinRequest(channelId, userId);
                });

                rejectBtn.addEventListener('click', function () {
                    const channelId = this.getAttribute('data-channel-id');
                    const userId = this.getAttribute('data-user-id');
                    rejectJoinRequest(channelId, userId);
                });
            });
        } catch (error) {
            console.error('Error loading pending requests:', error);
            pendingRequestsDiv.innerHTML = '<div class="error-text">Failed to load pending requests. Please try again.</div>';
        }
    }

    // Accept a channel invitation
    async function acceptChannelInvitation(channelId) {
        try {
            const response = await fetch(`${API_URL}/channel/accept-invite/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                showResultMessage(data.message || 'You\'ve joined the channel successfully', true);
                loadPendingInvites();
                loadUserPrivateChannels();

                // Refresh nav bar channels
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                showResultMessage(data.error || 'Failed to accept invitation', false);
            }
        } catch (error) {
            console.error('Error accepting channel invitation:', error);
            showResultMessage('Failed to accept invitation. Please try again.', false);
        }
    }

    // Decline a channel invitation
    async function declineChannelInvitation(channelId) {
        try {
            const response = await fetch(`${API_URL}/channel/decline-invite/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                showResultMessage(data.message || 'Invitation declined', true);
                loadPendingInvites();

                // Refresh nav bar channels
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                showResultMessage(data.error || 'Failed to decline invitation', false);
            }
        } catch (error) {
            console.error('Error declining channel invitation:', error);
            showResultMessage('Failed to decline invitation. Please try again.', false);
        }
    }

    // Accept a join request
    async function acceptJoinRequest(channelId, userId) {
        try {
            const response = await fetch(`${API_URL}/channel/accept-request/${channelId}/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                showResultMessage(data.message, true);
                loadPendingRequests(channelId);
                loadUserPrivateChannels();
            } else {
                showResultMessage(data.error, false);
            }
        } catch (error) {
            console.error('Error accepting join request:', error);
            showResultMessage('Failed to accept join request. Please try again.', false);
        }
    }

    // Reject a join request
    async function rejectJoinRequest(channelId, userId) {
        try {
            const response = await fetch(`${API_URL}/channel/reject-request/${channelId}/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                showResultMessage(data.message, true);
                loadPendingRequests(channelId);
            } else {
                showResultMessage(data.error, false);
            }
        } catch (error) {
            console.error('Error rejecting join request:', error);
            showResultMessage('Failed to reject join request. Please try again.', false);
        }
    }

    // Prompt to invite a user
    function promptInviteUser(channelId) {
        const username = prompt('Enter the username to invite:');
        if (username) {
            inviteUser(channelId, username);
        }
    }

    // Invite a user to a channel
    async function inviteUser(channelId, username) {
        try {
            const response = await fetch(`${API_URL}/channel/invite/${channelId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username })
            });

            const data = await response.json();

            if (response.ok) {
                showResultMessage(data.message, true);
                loadUserPrivateChannels();
            } else {
                showResultMessage(data.error, false);
            }
        } catch (error) {
            console.error('Error inviting user:', error);
            showResultMessage('Failed to invite user. Please try again.', false);
        }
    }

    // Leave a channel
    async function leaveChannel(channelId) {
        if (!confirm('Are you sure you want to leave this channel?')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/channel/leave/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                showResultMessage(data.message, true);
                loadUserPrivateChannels();

                // Refresh nav bar channels
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                showResultMessage(data.error, false);
            }
        } catch (error) {
            console.error('Error leaving channel:', error);
            showResultMessage('Failed to leave channel. Please try again.', false);
        }
    }

    // Request to join a channel
    window.requestJoinChannel = async function (channelId) {
        try {
            const response = await fetch(`${API_URL}/channel/request-join/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);

                // Refresh nav bar channels
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error requesting to join channel:', error);
            alert('Failed to send join request. Please try again.');
        }
    };

    // Helper function to show result messages
    function showResultMessage(message, isSuccess) {
        if (!createResultDiv) return;

        createResultDiv.textContent = message;
        createResultDiv.className = isSuccess ? 'result-message success' : 'result-message error';

        // Show the message by setting display to block
        createResultDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            createResultDiv.style.display = 'none';
        }, 5000);
    }

    // Initialize the page
    loadUserPrivateChannels();
    loadPendingInvites();
});