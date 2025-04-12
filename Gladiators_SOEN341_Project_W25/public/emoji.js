// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const emojiButton = document.getElementById('emojiButton');
    const chatInput = document.getElementById('chatInput');
    const emojiPickerContainer = document.getElementById('emojiPicker');

    // Initialize emoji picker
    function initEmojiPicker() {
        // Create the emoji picker using emoji-mart
        const picker = new EmojiMart.Picker({
            onEmojiSelect: (emoji) => {
                // Insert the emoji at the current cursor position
                insertEmojiAtCursor(emoji.native);
                // Hide the picker after selection
                toggleEmojiPicker(false);
            },
            theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light',
            set: 'native',
            autoFocus: true,
            categories: ['frequent', 'people', 'nature', 'foods', 'activity', 'places', 'objects', 'symbols', 'flags'],
            emojiSize: 20,
            emojiButtonSize: 28,
            perLine: 8
        });

        // Clear and append the picker
        emojiPickerContainer.innerHTML = '';
        emojiPickerContainer.appendChild(picker);
    }

    // Toggle the emoji picker
    function toggleEmojiPicker(show) {
        if (show === undefined) {
            emojiPickerContainer.classList.toggle('visible');
        } else {
            emojiPickerContainer.classList.toggle('visible', show);
        }

        // Initialize picker on first open
        if (emojiPickerContainer.classList.contains('visible') && emojiPickerContainer.children.length === 0) {
            initEmojiPicker();
        }
    }

    // Insert emoji at cursor position in the chat input
    function insertEmojiAtCursor(emoji) {
        const startPos = chatInput.selectionStart;
        const endPos = chatInput.selectionEnd;
        const text = chatInput.value;
        const newText = text.substring(0, startPos) + emoji + text.substring(endPos);

        chatInput.value = newText;

        // Move cursor after the inserted emoji
        const newCursorPos = startPos + emoji.length;
        chatInput.setSelectionRange(newCursorPos, newCursorPos);

        // Focus back on input
        chatInput.focus();
    }

    // Event listeners
    if (emojiButton) {
        emojiButton.addEventListener('click', function (e) {
            e.preventDefault();
            toggleEmojiPicker();
        });
    }

    // Close emoji picker when clicking outside
    document.addEventListener('click', function (e) {
        if (emojiPickerContainer.classList.contains('visible') &&
            !emojiPickerContainer.contains(e.target) &&
            e.target !== emojiButton) {
            toggleEmojiPicker(false);
        }
    });

    // Update theme when theme toggle is clicked
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            // If picker is visible, reinitialize it with the new theme
            if (emojiPickerContainer.classList.contains('visible')) {
                // Small delay to allow body class to update
                setTimeout(initEmojiPicker, 100);
            }
        });
    }
});