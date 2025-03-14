// nav_bar.js - with fixes to preserve user chat functionality
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

    // Check if we're on the admin page
    const isAdminPage = window.location.pathname.includes('admin');

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
                } else {
                    // Regular chat page behavior
                    if (chatArea) chatArea.style.display = 'flex';
                    if (welcomeText) welcomeText.style.display = 'none';
                    if (startConversationText) startConversationText.style.display = 'none';
                }

                // Call joinDM function from messaging.js
                if (typeof window.joinDM === 'function') {
                    window.joinDM(user.username);
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
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('http://localhost:5000/channels', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch channels');
            }

            const channels = await response.json();
            displayChannels(channels);
        } catch (error) {
            console.error('Error fetching channels:', error);
            if (noChannels) {
                noChannels.style.display = 'block';
                noChannels.textContent = 'Error loading channels';
            }
        }
    }

    function displayChannels(channels) {
        if (!channelList) return;

        channelList.innerHTML = ''; // Clear existing channels
        if (noChannels) {
            noChannels.style.display = channels.length === 0 ? 'block' : 'none';
        }

        // Filter the channels by type
        const teamChannels = channels.filter(channel => channel.type === 'channel' || !channel.type);
        const dmChannels = channels.filter(channel => channel.type === 'dm');

        // Display regular team channels
        teamChannels.forEach(channel => {
            const channelButton = document.createElement('button');
            channelButton.className = 'channel-button';
            channelButton.innerHTML = `
                <span class="channel-icon">#</span>
                <span class="channel-name">${channel.name}</span>
            `;

            channelButton.addEventListener('click', () => {
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
                dmButton.innerHTML = `
                    <span class="channel-icon">@</span>
                    <span class="channel-name">${otherUser}</span>
                `;

                dmButton.addEventListener('click', () => {
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
            const channelButtons = channelList.getElementsByClassName('channel-button');

            Array.from(channelButtons).forEach(button => {
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

    // Make fetchChannels available globally so admin.js can trigger refreshes
    window.fetchChannels = fetchChannels;

    // Initialize channels on page load
    fetchChannels();
});