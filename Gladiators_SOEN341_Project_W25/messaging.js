//wasnt sure if i should have created a new js file for this - malik
document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("message-input");
    input.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent default form submission
            sendMessage();
        }
    });
});

function sendMessage() {
    const input = document.getElementById("message-input");
    const chatBox = document.getElementById("chat-box");
    if (input.value.trim() === "") return;

    const message = document.createElement("div");
    message.classList.add("message");
    message.textContent = input.value;
    chatBox.appendChild(message);

    chatBox.scrollTop = chatBox.scrollHeight;
    input.value = "";
}

function closeChat() {
    window.location.href = "member.html";
}