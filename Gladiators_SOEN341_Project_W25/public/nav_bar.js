// nav_bar.js
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

    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Sidebar toggle functionality
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '➡️' : '⬅️';
    });

    // Fetch users to populate DM List
    async function loadUsers() {
        try {
          const response = await fetch('/users'); // Adjust the endpoint as needed
          if (!response.ok) {
            throw new Error('Network response was not ok');
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
        dmDropdownList.innerHTML = ''; // Clear existing items
        const currentUser = localStorage.getItem('username');
    
        users.forEach(user => {
            // Skip the current user so you don't join a DM with yourself
            if (user.username === currentUser) return;

            const li = document.createElement('li');
            li.className = 'dm-item';
            li.textContent = user.username || user.name || 'Unknown User';
        
            // When a user is clicked, open a DM with that user
            li.addEventListener('click', () => {
                joinDM(user.username);
                // Optionally, hide the dropdown after a selection is made
                document.getElementById('dmDropdown').style.display = 'none';
                document.getElementById('chatTitle').textContent = user.username;
            });
        
            dmDropdownList.appendChild(li);
        });
    }

    // Channel management functions
    async function fetchChannels() {
        try {
            const token = localStorage.getItem('token');
            console.log('Token:', token);
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
            console.log('Error fetching channels:', error);
            noChannels.style.display = 'block';
            noChannels.textContent = 'Error loading channels';
        }
    }

    function displayChannels(channels) {
        channelList.innerHTML = ''; // Clear existing channels
        noChannels.style.display = channels.length === 0 ? 'block' : 'none';

        channels.forEach(channel => {
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

                // Update chat area
                chatArea.style.display = 'flex';
                welcomeText.style.display = 'none';
                startConversationText.style.display = 'none';
                document.getElementById('chatTitle').textContent = channel.name;

                // Join the channel (using the messaging.js functionality)
                if (typeof joinChannel === 'function') {
                    joinChannel(channel._id);
                }
            });

            channelList.appendChild(channelButton);
        });
    }

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const channelButtons = channelList.getElementsByClassName('channel-button');

        Array.from(channelButtons).forEach(button => {
            const channelName = button.querySelector('.channel-name').textContent.toLowerCase();
            button.style.display = channelName.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    // Add channel form toggle
    addChannelTitle.addEventListener('click', () => {
        addChannelForm.style.display = addChannelForm.style.display === 'none' ? 'block' : 'none';
    });

    // Add channel form toggle
    dmTitle.addEventListener('click', () => {
        if (dmDropdown.style.display === 'none' || dmDropdown.style.display === '') {
            dmDropdown.style.display = 'block';
            loadUsers(); // Refresh the list when opening
        } else {
            dmDropdown.style.display = 'none';
        }
    });

    // Add channel form submission
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

    // Initialize channels on page load
    fetchChannels();
});