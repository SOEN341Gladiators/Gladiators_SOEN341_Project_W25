const channelList = document.getElementById('channelList');
const noChannels = document.getElementById('noChannels');
let channels = []; // Start with no channels


// Theme toggle
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-toggle-icon');
const themeText = themeToggle.querySelector('.theme-toggle-text');

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon and text
    themeIcon.textContent = newTheme === 'light' ? '🌑' : '☀️';
    themeText.textContent = `${newTheme === 'light' ? 'Dark' : 'Light'} mode`;
}

// Locally store theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeIcon.textContent = savedTheme === 'light' ? '🌑' : '☀️';
themeText.textContent = `${savedTheme === 'light' ? 'Dark' : 'Light'} mode`;

themeToggle.addEventListener('click', toggleTheme);

const searchInput = document.getElementById('searchInput');

let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let recentChannels = JSON.parse(localStorage.getItem('recentChannels')) || [];

// Section states
let sectionStates = JSON.parse(localStorage.getItem('sectionStates')) || {
    favorites: false,
    recent: false,
    available: false
};

// Toggle section visibility
function toggleSection(sectionName) {
    const section = document.querySelector(`.${sectionName}-list`);
    const button = document.querySelector(`.${sectionName}-title`);
    sectionStates[sectionName] = !sectionStates[sectionName];

    // Update the arrow and section visibility
    button.querySelector('.arrow').textContent = sectionStates[sectionName] ? '▼' : '▶';
    section.style.maxHeight = sectionStates[sectionName] ? `${section.scrollHeight}px` : '0';

    // Save state to localStorage
    localStorage.setItem('sectionStates', JSON.stringify(sectionStates));
}

// Create channel buttons
function createChannelButtons() {
    channelList.innerHTML = '';
    channels.forEach((channel, index) => {
        const channelId = `channel-${index + 1}`;
        const isFavorite = favorites.includes(channelId);

        const button = document.createElement('button');
        button.className = 'channel-button';
        button.id = channelId;
        button.innerHTML = `
            <span>${channel}</span>
            <span class="star-icon" data-channel-id="${channelId}">${isFavorite ? '★' : '☆'}</span>
        `;

        button.querySelector('.star-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(e.target.dataset.channelId);
        });

        button.addEventListener('click', () => selectChannel(channelId));
        channelList.appendChild(button);
    });
    noChannels.style.display = channels.length === 0 ? 'block' : 'none';
    updateChannelStars();

    // Show the welcome messages and hide the chat area
    welcomeText.style.display = 'flex';
    startConversationText.style.display = 'flex';
    chatArea.style.display = 'none';

    //reset title
    document.getElementById('channelTitle').textContent = '';
    document.getElementById('chatTitle').textContent = 'Channel/Recipient Name';
    selectedChat = null; // Reset selected chat
    loadChatHistory();
}

//Data Store
let chatHistory = {}; // Store chat messages per channel/friend
let selectedChat = null; // to store selected chat id (channel or friend)

//Select a Channel
function selectChannel(channelId) {
  document.querySelectorAll('.channel-button').forEach(btn => {
      btn.classList.remove('active');
  });

  const channelButton = document.getElementById(channelId);
  const channelNumber = channelId.split('-')[1];
  const channelName = channels[channelNumber - 1];

  channelButton.classList.add('active');
  document.title = `ChatHaven • ${channelName}`;
  document.getElementById('channelTitle').textContent = channelName;
  document.getElementById('chatTitle').textContent = channelName; // Set the chat title here!

  selectedChat = channelId; // Set the selected chat
  addToRecentChannels(channelId);

  // Show the chat area and hide the welcome messages
  welcomeText.style.display = 'none';
  startConversationText.style.display = 'none';
  chatArea.style.display = 'flex';

  loadChatHistory();
}

