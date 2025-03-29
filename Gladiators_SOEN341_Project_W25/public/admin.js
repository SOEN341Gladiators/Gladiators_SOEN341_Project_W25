document.addEventListener("DOMContentLoaded", function () {
    console.log("🔹 Document fully loaded. Initializing event listeners...");

    const createChannelForm = document.getElementById("createChannelForm");
    const createTeamForm = document.getElementById("createTeamForm");
    const createDefaultChannelForm = document.getElementById("createDefaultChannelForm");

    if (!createChannelForm || !createTeamForm) {
        console.error("❌ Form elements not found. Check admin.html IDs.");
        return;
    }

    const API_URL = "http://localhost:5000";

    // Create a Team
    createTeamForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const teamName = document.getElementById("teamName").value.trim();
        const users = document.getElementById("teamUsers").value
            .split(",")
            .map(user => user.trim())
            .filter(user => user !== "");

        console.log(`🔹 Sending request to create team: '${teamName}' with users:`, users);

        if (!teamName || users.length === 0) {
            alert("❌ Please enter a team name and at least one user.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/team`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem("token")
                },
                body: JSON.stringify({ teamName, users })
            });

            const data = await response.json();
            console.log("🔹 Server Response:", data);

            if (response.ok) {
                alert(`✅ Team '${teamName}' created successfully!`);
                createTeamForm.reset();
                document.getElementById("team-result").innerText = data.message;
                loadTeams();

                // Refresh the channel list in the sidebar
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error("❌ Error sending team creation request:", error);
            alert("❌ Failed to create team! Check server logs.");
        }
    });

    // Create a Channel
    createChannelForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const name = document.getElementById("channelName").value.trim();
        const teamName = document.getElementById("channelTeam").value.trim();
        const users = document.getElementById("channelUsers").value
            .split(",")
            .map(user => user.trim())
            .filter(user => user !== "");

        console.log(`🔹 Sending request to create channel: '${name}' for team '${teamName}' with users:`, users);

        if (!name || !teamName || users.length === 0) {
            alert("❌ Please enter a channel name, team name, and at least one user.");
            return;
        }

        console.log("📤 Sending Payload:", JSON.stringify({ name, teamName, users }, null, 2));

        try {
            const response = await fetch(`${API_URL}/admin/channel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem("token")
                },
                body: JSON.stringify({ name, teamName, users })
            });

            const data = await response.json();
            console.log("🔹 Server Response:", data);

            if (response.ok) {
                alert(`✅ Channel '${name}' created successfully!`);
                createChannelForm.reset();
                document.getElementById("channel-result").innerText = data.message;
                loadChannels();

                // Refresh the channel list in the sidebar
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error("❌ Error sending channel creation request:", error);
            alert("❌ Failed to create channel! Check server logs.");
        }
    });

    // Create a Default Channel (NEW)
    if (createDefaultChannelForm) {
        createDefaultChannelForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const name = document.getElementById("defaultChannelName").value.trim();

            console.log(`🔹 Sending request to create default channel: '${name}'`);

            if (!name) {
                alert("❌ Please enter a channel name.");
                return;
            }

            try {
                const response = await fetch(`${API_URL}/admin/default-channel`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + localStorage.getItem("token")
                    },
                    body: JSON.stringify({ name })
                });

                const data = await response.json();
                console.log("🔹 Server Response:", data);

                if (response.ok) {
                    alert(`✅ Default channel '${name}' created successfully!`);
                    document.getElementById("defaultChannelName").value = "";
                    document.getElementById("default-channel-result").innerText = data.message || "Default channel created successfully!";
                    loadDefaultChannels();

                    // Refresh the channel list in the sidebar
                    if (typeof window.fetchChannels === 'function') {
                        window.fetchChannels();
                    }
                } else {
                    alert(`❌ Error: ${data.error}`);
                    document.getElementById("default-channel-result").innerText = data.error || "Failed to create default channel";
                }
            } catch (error) {
                console.error("❌ Error sending default channel creation request:", error);
                alert("❌ Failed to create default channel! Check server logs.");
                document.getElementById("default-channel-result").innerText = "Failed to create default channel. Check server logs.";
            }
        });
    }

    // Load Teams
    async function loadTeams() {
        try {
            console.log("🔹 Fetching teams from server...");
            const response = await fetch("http://localhost:5000/admin/teams", {
                headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status} ${response.statusText}`);
            }

            const teams = await response.json();

            if (!Array.isArray(teams)) {
                console.error("❌ Server did not return an array:", teams);
                throw new Error("Invalid response format from server.");
            }

            console.log("✅ Teams received:", teams);

            const teamList = document.getElementById("adminTeamList");
            teamList.innerHTML = teams.map(team => `<li>${team.name}</li>`).join("");

            // Also populate the team dropdown for channel creation
            const channelTeam = document.getElementById("channelTeam");
            if (channelTeam) {
                channelTeam.innerHTML = "";
                teams.forEach(team => {
                    const option = document.createElement("option");
                    option.value = team.name;
                    option.textContent = team.name;
                    channelTeam.appendChild(option);
                });
            }
        } catch (error) {
            console.error("❌ Error loading teams:", error);
        }
    }

    // Load Channels
    async function loadChannels() {
        try {
            console.log("🔹 Fetching channels from server...");
            const response = await fetch(`${API_URL}/channels`, {
                headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status} ${response.statusText}`);
            }

            const channels = await response.json();

            if (!Array.isArray(channels)) {
                console.error("❌ Server did not return an array:", channels);
                throw new Error("Invalid response format from server.");
            }

            console.log("✅ Channels received:", channels);

            // Filter out default channels - they'll be displayed separately
            const teamChannels = channels.filter(channel => !channel.isDefault);

            const channelList = document.getElementById("adminChannelList");
            channelList.innerHTML = teamChannels.map(channel => {
                const teamName = channel.team ? channel.team.name : 'No team';
                return `<li>${channel.name} (Team: ${teamName})</li>`;
            }).join("");
        } catch (error) {
            console.error("❌ Error loading channels:", error);
        }
    }

    // Load Default Channels (NEW)
    async function loadDefaultChannels() {
        try {
            console.log("🔹 Fetching default channels...");
            const defaultChannelsList = document.getElementById("defaultChannelsList");

            if (!defaultChannelsList) {
                console.log("⚠️ Default channels list element not found in the DOM.");
                return;
            }

            defaultChannelsList.innerHTML = '<li class="loading">Loading default channels...</li>';

            const response = await fetch(`${API_URL}/channels`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch channels');
            }

            const channels = await response.json();

            // Filter for default channels
            const defaultChannels = channels.filter(channel => channel.isDefault);

            if (defaultChannels.length === 0) {
                defaultChannelsList.innerHTML = '<li class="no-channels">No default channels found</li>';
                return;
            }

            // Display each default channel
            defaultChannelsList.innerHTML = defaultChannels.map(channel => {
                return `
                <li>
                    <div class="channel-info">
                        <span class="channel-name">${channel.name}</span>
                        <span class="channel-creator">Created by: ${channel.createdBy ? 'Admin' : 'System'}</span>
                    </div>
                </li>
                `;
            }).join('');

            // Add event listeners to view buttons
            defaultChannelsList.querySelectorAll('.btn-view').forEach(button => {
                button.addEventListener('click', function () {
                    const channelId = this.getAttribute('data-channel-id');
                    const channelName = this.getAttribute('data-channel-name');
                    viewDefaultChannelMessages(channelId, channelName);
                });
            });

            console.log("✅ Default channels loaded:", defaultChannels.length);
        } catch (error) {
            console.error("❌ Error loading default channels:", error);
            if (document.getElementById("defaultChannelsList")) {
                document.getElementById("defaultChannelsList").innerHTML = '<li class="error">Error loading default channels</li>';
            }
        }
    }

    // Function to view default channel messages
    function viewDefaultChannelMessages(channelId, channelName) {
        // Store the channel info in localStorage for the chat page to use
        localStorage.setItem('selectedChannelId', channelId);
        localStorage.setItem('selectedChannelName', channelName);

        // Show chat area instead of redirecting (matching existing behavior)
        const chatArea = document.getElementById('chatArea');
        if (chatArea) {
            chatArea.style.display = 'flex';
            const chatTitle = document.getElementById('chatTitle');
            if (chatTitle) chatTitle.textContent = channelName;

            // Join the channel using socket.io if messaging.js is loaded
            if (typeof window.joinChannel === 'function') {
                window.joinChannel(channelId);
            }
        }
    }

    // Define a function for nav_bar.js to use when a channel is clicked
    window.handleAdminChannelClick = function (channelId, channelName) {
        // Store the channel info in localStorage for the chat page to use
        localStorage.setItem('selectedChannelId', channelId);
        localStorage.setItem('selectedChannelName', channelName);

        // Redirect to the chat page instead of showing the chat on admin page
        window.location.href = 'chat_page.html';
    };

    // Load data on page load
    loadTeams();
    loadChannels();
    loadDefaultChannels(); // Load default channels
});