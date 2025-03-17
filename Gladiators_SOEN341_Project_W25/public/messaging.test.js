test('sendMessage sends message when valid input is provided', () => {
    const socketEmitMock = jest.fn();
    socket.emit = socketEmitMock;
    
    const messageInput = document.createElement('input');
    messageInput.value = 'Test Message';
    const event = new Event('submit');
    
    sendMessage(event);
    expect(socketEmitMock).toHaveBeenCalledWith('message', {
        channelId: currentChannel,
        username: username,
        message: 'Test Message'
    });
});

test('joinChannel sends join channel event and updates UI', () => {
    const socketEmitMock = jest.fn();
    socket.emit = socketEmitMock;
    
    const channelId = 'testChannel';
    joinChannel(channelId);
    expect(socketEmitMock).toHaveBeenCalledWith('join channel', channelId);
    expect(document.getElementById('chatArea').style.display).toBe('flex');
});
