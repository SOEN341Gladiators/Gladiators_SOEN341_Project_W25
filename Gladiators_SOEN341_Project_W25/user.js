document.addEventListener("DOMContentLoaded", function () {

    const API_URL = "http://localhost:5000";

    // Load Teams
    async function loadTeams() {
        try {
            console.log("🔹 Fetching teams from server...");
            const response = await fetch(`${API_URL}/user/teams`, {
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

            const teamList = document.getElementById("userTeams");
            if (teamList) {
                teamList.innerHTML = teams.map(team => `<li>${team.name}</li>`).join("");
            } else {
                console.error("❌ Element #userTeams not found in the DOM!");
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

            const channelList = document.getElementById("userChannels");
            channelList.innerHTML = channels.map(channel => `<li>${channel.name} (Team: ${channel.team.name})</li>`).join("");
        } catch (error) {
            console.error("❌ Error loading channels:", error);
        }
    }

    loadTeams();
    loadChannels();
})