//Add an event listener to the login form submission
document.getElementById("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault(); //Prevent form from refreshing the page

    //Get username and password values from input fields
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message"); //Error message container

    try {
        //Send a POST request to the backend API for authentication (JUST USED THIS FOR NOW)
        const response = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }), //Send username and password as JSON
        });

        const data = await response.json(); //Parse the response

        if (!response.ok) {
            //Display error message if login fails
            errorMessage.textContent = data.msg;
            errorMessage.style.display = "block";
            return;
        }

        //Store the authentication token and user role in local storage
        localStorage.setItem("token", data.token);
        localStorage.setItem("userRole", data.user.role);

        //Redirect based on the user's role
        if (data.user.role === "admin") {
            window.location.href = "admin.html"; //Admin dashboard
        } else {
            window.location.href = "member.html"; //Member dashboard
        }
    } catch (error) {
        console.error("Error:", error); //Log error to console
        errorMessage.textContent = "Something went wrong. Try again.";
        errorMessage.style.display = "block";
    }
});
