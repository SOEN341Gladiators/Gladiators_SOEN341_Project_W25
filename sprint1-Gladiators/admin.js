//Check if the user is logged in as admin
document.addEventListener("DOMContentLoaded", function () {
    const userRole = localStorage.getItem("userRole");
    if (userRole !== "admin") {
        alert("Access denied. Admins only.");
        window.location.href = "index.html"; //Redirect to login if not admin
    }
});

//Handle team creation
document.getElementById("createTeamForm").addEventListener("submit", function (event) {
    event.preventDefault(); //Prevent form submission from refreshing the page

    const teamName = document.getElementById("teamName").value;

    if (!teamName) {
        alert("Please enter a team name.");
        return;
    }

    //Simulate creating a team (in reality, this would involve sending a request to the server)
    const teamList = document.getElementById("teamList");
    const teamItem = document.createElement("li");
    teamItem.textContent = `Team: ${teamName}`;
    teamList.appendChild(teamItem); //Add the new team to the list

    //Clear the input field after submission
    document.getElementById("teamName").value = "";
});

//Handle assigning a user to a channel
document.getElementById("assignUserForm").addEventListener("submit", function (event) {
    event.preventDefault(); //Prevent form submission from refreshing the page

    const username = document.getElementById("username").value;
    const selectedChannel = document.getElementById("selectChannel").value;

    if (!username) {
        alert("Please enter a username.");
        return;
    }

    //Simulate assigning the user to a channel
    alert(`${username} has been assigned to the ${selectedChannel} channel.`);

    // lear the input field after submission
    document.getElementById("username").value = "";
});

//Logout functionality (clearing the stored user data)
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    window.location.href = "index.html"; //Redirect to login page after logout
}
