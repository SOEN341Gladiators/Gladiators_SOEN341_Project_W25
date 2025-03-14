// private_channel_handler.js - Simplified handling of private channel functionality
document.addEventListener('DOMContentLoaded', function () {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');

    if (!token || !username) {
        return; // Skip initialization if not logged in
    }

    // Request to join a private channel
    window.requestJoinChannel = async function (channelId) {
        try {
            const response = await fetch(`http://localhost:5000/channel/request-join/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
                // Refresh channels to show pending request status
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(data.error || 'Failed to request channel access');
            }
        } catch (error) {
            console.error('Error requesting to join channel:', error);
            alert('Failed to send join request. Please try again.');
        }
    };

    // Function to handle accepting a join request (for channel creators)
    window.acceptJoinRequest = async function (channelId, userId) {
        try {
            const response = await fetch(`http://localhost:5000/channel/accept-request/${channelId}/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'User added to channel successfully');
                // Refresh channels
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(data.error || 'Failed to accept join request');
            }
        } catch (error) {
            console.error('Error accepting join request:', error);
            alert('Failed to accept join request. Please try again.');
        }
    };

    // Function to handle rejecting a join request (for channel creators)
    window.rejectJoinRequest = async function (channelId, userId) {
        try {
            const response = await fetch(`http://localhost:5000/channel/reject-request/${channelId}/${userId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'Join request rejected successfully');
                // Refresh channels
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(data.error || 'Failed to reject join request');
            }
        } catch (error) {
            console.error('Error rejecting join request:', error);
            alert('Failed to reject join request. Please try again.');
        }
    };

    // Function to leave a channel
    window.leaveChannel = async function (channelId) {
        if (!confirm('Are you sure you want to leave this channel?')) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/channel/leave/${channelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'You have left the channel successfully');
                // Refresh channel list
                if (typeof window.fetchChannels === 'function') {
                    window.fetchChannels();
                }
            } else {
                alert(data.error || 'Failed to leave channel');
            }
        } catch (error) {
            console.error('Error leaving channel:', error);
            alert('Failed to leave channel. Please try again.');
        }
    };
});