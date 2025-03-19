// Import the required elements for testing
//const { displaySystemMessage, sendMessage, closeChat } = require('./messaging.js');
/**
 * @jest-environment jsdom
 */
const { sendMessage, displaySystemMessage, closeChat, joinChannel } = require('./messaging');  // Import mocks

beforeEach(() => {
// Mock the socket.io client
jest.mock('socket.io-client', () => {
  return jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    id: 'testSocketId',
  }));
});

//const socketMock = require('socket.io-client')();  // This creates the mocked socket

jest.mock('./messaging', () => ({
    sendMessage: jest.fn(),
    displaySystemMessage: jest.fn(),
    closeChat: jest.fn(),
    joinChannel: jest.fn(),
  }));

  window.sendMessage = sendMessage;
  window.displaySystemMessage = displaySystemMessage;
  window.closeChat = closeChat;
  window.joinChannel = joinChannel;

  // Mocking localStorage to simulate getting and setting items in browser
  global.localStorage = {
    getItem: jest.fn((key) => {
      if (key === 'username') return 'testUser';
      if (key === 'userRole') return 'admin';
      return null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };

  // Mocking document.getElementById and querySelector
  document.body.innerHTML = `
    <div id="chatForm"></div>
    <input id="chatInput" />
    <div id="chatMessages"></div>
    <div id="chatArea"></div>
    <div id="welcomeText"></div>
    <div id="startConversationText"></div>
  `;

  const socket = require('socket.io-client')();
  socket.emit = jest.fn(); // Mock socket emit

});
//allow for seperate testing - reset
afterEach(() => {
  jest.clearAllMocks();   
});

describe('Messaging Tests', () => {

    test('displays system message correctly', () => {
        displaySystemMessage('Test System Message');
        const chatMessages = document.getElementById('chatMessages');
        expect(chatMessages.innerHTML).toContain('Test System Message');
    });

    test('sendMessage sends a message when input is valid', () => {
        document.body.innerHTML = `<input id="chatInput" value="Hello, World!">`;
        localStorage.setItem('username', 'testUser'); // Mock username
        //currentChannel = "null";  // Ensure a valid channel is set
        const socket = require('socket.io-client')();
        socket.emit = jest.fn(); // Mock socket emit
/*
        const messageInput = document.getElementById('chatInput');
        messageInput.value = 'Hello, World!';
        const socket = require('socket.io-client')();
*/
        sendMessage();
        expect(socket.emit).toHaveBeenCalledWith('message', {
        channelId: null,
        username: 'testUser',
        message: 'Hello, World!',
        });
    });

    test('sendMessage does not send a message if input is empty', () => {
        const messageInput = document.getElementById('chatInput');
        messageInput.value = '';
        const socket = require('socket.io-client')();
        sendMessage();
        expect(socket.emit).not.toHaveBeenCalled();
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
        const socket = require('socket.io-client')();
        const channelId = 'testChannel';
        require('./messaging').joinChannel(channelId);
        expect(socket.emit).toHaveBeenCalledWith('join channel', channelId);
        expect(document.getElementById('chatMessages').innerHTML).toContain('Joined channel testChannel');
    });
});
