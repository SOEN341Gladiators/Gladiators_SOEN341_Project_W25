// public/authenticate.js
document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");
    const username = localStorage.getItem("username");
    const userId = localStorage.getItem("userId");

    if (!token) {
        alert("You must log in first.");
        window.location.href = "index.html";
        return;
    }

    // Restrict access to admin page if not an admin
    if (window.location.pathname.includes("admin.html") && userRole !== "admin") {
        alert("Access denied. Admins only.");
        window.location.href = "member.html";
        return;
    }

    console.log('Authenticated user:', { username, userRole, userId, token });
});

// Logout function
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