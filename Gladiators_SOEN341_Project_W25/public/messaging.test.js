// Import the required elements for testing
//const { displaySystemMessage, sendMessage, closeChat } = require('./messaging.js');
/**
 * @jest-environment jsdom
 */
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
    fetchUsers: jest.fn(),
  }));

beforeEach(() => {
  // Mocking localStorage to simulate getting and setting items
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
});
//allow for seperate testing 
afterEach(() => {
  jest.clearAllMocks();   
});

describe('Messaging', () => {

    const socket = require('socket.io-client')();
    socket.emit = jest.fn(); // Mock socket emit


    test('displays system message correctly', () => {
        displaySystemMessage('Test System Message');
        const chatMessages = document.getElementById('chatMessages');
        expect(chatMessages.innerHTML).toContain('Test System Message');
    });

    test('sendMessage sends a message when input is valid', () => {
        const messageInput = document.getElementById('chatInput');
        messageInput.value = 'Hello, World!';
        const socket = require('socket.io-client')();
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

    test('fetchUsers handles successful and error responses', async () => {
        global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ users: ['user1', 'user2'] }),
        });
        const users = await require('./messaging').fetchUsers('user');
        expect(users).toEqual(['user1', 'user2']);
        global.fetch.mockRejectedValueOnce(new Error('Failed to fetch users'));
        const errorUsers = await require('./messaging').fetchUsers('user');
        expect(errorUsers).toEqual([]);
    });
});
