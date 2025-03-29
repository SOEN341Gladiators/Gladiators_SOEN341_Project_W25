// public/registered_users.js
console.log('registered_users.js: Script loaded at', new Date().toISOString());

const userListManager = (function() {
    const socket = window.socket || io('http://localhost:5000', {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        forceNew: false
    });
    window.socket = socket;

    function formatLastSeen(timestamp) {
        if (!timestamp) return 'Never';
        const last = new Date(timestamp);
        if (isNaN(last.getTime())) return 'Invalid';
        const now = new Date();
        const diffMs = now - last;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMs < 0) return 'Just now';
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return last.toLocaleString();
    }

    function sortUsers(users) {
        const statusPriority = { 'online': 0, 'away': 1, 'offline': 2 };
        return users.sort((a, b) => {
            const statusA = statusPriority[a.status] ?? 3;
            const statusB = statusPriority[b.status] ?? 3;
            if (statusA !== statusB) return statusA - statusB;
            return a.username.localeCompare(b.username);
        });
    }

    function updateUserList(users) {
        console.log('updateUserList:', users.length, 'users');
        const userList = document.getElementById('userList');
        if (!userList) {
            console.error('updateUserList: #userList not found');
            return;
        }

        userList.innerHTML = '';
        if (!users || users.length === 0) {
            userList.innerHTML = '<li class="no-users">No users found</li>';
            return;
        }

        const sortedUsers = sortUsers(users);
        sortedUsers.forEach(user => {
            const li = document.createElement('li');
            li.dataset.username = user.username;
            li.innerHTML = `
                <span class="user-status status-${user.status}"></span>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="last-seen">Last seen: ${formatLastSeen(user.lastSeen)}</div>
                </div>
                <div class="user-menu">
                    <button class="menu-btn">⋮</button>
                    <div class="menu-dropdown">
                        <button class="dm-btn" data-username="${user.username}">DM</button>
                    </div>
                </div>
            `;
            userList.appendChild(li);

            // Toggle dropdown on menu button click
            const menuBtn = li.querySelector('.menu-btn');
            const dropdown = li.querySelector('.menu-dropdown');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing immediately
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });

            // DM navigation
            li.querySelector('.dm-btn').addEventListener('click', () => {
                console.log('Navigating to DM with:', user.username);
                window.location.href = `chat_page.html?dm=${encodeURIComponent(user.username)}`;
            });
        });

        // Close all dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-btn')) {
                document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');
            }
        });
    }

    function updateSingleUser(updatedUser) {
        console.log('updateSingleUser:', updatedUser);
        const userList = document.getElementById('userList');
        if (!userList) return;

        let userElement = document.querySelector(`#userList li[data-username="${updatedUser.username}"]`);
        if (userElement) {
            userList.removeChild(userElement);
        } else {
            userElement = document.createElement('li');
            userElement.dataset.username = updatedUser.username;
        }
        userElement.innerHTML = `
            <span class="user-status status-${updatedUser.status}"></span>
            <div class="user-info">
                <div class="user-name">${updatedUser.username}</div>
                <div class="last-seen">Last seen: ${formatLastSeen(updatedUser.lastSeen)}</div>
            </div>
            <div class="user-menu">
                <button class="menu-btn">⋮</button>
                <div class="menu-dropdown">
                    <button class="dm-btn" data-username="${updatedUser.username}">DM</button>
                </div>
            </div>
        `;

        const allUsers = Array.from(userList.children)
            .filter(li => !li.classList.contains('no-users'))
            .map(li => ({
                username: li.dataset.username,
                status: li.querySelector('.user-status').classList[1].split('-')[1]
            }));
        allUsers.push({ username: updatedUser.username, status: updatedUser.status });
        const sortedUsers = sortUsers(allUsers);
        const insertIndex = sortedUsers.findIndex(u => u.username === updatedUser.username);
        
        if (insertIndex === 0) {
            userList.insertBefore(userElement, userList.firstChild);
        } else {
            const prevUser = sortedUsers[insertIndex - 1];
            const prevElement = document.querySelector(`#userList li[data-username="${prevUser.username}"]`);
            userList.insertBefore(userElement, prevElement ? prevElement.nextSibling : null);
        }

        // Toggle dropdown for updated user
        const menuBtn = userElement.querySelector('.menu-btn');
        const dropdown = userElement.querySelector('.menu-dropdown');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        // DM navigation for updated user
        userElement.querySelector('.dm-btn').addEventListener('click', () => {
            console.log('Navigating to DM with:', updatedUser.username);
            window.location.href = `chat_page.html?dm=${encodeURIComponent(updatedUser.username)}`;
        });
    }

    function syncUserStatus() {
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('userRole');
        if (username && role) {
            console.log('Syncing status for:', { username, role });
            socket.emit('user info', { username, role });
        }
        socket.emit('getUsers');
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded at', new Date().toISOString());
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const users = Array.from(document.querySelectorAll('#userList li'));
                users.forEach(user => {
                    const username = user.querySelector('.user-name').textContent.toLowerCase();
                    user.style.display = username.includes(query) ? '' : 'none';
                });
            });
        }
        syncUserStatus();
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            console.log('Pageshow: Page restored from bfcache at', new Date().toISOString());
            if (!socket.connected) {
                console.log('Pageshow: Socket disconnected, reconnecting');
                socket.connect();
            }
            syncUserStatus();
        }
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        syncUserStatus();
    });

    socket.on('userList', updateUserList);
    socket.on('userStatusUpdate', updateSingleUser);
    socket.on('error', (message) => console.error('Socket error:', message));
    socket.on('connect_error', (err) => console.error('Socket connect_error:', err.message));
    socket.on('reconnect', () => {
        console.log('Socket reconnected');
        syncUserStatus();
    });

    return { socket, updateUserList, updateSingleUser };
})();

window.userListManager = userListManager;