// Load chat history and displays in messages
function loadChatHistory() {
    chatMessages.innerHTML = ''; // Clear existing messages
    if (selectedChat && chatHistory[selectedChat]) {
        chatHistory[selectedChat].forEach(message => {
            const messageElem = document.createElement('div');
            messageElem.className = 'chat-message';

            messageElem.innerHTML = `
              <span class="chat-message-text">${message.text}</span>
              <span class="chat-message-time">${message.timestamp}</span>
            `;

            chatMessages.appendChild(messageElem);
        });
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add channel to recent list
function addToRecentChannels(channelId) {
    recentChannels = recentChannels.filter(id => id !== channelId);
    recentChannels.unshift(channelId);
    recentChannels = recentChannels.slice(0, 5);
    localStorage.setItem('recentChannels', JSON.stringify(recentChannels));
    updateRecentList();
}

// Update the recent channels list
function updateRecentList() {
    const recentList = document.getElementById('recentList');
    recentList.innerHTML = '';

    recentChannels.forEach(channelId => {
        const index = parseInt(channelId.split('-')[1]) - 1;
        const channelName = channels[index];
        const isFavorite = favorites.includes(channelId);

        const button = document.createElement('button');
        button.className = 'channel-button recent';
        button.innerHTML = `
            <span>${channelName}</span>
            <span class="star-icon" data-channel-id="${channelId}">${isFavorite ? '★' : '☆'}</span>
        `;

        button.querySelector('.star-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(e.target.dataset.channelId);
        });

        button.addEventListener('click', () => selectChannel(channelId));
        recentList.appendChild(button);
    });

    if (sectionStates.recent) {
        const section = document.querySelector('.recent-list');
        section.style.maxHeight = `${section.scrollHeight}px`;
    }
}

// Update channel stars
function updateChannelStars() {
    document.querySelectorAll('.channel-button').forEach(button => {
        const star = button.querySelector('.star-icon');
        if (star) {
            const channelId = star.dataset.channelId;
            star.textContent = favorites.includes(channelId) ? '★' : '☆';
        }
    });
}

// Toggle favorite
function toggleFavorite(channelId) {
    const index = favorites.indexOf(channelId);
    if (index === -1) {
        favorites.push(channelId);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateChannelStars();
    updateFavoritesList();
    updateRecentList();
}

// Update favorites list
function updateFavoritesList() {
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';

    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p class="empty-message">No favorite channels</p>';
    } else {
        favorites.forEach(channelId => {
            const index = parseInt(channelId.split('-')[1]) - 1;
            const channelName = channels[index];

            const button = document.createElement('button');
            button.className = 'channel-button favorite';
            button.innerHTML = `
                <span>${channelName}</span>
                <span class="star-icon" data-channel-id="${channelId}">★</span>
            `;

            button.querySelector('.star-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(e.target.dataset.channelId);
            });

            button.addEventListener('click', () => selectChannel(channelId));
            favoritesList.appendChild(button);
        });
    }

    if (sectionStates.favorites) {
        const section = document.querySelector('.favorites-list');
        section.style.maxHeight = `${section.scrollHeight}px`;
    }
}

// Search functionality
searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    let visibleCount = 0;

    document.querySelectorAll('.channel-button').forEach(button => {
        const text = button.textContent.toLowerCase();
        const isVisible = text.includes(query);
        button.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) visibleCount++;
    });

    noChannels.classList.toggle('show', visibleCount === 0);
});

// Available Users Management
let availableUsers = JSON.parse(localStorage.getItem('availableUsers')) || ['Ellie', 'Juan', 'Victor', 'John John'];

function updateAvailableUsersList() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    availableUsers.forEach(user => {
        const userButton = document.createElement('button');
        userButton.className = 'channel-button available';
        userButton.innerHTML = `<span>${user}</span>`;
        userButton.addEventListener('click', () => {
            document.getElementById('chatTitle').textContent = user;
            // Show the chat area and hide the welcome messages
            welcomeText.style.display = 'none';
            startConversationText.style.display = 'none';
            chatArea.style.display = 'flex';

            selectedChat = user; // Set the selected chat
            loadChatHistory();
        });
        usersList.appendChild(userButton);
    });

    localStorage.setItem('availableUsers', JSON.stringify(availableUsers));

    if (sectionStates.available) {
        usersList.style.maxHeight = `${usersList.scrollHeight}px`;
    }
}

// Initialize sections
function initializeSections() {
    // Favorites section
    const favoritesTitle = document.querySelector('.favorites-title');
    favoritesTitle.innerHTML = `<span class="arrow">${sectionStates.favorites ? '▼' : '▶'}</span> Favorite channels ⭐`;
    favoritesTitle.addEventListener('click', () => toggleSection('favorites'));

    // Recent section
    const recentTitle = document.querySelector('.recent-title');
    recentTitle.innerHTML = `<span class="arrow">${sectionStates.recent ? '▼' : '▶'}</span> Recent channels 🕒`;
    recentTitle.addEventListener('click', () => toggleSection('recent'));

    // Available users section
    const availableTitle = document.querySelector('.dropdown-title');
    availableTitle.innerHTML = `<span class="arrow">${sectionStates.available ? '▼' : '▶'}</span> Available ❇️`;
    availableTitle.addEventListener('click', () => {
        sectionStates.available = !sectionStates.available;
        const usersList = document.getElementById('usersList');
        usersList.style.maxHeight = sectionStates.available ? `${usersList.scrollHeight}px` : '0';
        availableTitle.querySelector('.arrow').textContent = sectionStates.available ? '▼' : '▶';
        localStorage.setItem('sectionStates', JSON.stringify(sectionStates));
    });

    // Apply initial states
    const lists = {
        favorites: document.querySelector('.favorites-list'),
        recent: document.querySelector('.recent-list'),
        available: document.getElementById('usersList')
    };

    Object.keys(lists).forEach(key => {
        if (lists[key]) {
            lists[key].style.maxHeight = sectionStates[key] ? `${lists[key].scrollHeight}px` : '0';
        }
    });
}

