/**
 * @jest-environment jsdom
 */

// Import the module after mocking dependencies
const messagingModule = require('./messaging');

describe('Messaging Tests', () => {
  
  beforeEach(() => {
    // Set up DOM elements needed for tests
    document.body.innerHTML = `
      <div id="chatForm"></div>
      <input id="chatInput" />
      <div id="chatMessages"></div>
      <div id="chatArea"></div>
      <div id="welcomeText"></div>
      <div id="startConversationText"></div>
      <button id="viewRemindersBtn"></button>
      <div id="replyIndicator" style="display: none;"></div>
    `;
    
    // Mock localStorage
    global.localStorage = {
      getItem: jest.fn((key) => {
        if (key === 'username') return 'testUser';
        if (key === 'userRole') return 'admin';
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    messagingModule.setCurrentChannel('testChannel');
    username = localStorage.setItem('username', 'testUser');

  });
  
  afterEach(() => {
    messagingModule.setCurrentChannel("wrongChannel");
  });

  test('displaySystemMessage adds a system message to the chat', () => {
    // Call the function
    messagingModule.displaySystemMessage('Test System Message');
    
    // Check that message was added to DOM
    const chatMessages = document.getElementById('chatMessages');
    expect(chatMessages.innerHTML).toContain('Test System Message');
    expect(chatMessages.lastChild.className).toContain('system-message');
  });

  test('sendMessage sends a message when input is valid', () => {
    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Set up message input
    const chatInput = document.getElementById('chatInput');
    chatInput.value = 'Hello, World!';
    messagingModule.setCurrentChannel('testChannel');
    // Call the function
    messagingModule.sendMessage();

    // Check if the correct message data was logged
    expect(consoleSpy).toHaveBeenCalledWith("Sending message:", {
        channelId: messagingModule.getCurrentChannel(),
        username: 'testUser',
        message: 'Hello, World!'
    });

    // Check input was cleared
    expect(chatInput.value).toBe('');

    // Restore console.log after the test
    consoleSpy.mockRestore();
  });

  test('sendMessage does not send a message if input is empty', () => {
    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Set up empty input
    const chatInput = document.getElementById('chatInput');
    chatInput.value = ''; //empty sting therefore will fail to call the function
    messagingModule.setCurrentChannel('testChannel');
    // Call the function
    messagingModule.sendMessage();

    // Check if warning message was logged
    expect(consoleSpy).not.toHaveBeenCalled();

    // Restore console.log after the test
    consoleSpy.mockRestore();
  });

  test('closeChat hides chat elements and clears messages', () => {
    closeChat();
        const chatArea = document.getElementById('chatArea');
        const welcomeText = document.getElementById('welcomeText');
        const startConversationText = document.getElementById('startConversationText');
        const chatMessages = document.getElementById('chatMessages');

        expect(chatArea.style.display).toBe('none');
        expect(welcomeText.style.display).toBe('block');
        expect(startConversationText.style.display).toBe('block');
        expect(chatMessages.innerHTML).toBe('');
  });

  test('joinChannel emits a join event and displays system message', () => {
    // Spy on console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Set up test data
    const channelId = 'testChannel';
    messagingModule.setCurrentChannel('wrongChannel');
    // Call the function
    messagingModule.joinChannel(channelId);

    // Check that the current channel was updated
    expect(messagingModule.getCurrentChannel()).toBe(channelId);
    expect(consoleSpy).toHaveBeenCalledWith('Joining channel:', channelId);
    // Restore console.log after the test
    consoleSpy.mockRestore();
  });
  
  test('joinChannel does nothing if channel is already joined', () => {
    // Set up a spy on console.log to check if a message is logged when trying to join the same channel
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Set the current channel to already joined
    messagingModule.setCurrentChannel('alreadyJoined');
    
    // Call the function with the same channel
    messagingModule.joinChannel('alreadyJoined');
    // Check that a message was logged indicating the channel is already joined
    expect(consoleSpy).toHaveBeenCalledWith('Already in channel:', 'alreadyJoined');
    
    // Restore the console log spy
    consoleSpy.mockRestore();
  });
  
  test('joinChannel does nothing if channelId is invalid', () => {
    // Set up a spy on console.log to check if an error message is logged
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Call the function with an invalid channel
    messagingModule.joinChannel(null);
  
    // Check that the invalid channel log was made
    expect(consoleSpy).not.toHaveBeenCalled();
    
    // Restore the console log spy
    consoleSpy.mockRestore();
  });


  //not implimented yet
  test('Edit Messages properly updates the message', () => {
    // Set up a spy on console.log to check if an error message is logged
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    //--------------------------------------  
    consoleSpy.mockRestore();
  });

});