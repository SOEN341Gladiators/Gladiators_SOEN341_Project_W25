const API_URL = "http://localhost:5000";

// Register User
document.getElementById("registerForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = document.getElementById("registerUsername").value;
    const password = document.getElementById("registerPassword").value;
    const role = document.getElementById("registerRole").value;

    const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role })
    });

    const data = await response.json();
    document.getElementById("register-result").innerText = data.message || data.error;
});

// Login User
document.getElementById("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userRole", data.role);

        // Redirect based on role
        if (data.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "member.html";
        }
    } else {
        document.getElementById("login-result").innerText = data.error;
    }
});
