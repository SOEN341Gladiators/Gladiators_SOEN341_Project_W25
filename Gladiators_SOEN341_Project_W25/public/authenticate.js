//Run this script when the page loads
document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token"); //Get authentication token
    const userRole = localStorage.getItem("userRole"); //Get stored user role

    if (!token) {
        //Redirect to login page if not authenticated
        alert("You must log in first.");
        window.location.href = "index.html";
        return;
    }

    //Restrict access to the admin page if the user is not an admin
    if (window.location.pathname.includes("admin.html") && userRole !== "admin") {
        alert("Access denied. Admins only.");
        window.location.href = "member.html";
        return;
    }
});

//Logout function to clear stored user data and redirect to login page
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    window.location.href = "index.html";
}

// Handle login response (called from login script)
function handleLogin({ token, username, role, userId }) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    localStorage.setItem("userRole", role);
    localStorage.setItem("userId", userId);
    if (role === "admin") {
        window.location.href = "admin.html";
    } else {
        window.location.href = "member.html";
    }
}