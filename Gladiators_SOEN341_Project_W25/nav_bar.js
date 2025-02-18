const channelList = document.getElementById('channelList');
const noChannels = document.getElementById('noChannels');
let channels = []; // Start with no channels

// theme toggle
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

// locally store theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeIcon.textContent = savedTheme === 'light' ? '🌑' : '☀️';
themeText.textContent = `${savedTheme === 'light' ? 'Dark' : 'Light'} mode`;

themeToggle.addEventListener('click', toggleTheme);

const searchInput = document.getElementById('searchInput');

let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let recentChannels = JSON.parse(localStorage.getItem('recentChannels')) || [];

// Initialize section states from localStorage or default to closed
let sectionStates = JSON.parse(localStorage.getItem('sectionStates')) || {
    favorites: false,
    recent: false
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
}

// Select a channel
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

    addToRecentChannels(channelId);
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

    // Update section height if expanded
    if (sectionStates.recent) {
        const section = document.querySelector('.recent-list');
        section.style.maxHeight = `${section.scrollHeight}px`;
    }
}

// Update the star icons for each channel
function updateChannelStars() {
    document.querySelectorAll('.channel-button').forEach(button => {
        const star = button.querySelector('.star-icon');
        if (star) {
            const channelId = star.dataset.channelId;
            star.textContent = favorites.includes(channelId) ? '★' : '☆';
        }
    });
}

// Toggle a channel as favorite
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

// Update the favorites list
function updateFavoritesList() {
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';
    
    //if there are no favorites
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<p class="empty-message">No favorite channels</p>';
    }
    else{
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

    // Update section height if expanded
    if (sectionStates.favorites) {
        const section = document.querySelector('.favorites-list');
        section.style.maxHeight = `${section.scrollHeight}px`;
    }
}

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

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const firstVisible = document.querySelector('.channel-button[style*="display: flex"]');
        if (firstVisible) firstVisible.click();
    }
});

// Initialize sections
function initializeSections() {
    // Set up favorites section
    const favoritesTitle = document.querySelector('.favorites-title');
    favoritesTitle.innerHTML = `<span class="arrow">${sectionStates.favorites ? '▼' : '▶'}</span> Favorite channels ⭐`;
    favoritesTitle.style.cursor = 'pointer';
    favoritesTitle.addEventListener('click', () => toggleSection('favorites'));

    // Set up recent section
    const recentTitle = document.querySelector('.recent-title');
    recentTitle.innerHTML = `<span class="arrow">${sectionStates.recent ? '▼' : '▶'}</span> Recent channels 🕒`;
    recentTitle.style.cursor = 'pointer';
    recentTitle.addEventListener('click', () => toggleSection('recent'));

    // Apply initial states
    const favoritesList = document.querySelector('.favorites-list');
    const recentList = document.querySelector('.recent-list');
    
    favoritesList.style.maxHeight = sectionStates.favorites ? `${favoritesList.scrollHeight}px` : '0';
    recentList.style.maxHeight = sectionStates.recent ? `${recentList.scrollHeight}px` : '0';
}

createChannelButtons();
updateFavoritesList();
updateRecentList();
initializeSections();

//sidebar toggle hide/show feature
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const dashboard = document.querySelector('.dashboard-container');

// Load sidebar state from localStorage
const isSidebarHidden = localStorage.getItem('sidebarHidden') === 'true';
if (isSidebarHidden) {
    sidebar.classList.add('collapsed');
    dashboard.classList.add('expanded');
}

// Toggle Sidebar
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    dashboard.classList.toggle('expanded');

    // Save state to localStorage
    localStorage.setItem('sidebarHidden', sidebar.classList.contains('collapsed'));
});

// Add Channel functionality
const addChannelTitle = document.querySelector('.add-channel-title');
const addChannelForm = document.getElementById('addChannelForm');
const newChannelNameInput = document.getElementById('newChannelName');

addChannelTitle.addEventListener('click', () => {
    addChannelForm.style.display = addChannelForm.style.display === 'none' ? 'block' : 'none';
});

addChannelForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newChannelName = newChannelNameInput.value.trim();
    if (newChannelName) {
        createNewChannel(newChannelName);
        newChannelNameInput.value = '';
        addChannelForm.style.display = 'none';
    }
});

function createNewChannel(channelName) {
    const channelId = `channel-${channels.length + 1}`;
    channels.push(channelName);

    const button = document.createElement('button');
    button.className = 'channel-button';
    button.id = channelId;
    button.innerHTML = `
        <span>${channelName}</span>
        <span class="star-icon" data-channel-id="${channelId}">☆</span>
    `;

    button.querySelector('.star-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(e.target.dataset.channelId);
    });

    button.addEventListener('click', () => selectChannel(channelId));
    channelList.appendChild(button);
    noChannels.style.display = 'none';
    updateChannelStars();
}

// New Chat Area Functionality
// used malik's code as ref

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const contactsDropdown = document.getElementById('contactsDropdown');

chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (messageText === "") return;
    
    // Create and append a new chat message element
    const messageElem = document.createElement('div');
    messageElem.className = 'chat-message';
    messageElem.textContent = messageText;
    chatMessages.appendChild(messageElem);
    
    // Clear the input and auto-scroll to the bottom
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// NEW CODE: dropdown for available users

// Select the dropdown title and list container
const availableDropdownTitle = document.querySelector('.dropdown-title');
const usersListContainer = document.getElementById('usersList');

// placeholder array of available users, idk if you want to have an array of all users
// might be inefficient for backend so just wanted to highlight
let availableUsers = ['Ellie', 'Juan', 'Victor', 'John John'];

// Function to populate the dropdown with available users
function populateUsersDropdown() {
    usersListContainer.innerHTML = '';
    availableUsers.forEach(user => {
        const userButton = document.createElement('button');
        userButton.className = 'channel-button available';
        userButton.innerHTML = `<span>${user}</span>`;
        userButton.addEventListener('click', () => {
            // chat title to the selected user's name
            document.getElementById('chatTitle').textContent = user;
            // disappear the dropdown after selection
            usersListContainer.style.maxHeight = '0';
        });
        usersListContainer.appendChild(userButton);
    });
}


// NEW
// Initialize the dropdown with available users
populateUsersDropdown();

// Toggle the dropdown visibility when the title is clicked
availableDropdownTitle.addEventListener('click', () => {
    if (usersListContainer.style.maxHeight && usersListContainer.style.maxHeight !== '0px') {
        usersListContainer.style.maxHeight = '0';
    } else {
        usersListContainer.style.maxHeight = usersListContainer.scrollHeight + 'px';
    }
});

// close chat from malik's
function closeChat() {
    window.location.href = "member.html";
  }
  