// Add Channel functionality
const addChannelTitle = document.querySelector('.add-channel-title');
const addChannelForm = document.getElementById('addChannelForm');

addChannelTitle.addEventListener('click', () => {
    addChannelForm.style.display = addChannelForm.style.display === 'none' ? 'block' : 'none';
});

addChannelForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newChannelName = document.getElementById('newChannelName').value.trim();
    if (newChannelName) {
        createNewChannel(newChannelName);
        document.getElementById('newChannelName').value = '';
        addChannelForm.style.display = 'none';
    }
});

// Add Friend functionality
const addFriendTitle = document.querySelector('.add-friend-title');
const addFriendForm = document.getElementById('addFriendForm');

addFriendTitle.addEventListener('click', () => {
    addFriendForm.style.display = addFriendForm.style.display === 'none' ? 'block' : 'none';
});

addFriendForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newFriendName = document.getElementById('newFriendName').value.trim();
    if (newFriendName && !availableUsers.includes(newFriendName)) {
        availableUsers.push(newFriendName);
        updateAvailableUsersList();
        document.getElementById('newFriendName').value = '';
        addFriendForm.style.display = 'none';

        // Open the available users section
        sectionStates.available = true;
        const usersList = document.getElementById('usersList');
        usersList.style.maxHeight = `${usersList.scrollHeight}px`;
        document.querySelector('.dropdown-title .arrow').textContent = '▼';
        localStorage.setItem('sectionStates', JSON.stringify(sectionStates));
    }
});

// new chat related function with delete option

let messageId = 0; // to generate unique message id

document.addEventListener('click', (e) => {
    const dropdowns = document.querySelectorAll('.Dropdown-menu');
    dropdowns.forEach(dropdown => {
        if (!dropdown.contains(e.target) && !e.target.matches('.message-actions')) {
            dropdown.classList.remove('show');
        }
    });
});

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();
    
    if (messageText === '') return;

    const chatMessages = document.getElementById('chatMessages');
    
    // Add timestamp
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.id = `message-${messageId}`;

    // Create message content with timestamp
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = `
        <div class="message-text">${messageText}</div>
        <div class="message-timestamp">${timestamp}</div>
    `;

    // Create actions dropdown
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.textContent = '⋮';
    
    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'Dropdown-menu';
    
    const deleteOption = document.createElement('div');
    deleteOption.className = 'delete-option';
    deleteOption.textContent = 'Delete message';
    // Fix the delete click handler
    deleteOption.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentId = messageDiv.id.split('-')[1];
        deleteMessage(currentId);
        dropdown.classList.remove('show');
    });
    
    dropdown.appendChild(deleteOption);
    
    // Modify actions click listener
    actions.addEventListener('click', (e) => {
        e.stopPropagation();
        // Hide all other dropdowns first
        document.querySelectorAll('.Dropdown-menu').forEach(menu => {
            if (menu !== dropdown) {
                menu.classList.remove('show');
            }
        });
        dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });

    // Assemble elements
    messageDiv.appendChild(content);
    messageDiv.appendChild(actions);
    messageDiv.appendChild(dropdown);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom and clear input
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.value = '';
    messageId++;
}

function deleteMessage(id) {
    const messageDiv = document.getElementById(`message-${id}`);
    if (messageDiv) {
        const content = messageDiv.querySelector('div:first-child');
        content.textContent = '🚫 Message deleted by moderator';
        content.classList.add('deleted');
        
        // Remove the action buttons
        const actions = messageDiv.querySelector('.message-actions');
        const dropdown = messageDiv.querySelector('.Dropdown-menu');
        if (actions) actions.remove();
        if (dropdown) dropdown.remove();
    }
}

// Allow Enter key to send messages
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

//end of changes made related to delete message

function closeChat() {
    // Show the welcome messages and hide the chat area
    welcomeText.style.display = 'flex';
    startConversationText.style.display = 'flex';
    chatArea.style.display = 'none';
    document.title = 'ChatHaven • My channels'; // Reset title
    document.getElementById('channelTitle').textContent = '';
    document.getElementById('chatTitle').textContent = 'Channel/Recipient Name';
    selectedChat = null; // Reset selected chat
    loadChatHistory();
}

// Create new channel helper function
function createNewChannel(channelName) {
    channels.push(channelName);
    createChannelButtons();
}

const welcomeText = document.getElementById('welcomeText');
const startConversationText = document.getElementById('startConversationText');
const chatArea = document.getElementById('chatArea');

// Initialize everything
createChannelButtons();
updateAvailableUsersList();
initializeSections();
updateFavoritesList();
updateRecentList();

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const dashboardContainer = document.getElementById('dashboardContainer');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    dashboardContainer.classList.toggle('expanded');
});

// Sidebar toggle - make sure menu collapses on page load
window.addEventListener('load', () => {
  if (!sidebar.classList.contains('collapsed')){
    sidebar.classList.add('collapsed');
    dashboardContainer.classList.remove('expanded');
  }
});