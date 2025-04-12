// nav_bar.js - with private channel support and invitation system

// Extract DM user from the URL if present
const urlParams = new URLSearchParams(window.location.search);
const dmUser = urlParams.get('dm');

document.addEventListener('DOMContentLoaded', function () {
    // Initialize UI elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const channelList = document.getElementById('channelList');
    const noChannels = document.getElementById('noChannels');
    const searchInput = document.getElementById('searchInput');
    const chatArea = document.getElementById('chatArea');
    const welcomeText = document.getElementById('welcomeText');
    const startConversationText = document.getElementById('startConversationText');
    const addChannelForm = document.getElementById('addChannelForm');
    const addChannelTitle = document.querySelector('.add-channel-title');
    const dmTitle = document.querySelector('.dm-title');
    const dmDropdown = document.getElementById('dmDropdown');
    const addFriendForm = document.getElementById('addFriendForm');
    const addFriendTitle = document.querySelector('.add-friend-title');
    const privateChannelForm = document.getElementById('privateChannelForm');
    const privateChannelTitle = document.querySelector('.private-channel-title');
    const privateChannelsList = document.getElementById('privateChannelsList');

    // Check if we're on the admin page or create channel page
    const isAdminPage = window.location.pathname.includes('admin');
    const isCreateChannelPage = window.location.pathname.includes('create_channel.html');

    // Function to navigate to chat page
    function navigateToChatPage(channelId, channelName) {
        // Store the channel info in localStorage
        localStorage.setItem('selectedChannelId', channelId);
        localStorage.setItem('selectedChannelName', channelName);

        // Redirect to chat page
        window.location.href = 'chat_page.html';
    }

    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);

        themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Sidebar toggle functionality
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '➡️' : '⬅️';
        });
    }

    // Fetch users to populate DM List
    async function loadUsers() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('http://localhost:5000/users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const users = await response.json();
            populateUserList(users);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    // Function to populate the DM dropdown list with users
    function populateUserList(users) {
        const dmDropdownList = document.getElementById('dmDropdownList');
        if (!dmDropdownList) {
            return;
        }

        dmDropdownList.innerHTML = ''; // Clear existing items
        const currentUser = localStorage.getItem('username');

        users.forEach(user => {
            // Skip the current user so you don't join a DM with yourself
            if (user.username === currentUser) return;

            const li = document.createElement('li');
            li.className = 'dm-item';
            li.textContent = user.username || 'Unknown User';

            // When a user is clicked, open a DM with that user
            li.addEventListener('click', () => {
                // Reset active state on all channel buttons
                document.querySelectorAll('.channel-button').forEach(btn => {
                    btn.classList.remove('active');
                });

                // For admin page
                if (isAdminPage && typeof window.handleAdminChannelClick === 'function') {
                    // Special handling for admin page will be added later
                } else if (isCreateChannelPage) {
                    // For create_channel page, redirect to chat_page.html
                    if (typeof window.joinDM === 'function') {
                        localStorage.setItem('selectedDmUser', user.username);
                        window.location.href = 'chat_page.html';
                    }
                } else {
                    // Regular chat page behavior
                    if (chatArea) chatArea.style.display = 'flex';
                    if (welcomeText) welcomeText.style.display = 'none';
                    if (startConversationText) startConversationText.style.display = 'none';

                    // Call joinDM function from messaging.js
                    if (typeof window.joinDM === 'function') {
                        window.joinDM(user.username);
                    }
                }

                // Hide the dropdown after selection
                if (dmDropdown) dmDropdown.style.display = 'none';
            });

            dmDropdownList.appendChild(li);
        });
    }

    // Channel management functions
    async function fetchChannels() {
        try {
            console.log("⏳ Starting to fetch channels...");
            console.log("🔐 Token:", localStorage.getItem('token')?.substring(0, 10) + "...");
            console.log("👤 User ID:", localStorage.getItem('userId'));
            console.log("👤 Username:", localStorage.getItem('username'));

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            // Use the endpoint that includes all channels with status
            const response = await fetch('http://localhost:5000/all-channels-with-status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                // Fall back to regular channels endpoint if new one isn't available
                const fallbackResponse = await fetch('http://localhost:5000/channels', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!fallbackResponse.ok) {
                    throw new Error('Failed to fetch channels');
                }

                const fallbackData = await fallbackResponse.json();
                displayChannels(fallbackData);
                displayPrivateChannels(fallbackData);
                return;
            }

            const channels = await response.json();
            console.log("📢 All channels received:", channels);

            // Check if userId matches any users in the private channels
            if (channels.some(channel => channel.isPrivate)) {
                const userId = localStorage.getItem('userId');
                channels.filter(channel => channel.isPrivate).forEach(privateChannel => {
                    console.log(`Channel ${privateChannel.name} - Member: ${privateChannel.isMember}, 
                                Creator: ${privateChannel.isCreator}, 
                                PendingRequest: ${privateChannel.hasPendingRequest}, 
                                PendingInvite: ${privateChannel.hasPendingInvite}`);
                });
            }

            // Display the channels in the sidebar
            displayChannels(channels);
            displayPrivateChannels(channels);
        } catch (error) {
            console.error('❌ Error fetching channels:', error);
            if (noChannels) {
                noChannels.style.display = 'block';
                noChannels.textContent = 'Error loading channels';
            }
        }
    }

    // Function to display private channels separately
    function displayPrivateChannels(channels) {
        console.log("📊 Starting displayPrivateChannels function");
        console.log("🧩 privateChannelsList element:", privateChannelsList);

        if (!privateChannelsList) {
            console.error("❌ privateChannelsList element not found!");
            return;
        }

        // Filter to only include private channels
        const privateChannels = channels.filter(channel => channel.isPrivate);
        console.log("🔒 Found", privateChannels.length, "private channels");

        privateChannelsList.innerHTML = '';

        if (privateChannels.length === 0) {
            console.log("ℹ️ No private channels found");
            privateChannelsList.innerHTML = '<div class="no-channels">No private channels found</div>';
            return;
        }

        const userId = localStorage.getItem('userId');
        console.log("👤 Current userId for membership check:", userId);

        privateChannels.forEach(channel => {
            console.log(`🔍 Processing private channel: ${channel.name}`);

            const channelButton = document.createElement('button');
            channelButton.className = 'channel-button private-channel';
            channelButton.setAttribute('data-channel-id', channel._id);
            channelButton.setAttribute('data-channel-name', channel.name);

            // Check various statuses - fallback to array checking if properties aren't available
            const isMember = channel.isMember !== undefined ?
                channel.isMember :
                (channel.users && channel.users.some(id =>
                    typeof id === 'string' ? id === userId : id.toString() === userId
                ));

            const isCreator = channel.isCreator !== undefined ?
                channel.isCreator :
                (channel.createdBy && (
                    typeof channel.createdBy === 'string' ?
                        channel.createdBy === userId :
                        channel.createdBy.toString() === userId
                ));

            const hasPendingRequest = channel.hasPendingRequest !== undefined ?
                channel.hasPendingRequest :
                (channel.pendingRequests && channel.pendingRequests.some(id =>
                    typeof id === 'string' ? id === userId : id.toString() === userId
                ));

            const hasPendingInvite = channel.hasPendingInvite !== undefined ?
                channel.hasPendingInvite :
                (channel.pendingInvites && channel.pendingInvites.some(id =>
                    typeof id === 'string' ? id === userId : id.toString() === userId
                ));

            console.log(`Channel ${channel.name} - Member: ${isMember}, Creator: ${isCreator}, 
                         PendingRequest: ${hasPendingRequest}, PendingInvite: ${hasPendingInvite}`);

            // Apply appropriate styling based on status
            if (!isMember) {
                channelButton.classList.add('locked');
            }

            // Add appropriate icon and badge based on status
            let icon = isMember ? '#' : '🔒';
            let badge = '';

            if (hasPendingInvite) {
                badge = '<span class="invitation-badge">Invitation</span>';
            } else if (hasPendingRequest) {
                badge = '<span class="pending-badge">Pending</span>';
            } else if (!isMember && !isCreator) {
                badge = '<span class="request-join-badge">Request Access</span>';
            }

            channelButton.innerHTML = `
                <span class="channel-icon">${icon}</span>
                <span class="channel-name">${channel.name}</span>
                ${badge}
            `;

            channelButton.addEventListener('click', () => {
                // If user has a pending invitation
                if (hasPendingInvite) {
                    const acceptInvite = confirm(`You have an invitation to join "${channel.name}". Would you like to accept?`);
                    if (acceptInvite) {
                        acceptChannelInvitation(channel._id);
                    } else {
                        declineChannelInvitation(channel._id);
                    }
                    return;
                }

                // If user isn't a member and not invited, show join request dialog
                if (!isMember && !isCreator && !hasPendingRequest) {
                    if (confirm(`Would you like to request access to join the "${channel.name}" channel?`)) {
                        if (typeof window.requestJoinChannel === 'function') {
                            window.requestJoinChannel(channel._id);
                        }
                    }
                    return;
                }

                // If user has pending request, show status
                if (hasPendingRequest) {
                    alert(`Your request to join "${channel.name}" is pending approval.`);
                    return;
                }

                // If user is a member, proceed with normal channel access
                if (isMember) {
                    if (isCreateChannelPage) {
                        // For create_channel page, navigate to chat page
                        navigateToChatPage(channel._id, channel.name);
                    } else {
                        // Remove active class from all channels
                        document.querySelectorAll('.channel-button').forEach(btn => {
                            btn.classList.remove('active');
                        });

                        // Add active class to clicked channel
                        channelButton.classList.add('active');

                        // Different behavior on admin page
                        if (isAdminPage && typeof window.handleAdminChannelClick === 'function') {
                            window.handleAdminChannelClick(channel._id, channel.name);
                        } else {
                            // Regular chat page behavior - show chat area and hide welcome text
                            if (chatArea) chatArea.style.display = 'flex';
                            if (welcomeText) welcomeText.style.display = 'none';
                            if (startConversationText) startConversationText.style.display = 'none';
                            if (document.getElementById('chatTitle'))
                                document.getElementById('chatTitle').textContent = channel.name;

                            // Join the channel (using the messaging.js functionality)
                            if (typeof window.joinChannel === 'function') {
                                window.joinChannel(channel._id);
                            }
                        }
                    }
                }
            });

            privateChannelsList.appendChild(channelButton);
        });
    }

    // Display Channels function
    function displayChannels(channels) {
        if (!channelList) return;

        channelList.innerHTML = ''; // Clear existing channels
        if (noChannels) {
            noChannels.style.display = channels.length === 0 ? 'block' : 'none';
        }

        // Filter the channels by type
        const teamChannels = channels.filter(channel => channel.type === 'channel' && !channel.isDefault && !channel.isPrivate);
        const defaultChannels = channels.filter(channel => channel.isDefault);
        const dmChannels = channels.filter(channel => channel.type === 'dm');

        // Create a section for default channels if there are any
        if (defaultChannels.length > 0) {
            const defaultSection = document.createElement('div');
            defaultSection.className = 'default-channels-section';

            const defaultTitle = document.createElement('div');
            defaultTitle.className = 'default-channels-title';
            defaultTitle.innerHTML = '📢 Default Channels';
            defaultSection.appendChild(defaultTitle);

            // Add each default channel to the section
            defaultChannels.forEach(channel => {
                const channelButton = document.createElement('button');
                channelButton.className = 'channel-button default-channel';
                channelButton.setAttribute('data-channel-id', channel._id);
                channelButton.setAttribute('data-channel-name', channel.name);
                channelButton.innerHTML = `
                <span class="channel-icon">#</span>
                <span class="channel-name">${channel.name}</span>
                `;

                channelButton.addEventListener('click', () => {
                    if (isCreateChannelPage) {
                        // For create_channel page, navigate to chat page
                        navigateToChatPage(channel._id, channel.name);
                    } else {
                        // Remove active class from all channels
                        document.querySelectorAll('.channel-button').forEach(btn => {
                            btn.classList.remove('active');
                        });

                        // Add active class to clicked channel
                        channelButton.classList.add('active');

                        // Different behavior on admin page
                        if (isAdminPage && typeof window.handleAdminChannelClick === 'function') {
                            window.handleAdminChannelClick(channel._id, channel.name);
                        } else {
                            // Regular chat page behavior - show chat area and hide welcome text
                            if (chatArea) chatArea.style.display = 'flex';
                            if (welcomeText) welcomeText.style.display = 'none';
                            if (startConversationText) startConversationText.style.display = 'none';
                            if (document.getElementById('chatTitle'))
                                document.getElementById('chatTitle').textContent = channel.name;

                            // Join the channel (using the messaging.js functionality)
                            if (typeof window.joinChannel === 'function') {
                                window.joinChannel(channel._id);
                            }
                        }
                    }
                });

                defaultSection.appendChild(channelButton);
            });

            // Add the default channels section to the beginning of the channel list
            channelList.appendChild(defaultSection);
        }

        // Display regular team channels
        teamChannels.forEach(channel => {
            const channelButton = document.createElement('button');
            channelButton.className = 'channel-button';
            channelButton.setAttribute('data-channel-id', channel._id);
            channelButton.setAttribute('data-channel-name', channel.name);
            channelButton.innerHTML = `
            <span class="channel-icon">#</span>
            <span class="channel-name">${channel.name}</span>
            `;

            channelButton.addEventListener('click', () => {
                if (isCreateChannelPage) {
                    // For create_channel page, navigate to chat page
                    navigateToChatPage(channel._id, channel.name);
                } else {
                    // Remove active class from all channels
                    document.querySelectorAll('.channel-button').forEach(btn => {
                        btn.classList.remove('active');
                    });

                    // Add active class to clicked channel
                    channelButton.classList.add('active');

                    // Different behavior on admin page
                    if (isAdminPage && typeof window.handleAdminChannelClick === 'function') {
                        window.handleAdminChannelClick(channel._id, channel.name);
                    } else {
                        // Regular chat page behavior - show chat area and hide welcome text
                        if (chatArea) chatArea.style.display = 'flex';
                        if (welcomeText) welcomeText.style.display = 'none';
                        if (startConversationText) startConversationText.style.display = 'none';
                        if (document.getElementById('chatTitle'))
                            document.getElementById('chatTitle').textContent = channel.name;

                        // Join the channel (using the messaging.js functionality)
                        if (typeof window.joinChannel === 'function') {
                            window.joinChannel(channel._id);
                        }
                    }
                }
            });

            channelList.appendChild(channelButton);
        });

        // Add DM channels to a separate section if any exist
        if (dmChannels.length > 0) {
            const dmSection = document.createElement('div');
            dmSection.className = 'dm-channels-section';
            dmSection.innerHTML = '<h3>Direct Messages</h3>';

            dmChannels.forEach(channel => {
                // For DM channels, extract the other username from the format "user1_user2"
                const currentUsername = localStorage.getItem('username');
                const dmName = channel.name.split('_');
                const otherUser = dmName[0] === currentUsername ? dmName[1] : dmName[0];

                const dmButton = document.createElement('button');
                dmButton.className = 'channel-button dm-button';
                dmButton.setAttribute('data-channel-id', channel._id);
                dmButton.setAttribute('data-dm-user', otherUser);
                dmButton.innerHTML = `
                <span class="channel-icon">@</span>
                <span class="channel-name">${otherUser}</span>
                `;

                dmButton.addEventListener('click', () => {
                    if (isCreateChannelPage) {
                        // For create_channel page, navigate to chat page with DM info
                        localStorage.setItem('selectedDmUser', otherUser);
                        window.location.href = 'chat_page.html';
                    } else {
                        // Remove active class from all channels
                        document.querySelectorAll('.channel-button').forEach(btn => {
                            btn.classList.remove('active');
                        });

                        // Add active class to clicked DM
                        dmButton.classList.add('active');

                        // Different behavior on admin page
                        if (isAdminPage && typeof window.handleAdminChannelClick === 'function') {
                            window.handleAdminChannelClick(channel._id, otherUser);
                        } else {
                            // Regular chat page behavior
                            if (chatArea) chatArea.style.display = 'flex';
                            if (welcomeText) welcomeText.style.display = 'none';
                            if (startConversationText) startConversationText.style.display = 'none';
                            if (document.getElementById('chatTitle'))
                                document.getElementById('chatTitle').textContent = otherUser;

                            // Join the DM channel
                            if (typeof window.joinChannel === 'function') {
                                window.joinChannel(channel._id);
                            }
                        }
                    }
                });

                dmSection.appendChild(dmButton);
            });

            channelList.appendChild(dmSection);
        }
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const channelButtons = document.querySelectorAll('.channel-button');

            channelButtons.forEach(button => {
                const channelName = button.querySelector('.channel-name').textContent.toLowerCase();
                button.style.display = channelName.includes(searchTerm) ? 'flex' : 'none';
            });
        });
    }

    // Add channel form toggle
    if (addChannelTitle && addChannelForm) {
        addChannelTitle.addEventListener('click', () => {
            addChannelForm.style.display = addChannelForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    // DM dropdown toggle
    if (dmTitle && dmDropdown) {
        dmTitle.addEventListener('click', () => {
            if (dmDropdown.style.display === 'none' || dmDropdown.style.display === '') {
                dmDropdown.style.display = 'block';
                loadUsers(); // Refresh the list when opening
            } else {
                dmDropdown.style.display = 'none';
            }
        });
    }

    // Add friend form toggle
    if (addFriendTitle && addFriendForm) {
        addFriendTitle.addEventListener('click', () => {
            addFriendForm.style.display = addFriendForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Private Channel form toggle - not used with link version
    if (privateChannelTitle && privateChannelForm) {
        privateChannelTitle.addEventListener('click', () => {
            privateChannelForm.style.display = privateChannelForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Functions to handle channel invitations
    async function acceptChannelInvitation(channelId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/channel/accept-invite/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'You have joined the channel');
                // Refresh channels to reflect the change
                fetchChannels();
            } else {
                alert(data.error || 'Failed to accept invitation');
            }
        } catch (error) {
            console.error('Error accepting channel invitation:', error);
            alert('Failed to accept invitation. Please try again.');
        }
    }

    async function declineChannelInvitation(channelId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/channel/decline-invite/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'Invitation declined');
                // Refresh channels to reflect the change
                fetchChannels();
            } else {
                alert(data.error || 'Failed to decline invitation');
            }
        } catch (error) {
            console.error('Error declining channel invitation:', error);
            alert('Failed to decline invitation. Please try again.');
        }
    }

    // Private Channel form submission
    if (privateChannelForm) {
        privateChannelForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const channelName = document.getElementById('privateChannelName').value.trim();
            const invitedUsersText = document.getElementById('invitedUsers').value.trim();

            // Process invited users
            let invitedUsers = [];
            if (invitedUsersText) {
                invitedUsers = invitedUsersText.split(',')
                    .map(username => username.trim())
                    .filter(username => username !== '');
            }

            if (!channelName) {
                alert('Channel name is required');
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:5000/user/private-channel', {
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

                if (response.ok) {
                    alert(`Private channel "${channelName}" created successfully!`);

                    // Clear and hide the form
                    document.getElementById('privateChannelName').value = '';
                    document.getElementById('invitedUsers').value = '';
                    privateChannelForm.style.display = 'none';

                    // Refresh channels list
                    fetchChannels();
                } else {
                    alert(`Failed to create private channel: ${data.error}`);
                }
            } catch (error) {
                console.error('Error creating private channel:', error);
                alert('Failed to create private channel. Please try again.');
            }
        });
    }

    // Add friend form submission
    if (addFriendForm) {
        addFriendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const friendName = document.getElementById('newFriendName').value.trim();

            if (!friendName) {
                alert('Please enter a valid username');
                return;
            }

            try {
                if (isCreateChannelPage) {
                    // For create_channel page, navigate to chat page with DM info
                    localStorage.setItem('selectedDmUser', friendName);
                    window.location.href = 'chat_page.html';
                } else {
                    // Start a direct message with this user
                    if (typeof window.joinDM === 'function') {
                        window.joinDM(friendName);

                        // Clear and hide the form
                        document.getElementById('newFriendName').value = '';
                        addFriendForm.style.display = 'none';

                        // Refresh channels to show the new DM
                        setTimeout(fetchChannels, 1000);
                    } else {
                        throw new Error('joinDM function not found');
                    }
                }
            } catch (error) {
                console.error('Error adding friend:', error);
                alert('Failed to add friend. Please check the username and try again.');
            }
        });
    }

    // Add channel form submission
    if (addChannelForm) {
        addChannelForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const channelName = document.getElementById('newChannelName').value;

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:5000/admin/channel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: channelName,
                        teamName: localStorage.getItem('team'), // Assuming team is stored in localStorage
                        users: [localStorage.getItem('username')] // Add current user to channel
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to create channel');
                }

                // Clear form and hide it
                document.getElementById('newChannelName').value = '';
                addChannelForm.style.display = 'none';

                // Refresh channels list
                fetchChannels();
            } catch (error) {
                console.error('Error creating channel:', error);
                alert('Failed to create channel');
            }
        });
    }

    // Function to request joining a private channel
    window.requestJoinChannel = async function (channelId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/channel/request-join/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'Join request sent successfully');
                // Refresh channels list
                fetchChannels();
            } else {
                alert(data.error || 'Failed to send join request');
            }
        } catch (error) {
            console.error('Error requesting to join channel:', error);
            alert('Failed to send join request. Please try again.');
        }
    };

    // Check if we need to auto-join a channel from localStorage on chat page
    if (!isCreateChannelPage) {
        const selectedChannelId = localStorage.getItem('selectedChannelId');
        const selectedDmUser = localStorage.getItem('selectedDmUser');

        if (selectedChannelId) {
            // Clear the localStorage data after reading
            const channelId = selectedChannelId;
            const channelName = localStorage.getItem('selectedChannelName') || '';

            localStorage.removeItem('selectedChannelId');
            localStorage.removeItem('selectedChannelName');

            // Wait for page to fully load then join the channel
            setTimeout(() => {
                if (typeof window.joinChannel === 'function') {
                    console.log("Auto-joining channel:", channelId, channelName);
                    // Set DM title and show chat area
                    if (document.getElementById('chatTitle')) {
                        document.getElementById('chatTitle').textContent = dmUser;
                    }
                    if (chatArea) chatArea.style.display = 'flex';
                    if (welcomeText) welcomeText.style.display = 'none';
                    if (startConversationText) startConversationText.style.display = 'none';

                    // Join the DM
                    window.joinDM(dmUser);
                }
            }, 500);
        }
    }

    // Make fetchChannels available globally
    window.fetchChannels = fetchChannels;

    // Initialize channels on page load
    fetchChannels();
});