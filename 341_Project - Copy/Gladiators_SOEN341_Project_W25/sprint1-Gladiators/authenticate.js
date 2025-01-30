//Run this script when the page loads
document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("token"); //Get authentication token
    const userRole = localStorage.getItem("userRole"); //Get stored user role

    if (!token) {
        //Redirect to login page if not authenticated
        alert("You must log in first.");
        window.location.href = "index.html";
    }

    //Restrict access to the admin page if the user is not an admin
    if (window.location.pathname.includes("admin.html") && userRole !== "admin") {
        alert("Access denied. Admins only.");
        window.location.href = "member.html";
    }
});

//Logout function to clear stored user data and redirect to login page
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    window.location.href = "index.html";
}
