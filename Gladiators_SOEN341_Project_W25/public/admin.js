document.addEventListener("DOMContentLoaded", function () {
    console.log("🔹 Document fully loaded. Initializing event listeners...");

    const createChannelForm = document.getElementById("createChannelForm");
    const createTeamForm = document.getElementById("createTeamForm");

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
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error("❌ Error sending channel creation request:", error);
            alert("❌ Failed to create channel! Check server logs.");
        }
    });

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
        } catch (error) {
            console.error("❌ Error loading teams:", error);
        }
    }


    // Load Channels
    async function loadChannels() {
        try {
            const response = await fetch(`${API_URL}/channels`, {
                headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
            });

            const channels = await response.json();
            const channelList = document.getElementById("adminChannelList");
            channelList.innerHTML = channels.map(channel => `<li>${channel.name} (Team: ${channel.team})</li>`).join("");
        } catch (error) {
            console.error("❌ Error loading channels:", error);
        }
    }

    // Load data on page load
    loadTeams();
    loadChannels();
});
