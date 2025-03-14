const API_URL = "http://localhost:5000";

// Main menu functionality
document.addEventListener("DOMContentLoaded", function () {
    // Handle main menu buttons
    const loginBtn = document.getElementById("loginBtn");

    if (loginBtn) {
        loginBtn.addEventListener("click", () => window.location.href = "/login");
    }

    // Handle registration form
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        console.log("✅ Register form found!");
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const username = document.getElementById("registerUsername").value;
            const password = document.getElementById("registerPassword").value;
            const role = document.getElementById("registerRole").value;

            const response = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, role })
            });

            // ✅ First, parse the response JSON
            const data = await response.json();

            if (response.ok) {
                alert("✅ User registered successfully!");
                // Redirect to home page after successful registration
                window.location.href = "index.html";
            } else {
                // ❌ Display an alert if the user already exists
                alert(`❌ Registration failed: ${data.error || "Unknown error"}`);
            }

            document.getElementById("register-result").innerText = data.message || data.error;
        });
    }

    // Handle login form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        console.log("✅ Login form found!");
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const username = document.getElementById("loginUsername").value;
            const password = document.getElementById("loginPassword").value;

            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            console.log("Login response:", data);

            if (data.token) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("userRole", data.role);
                localStorage.setItem("username", username);

                // Store the userId in localStorage
                if (data.userId) {
                    localStorage.setItem("userId", data.userId);
                    console.log("User ID stored in localStorage:", data.userId);
                } else {
                    console.warn("Warning: userId not received from server");
                }

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
    }
});