// server.js with homepage as the first page to load
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

// Socket.IO integration 
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configure middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
    .connect("mongodb+srv://pnasr:150Hockey%3F@gladiators-db.g80yx.mongodb.net/?retryWrites=true&w=majority&appName=gladiators-db", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("Connected to MongoDB!"))
    .catch((err) => console.log("MongoDB connection error:", err));

// MongoDB Schemas and Models

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Each user must have a unique username
    password: { type: String, required: true }, // Store the hashed password
    role: { type: String, default: "user" }, // "admin" or "user"
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null }, // The team assigned to the user
    status: { type: String, enum: ["online", "offline", "away"], default: "offline" }, // New field
    lastSeen: { type: Date, default: Date.now } // New field
});

const User = mongoose.model("User", userSchema);

// Team Schema
const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Team name (must be unique)
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Array of user IDs
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Store admin who created the team
    createdAt: { type: Date, default: Date.now } // Timestamp
});

const Team = mongoose.model("Team", teamSchema);

// Channel Schema
const channelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        required: function () {
            return this.type === "channel" && !this.isDefault && !this.isPrivate;
        }
    },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    type: { type: String, enum: ["channel", "dm"], default: "channel" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDefault: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingInvites: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }] // New field for invites
});
const Channel = mongoose.model("Channel", channelSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    username: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    editHistory: [{
        previousMessage: { type: String },
        editedAt: { type: Date, default: Date.now }
    }]
});

const Message = mongoose.model('Message', messageSchema);

// Reminder Schema
const reminderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    reminderTime: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sent', 'canceled'], default: 'pending' }
});

const Reminder = mongoose.model('Reminder', reminderSchema);

// Store connected users and their roles
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('user info', async (data) => {
        if (data && data.username && data.role) {
            try {
                const user = await User.findOneAndUpdate(
                    { username: data.username },
                    { status: 'online', lastSeen: new Date() },
                    { new: true }
                );
                if (!user) {
                    console.log(`User ${data.username} not found in DB`);
                    socket.emit('error', 'User not found');
                    return;
                }

                connectedUsers.set(socket.id, {
                    username: data.username,
                    role: data.role,
                    userId: user._id
                });
                console.log(`User ${data.username} with role ${data.role} registered`);

                io.emit('userStatusUpdate', {
                    _id: user._id,
                    username: user.username,
                    status: user.status,
                    lastSeen: user.lastSeen
                });

                const users = await User.find().select('username status lastSeen').lean();
                console.log('Emitting userList on user info:', users.length, 'users');
                io.emit('userList', users);
                console.log('Successfully emitted userList on user info:', users.length, 'users');
                socket.join(user._id.toString());
            } catch (error) {
                console.error('Error in user info:', error);
                socket.emit('error', 'Failed to update user status');
            }
        } else {
            console.log('Invalid user info data:', data);
        }
    });

    socket.on('getUsers', async () => {
        try {
            const users = await User.find().select('username status lastSeen').lean();
            console.log('Emitting userList on getUsers:', users.length, 'users', users);
            io.emit('userList', users);
        } catch (error) {
            console.error('Error fetching users:', error);
            socket.emit('error', 'Failed to fetch user list');
        }
    });

    // Handle joining a channel
    socket.on('join channel', async (channelId) => {
        try {
            // Leave previous channel if any
            if (socket.currentChannel) {
                socket.leave(socket.currentChannel);
            }

            // Join new channel
            socket.join(channelId);
            socket.currentChannel = channelId;

            // Fetch last 50 messages for this channel
            const messages = await Message.find({ channelId })
                .sort({ timestamp: -1 })
                .limit(50)
                .lean();

            // Send message history to the user
            socket.emit('message history', messages.reverse());
        } catch (error) {
            console.error('Error joining channel:', error);
            socket.emit('error', 'Failed to join channel');
        }
    });

    // Handle new messages
    socket.on('message', async (data) => {
        try {
            const { channelId, username, message } = data;

            // Log incoming message data
            console.log('Received message:', data);

            // Save message to database
            const newMessage = new Message({
                channelId,
                username,
                message,
                timestamp: new Date(),
                isDeleted: false // Initialize as not deleted
            });
            await newMessage.save();

            // Broadcast message to all users in the channel
            io.to(channelId).emit('message', {
                _id: newMessage._id,
                username,
                message,
                timestamp: newMessage.timestamp,
                isDeleted: false
            });

            // Log successful broadcast
            console.log('Message broadcast to channel:', channelId);
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', 'Failed to send message');
        }
    });

    // Handle message deletion (admin only)
    socket.on('delete message', async (messageId) => {
        try {
            // Check if user is admin
            const userInfo = connectedUsers.get(socket.id);
            if (!userInfo || userInfo.role !== 'admin') {
                socket.emit('error', 'Permission denied: Only admins can delete messages');
                return;
            }

            // Update the message in the database
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { isDeleted: true },
                { new: true }
            );

            if (!updatedMessage) {
                socket.emit('error', 'Message not found');
                return;
            }

            // Broadcast the deletion to all users in the channel
            io.to(updatedMessage.channelId.toString()).emit('message deleted', {
                messageId: updatedMessage._id,
                channelId: updatedMessage.channelId
            });

            console.log('Message deletion broadcast:', messageId);
        } catch (error) {
            console.error('Error deleting message:', error);
            socket.emit('error', 'Failed to delete message');
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        const userInfo = connectedUsers.get(socket.id);
        if (userInfo) {
            try {
                const user = await User.findOneAndUpdate(
                    { username: userInfo.username },
                    { status: 'offline', lastSeen: new Date() },
                    { new: true }
                );
                if (user) {
                    io.emit('userStatusUpdate', {
                        _id: user._id,
                        username: user.username,
                        status: user.status,
                        lastSeen: user.lastSeen
                    });
                }
            } catch (error) {
                console.error('Error updating user status on disconnect:', error);
            }
        }

        connectedUsers.delete(socket.id);
        if (socket.currentChannel) {
            socket.leave(socket.currentChannel);
        }
        console.log('User disconnected:', socket.id);

        const users = await User.find().select('username status lastSeen').lean();
        console.log('Emitting userList on disconnect:', users.length, 'users');
        io.emit('userList', users);
    });


    let awayTimeout = setTimeout(async () => {
        const userInfo = connectedUsers.get(socket.id);
        if (userInfo) {
            try {
                const user = await User.findOne({ username: userInfo.username });
                if (user && user.status === 'online') {
                    user.status = 'away';
                    user.lastSeen = new Date();
                    await user.save();
                    io.emit('userStatusUpdate', {
                        _id: user._id,
                        username: user.username,
                        status: user.status,
                        lastSeen: user.lastSeen
                    });
                    const users = await User.find().select('username status lastSeen').lean();
                    console.log('Emitting userList on away:', users.length, 'users');
                    io.emit('userList', users);
                }
            } catch (error) {
                console.error('Error setting user to away:', error);
            }
        }
    }, 5 * 60 * 1000);

    // Handle message editing
    socket.on('edit message', async (data) => {
        try {
            const { messageId, newMessage } = data;
            if (!messageId || !newMessage) {
                socket.emit('error', 'Message ID and new message content are required');
                return;
            }

            // Check if the user is the message author
            const message = await Message.findById(messageId);
            if (!message) {
                socket.emit('error', 'Message not found');
                return;
            }

            const userInfo = connectedUsers.get(socket.id);
            if (!userInfo) {
                socket.emit('error', 'User info not found');
                return;
            }

            // Only allow message authors to edit their messages
            if (message.username !== userInfo.username) {
                socket.emit('error', 'You can only edit your own messages');
                return;
            }

            // Store the previous message in history
            const historyEntry = {
                previousMessage: message.message,
                editedAt: new Date()
            };

            // Update the message in the database
            const updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                {
                    message: newMessage,
                    isEdited: true,
                    $push: { editHistory: historyEntry }
                },
                { new: true }
            );

            // Broadcast the edit to all users in the channel
            io.to(message.channelId.toString()).emit('message edited', {
                messageId: updatedMessage._id,
                newMessage: updatedMessage.message,
                isEdited: true,
                editHistory: updatedMessage.editHistory
            });

            console.log('Message edited successfully:', messageId);
        } catch (error) {
            console.error('Error editing message:', error);
            socket.emit('error', 'Failed to edit message');
        }
    });

    socket.on('disconnect', () => {
        clearTimeout(awayTimeout);
    });

});

// Helper Functions

// Generate a simple JWT token for user authentication
function generateToken(user) {
    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            role: user.role,
            team: user.team,
        },
        "secret_key", // Replace this with an actual secret in production
        { expiresIn: "1h" }
    );
}

// Middleware to Verify the User's Token
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Access denied! Please log in." });

    try {
        const user = jwt.verify(token, "secret_key");
        req.user = user; // Attach the user's info to the request
        next();
    } catch {
        res.status(401).json({ error: "Invalid token! Please log in again." });
    }
}

// Middleware to Check if User is Admin
function isAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied! Admins only." });
    }
    next();
}

//******************************GET Methods************************************//

// 1. Home Page (serves homepage.html)
app.get("/", (req, res) => {
    console.log("Root route accessed, serving homepage.html");
    const homepagePath = path.join(__dirname, "public", "homepage.html");

    if (fs.existsSync(homepagePath)) {
        console.log(`✅ homepage.html found at ${homepagePath}`);
        res.sendFile(homepagePath);
    } else {
        console.error(`❌ ERROR: homepage.html NOT found at ${homepagePath}`);
        res.status(404).send("Homepage not found - please make sure homepage.html exists in the public folder");
    }
});

// 2. Registration Page (serves index.html)
app.get("/register", (req, res) => {
    console.log("Register route accessed, serving index.html");
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 3. Login Page (serves login.html)
app.get("/login", (req, res) => {
    console.log("Login route accessed, serving login.html");
    const loginPath = path.join(__dirname, "public", "login.html");

    if (fs.existsSync(loginPath)) {
        res.sendFile(loginPath);
    } else {
        console.error(`Login page not found at ${loginPath}`);
        // Fallback to index.html if login.html doesn't exist
        res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// Redirect direct access to index.html to /register route
app.get("/index.html", (req, res) => {
    console.log("Redirecting from direct index.html access to register route");
    res.redirect("/register");
});

// Setup static middleware AFTER routes with index:false
app.use(express.static("public", { index: false }));

// Get all users
app.get('/users', authenticate, async (req, res) => {
    try {
        // Fetch all users except the current user
        const users = await User.find({ _id: { $ne: req.user.id } }, 'username').lean();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

// Get the teams for an admin
app.get("/admin/teams", authenticate, isAdmin, async (req, res) => {
    try {
        console.log("🔹 Fetching teams from database...");

        // For admins, get teams they've created or are part of
        const teams = await Team.find({
            $or: [
                { createdBy: req.user.id },
                { users: req.user.id }
            ]
        }, "name").lean();

        if (!teams || teams.length === 0) {
            console.log("⚠️ No teams found for admin!");
            return res.json([]); // Return empty array instead of error
        }

        console.log("✅ Teams retrieved:", teams);
        res.json(teams);
    } catch (error) {
        console.error("❌ Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams!" });
    }
});

// Get admin-created channels
app.get("/admin/channels", authenticate, isAdmin, async (req, res) => {
    try {
        // Get channels created by this admin
        const channels = await Channel.find({
            createdBy: req.user.id,
            type: "channel"
        })
            .populate("team", "name")
            .lean();

        res.json(channels);
    } catch (error) {
        console.error("Error fetching admin channels:", error);
        res.status(500).json({ error: "Failed to fetch channels" });
    }
});

// Get teams for the logged-in user
app.get("/user/teams", authenticate, async (req, res) => {
    try {
        // Find the user and populate the teams they belong to
        const user = await User.findById(req.user.id).populate("team", "name").lean();

        if (!user || !user.team) {
            return res.status(404).json({ error: "No teams found for this user." });
        }

        res.json([user.team]); // Return the team(s) the user belongs to
    } catch (error) {
        console.error("❌ Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams!" });
    }
});

// Get Channels for a User (including default channels)
app.get("/channels", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();

        if (!user) {
            return res.status(404).json({ error: "User not found!" });
        }

        let channels = [];

        // If user is admin, get the channels they created
        if (user.role === "admin") {
            const adminChannels = await Channel.find({
                createdBy: user._id,
                type: "channel",
                isDefault: { $ne: true } // Exclude default channels as they'll be added separately
            }).populate("team", "name").lean();

            channels = adminChannels;
        }
        // For regular users, get channels for their team
        else if (user.team) {
            const teamChannels = await Channel.find({
                team: user.team,
                type: "channel",
                isDefault: { $ne: true } // Exclude default channels as they'll be added separately
            }).populate("team", "name").lean();

            channels = teamChannels;
        }

        // For all users, get default channels
        const defaultChannels = await Channel.find({
            isDefault: true,
            type: "channel"
        }).lean();

        // For all users, get their DM channels
        const dmChannels = await Channel.find({
            users: user._id,
            type: "dm"
        }).lean();

        // Combine all types of channels
        const allChannels = [...channels, ...defaultChannels, ...dmChannels];

        // Add team name property to default channels for consistency
        const formattedChannels = allChannels.map(channel => {
            if (channel.isDefault) {
                return {
                    ...channel,
                    team: { name: "Default" }
                };
            }
            return channel;
        });

        res.json(formattedChannels);
    } catch (err) {
        console.error("Error fetching channels:", err);
        res.status(500).json({ error: "Failed to fetch channels!" });
    }
});

// Get User Details by Username
app.get("/user/:username", async (req, res) => {
    const { username } = req.params;

    try {
        const user = await User.findOne({ username }).select("-password"); // Exclude password for security
        if (!user) {
            return res.status(404).json({ error: "User not found!" });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Failed to retrieve user data!" });
    }
});

// User: Get Their Channels
app.get("/user/channels", authenticate, async (req, res) => {
    try {
        const channels = await Channel.find({ users: req.user.id }).populate("team", "name");
        res.json(channels);
    } catch (err) {
        res.status(400).json({ error: "Failed to fetch channels!" });
    }
});

// Get the dm channel of 2 users
app.get("/dm-channel", authenticate, async (req, res) => {
    const recipient = req.query.recipient;
    const currentUser = req.user.username;

    if (!recipient) {
        return res.status(400).json({ error: "Recipient is required" });
    }

    try {
        // Generate a consistent DM channel name by alphabetically sorting the two usernames
        const dmName = [currentUser, recipient].sort().join('_');

        // Look for an existing DM channel with this name and type "dm"
        let dmChannel = await Channel.findOne({ name: dmName, type: "dm" });

        if (!dmChannel) {
            // Retrieve user documents for both users
            const currentUserDoc = await User.findOne({ username: currentUser });
            const recipientDoc = await User.findOne({ username: recipient });

            if (!currentUserDoc || !recipientDoc) {
                return res.status(404).json({ error: "One or both users not found" });
            }

            // Create a new DM channel that includes only these two users
            dmChannel = new Channel({
                name: dmName,
                type: "dm",
                users: [currentUserDoc._id, recipientDoc._id]
            });

            await dmChannel.save();
        }

        res.json({ channelId: dmChannel._id });
    } catch (error) {
        console.error("Error getting DM channel:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Add this route to fetch message history
app.get('/messages/:channelId', authenticate, async (req, res) => {
    try {
        const messages = await Message.find({ channelId: req.params.channelId })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();
        res.json(messages.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.get("/channel/pending-requests/:channelId", authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId)
            .populate('pendingRequests', 'username');

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if requester is the channel creator
        if (channel.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ error: "Only the channel creator can view pending requests" });
        }

        res.json(channel.pendingRequests);
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        res.status(500).json({ error: "Failed to fetch pending requests" });
    }
});

// Get all channels including private ones (for navigation)
app.get("/all-channels", authenticate, async (req, res) => {
    try {
        // Get all channels except DMs
        const channels = await Channel.find({
            type: "channel"
        })
            .populate("team", "name")
            .lean();

        // Mark which channels the user is a member of
        const enhancedChannels = channels.map(channel => ({
            ...channel,
            isMember: channel.users.some(userId => userId.toString() === req.user.id),
            isCreator: channel.createdBy && channel.createdBy.toString() === req.user.id,
            hasPendingRequest: channel.pendingRequests && channel.pendingRequests.some(userId => userId.toString() === req.user.id)
        }));

        res.json(enhancedChannels);
    } catch (error) {
        console.error("Error fetching all channels:", error);
        res.status(500).json({ error: "Failed to fetch channels" });
    }
});

app.get("/all-channels-with-status", authenticate, async (req, res) => {
    try {
        // Get all channels except DMs
        const channels = await Channel.find({
            type: "channel"
        })
            .populate("team", "name")
            .lean();

        // Mark which channels the user is a member of, has a pending request, or has a pending invite
        const enhancedChannels = channels.map(channel => ({
            ...channel,
            isMember: channel.users.some(userId => userId.toString() === req.user.id),
            isCreator: channel.createdBy && channel.createdBy.toString() === req.user.id,
            hasPendingRequest: channel.pendingRequests && channel.pendingRequests.some(userId => userId.toString() === req.user.id),
            hasPendingInvite: channel.pendingInvites && channel.pendingInvites.some(userId => userId.toString() === req.user.id)
        }));

        res.json(enhancedChannels);
    } catch (error) {
        console.error("Error fetching all channels with status:", error);
        res.status(500).json({ error: "Failed to fetch channels" });
    }
});

// Message History
app.get('/message/history/:messageId', authenticate, async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId).lean();

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({
            message: message.message,
            editHistory: message.editHistory || []
        });
    } catch (error) {
        console.error('Error fetching message history:', error);
        res.status(500).json({ error: 'Failed to fetch message history' });
    }
});

app.get('/reminders', authenticate, async (req, res) => {
    try {
        const reminders = await Reminder.find({ userId: req.user.id, status: 'pending' })
            .populate('messageId', 'username message')
            .populate('channelId', 'name');
        res.json(reminders);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ error: 'Failed to fetch reminders' });
    }
});

//******************************POST Methods************************************//

// 1. Register a New User
app.post("/register", async (req, res) => {
    console.log("Received register request:", req.body); // Debugging log
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();
        res.json({ message: "User registered successfully!" });
    } catch (err) {
        res.status(400).json({ error: "Username already exists!" });
    }
});

// 2. Login a User
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found!" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ error: "Incorrect password!" });

    const token = generateToken(user); // Generate a token
    res.json({
        message: "Login successful!",
        token,
        role: user.role,
        username: user.username,
        userId: user._id.toString() // Explicitly include userId in the response
    });
});

// Admin: Create a Team and Assign Users
app.post("/admin/team", authenticate, isAdmin, async (req, res) => {
    const { teamName, users } = req.body;

    if (!teamName || !users || users.length === 0) {
        return res.status(400).json({ error: "Team name and users are required!" });
    }

    try {
        // Check if the team already exists
        const existingTeam = await Team.findOne({ name: teamName });
        if (existingTeam) {
            return res.status(400).json({ error: "Team already exists!" });
        }

        // Convert usernames to ObjectIds
        const userDocs = await User.find({ username: { $in: users } });

        // Check if all users exist
        if (userDocs.length !== users.length) {
            return res.status(400).json({ error: "One or more users not found!" });
        }

        // Extract user ObjectIds
        const userIds = userDocs.map(user => user._id);

        // Create the team with admin as creator
        const team = new Team({
            name: teamName,
            users: userIds,
            createdBy: req.user.id
        });
        await team.save();

        // Assign team ID to each user
        await User.updateMany(
            { _id: { $in: userIds } },
            { $set: { team: team._id } }
        );

        console.log(`✅ Team '${teamName}' created successfully!`);
        res.status(201).json({ message: `✅ Team '${teamName}' created successfully!` });
    } catch (err) {
        console.error("❌ Error creating team:", err);
        res.status(500).json({ error: "Failed to create team!" });
    }
});

app.post("/admin/channel", authenticate, isAdmin, async (req, res) => {
    console.log("📥 Received Channel Creation Request:", req.body);

    const { name, teamName, users } = req.body;

    if (!name || !teamName || !users || users.length === 0) {
        console.log("❌ Bad Request: Missing required fields.");
        return res.status(400).json({ error: "Channel name, team, and users are required!" });
    }

    try {
        console.log(`🔎 Checking if team '${teamName}' exists in database...`);
        const team = await Team.findOne({ name: teamName }).lean();

        if (!team) {
            console.log(`❌ Team '${teamName}' not found!`);
            return res.status(400).json({ error: `Team '${teamName}' does not exist!` });
        }

        console.log(`✅ Team '${teamName}' found! Proceeding with channel creation.`);

        console.log(`🔎 Checking if channel '${name}' already exists...`);
        const existingChannel = await Channel.findOne({ name, team: team._id }).lean();

        if (existingChannel) {
            console.log(`❌ Channel '${name}' already exists in this team!`);
            return res.status(400).json({ error: `Channel '${name}' already exists in this team!` });
        }

        // fetching the user ids with the usernames
        const userDocs = await User.find({ username: { $in: users } });
        const userIds = userDocs.map(user => user._id); // Store ObjectIds instead of usernames

        // Include the admin in the users array if not already included
        if (!userIds.some(id => id.toString() === req.user.id)) {
            userIds.push(req.user.id);
        }

        console.log(`✅ Creating new channel '${name}' for team '${teamName}'...`);
        const channel = new Channel({
            name,
            team: team._id,
            users: userIds,
            type: "channel",
            createdBy: req.user.id
        });
        await channel.save();

        console.log(`✅ Channel '${name}' created successfully!`);
        res.status(201).json({ message: `✅ Channel '${name}' created successfully!` });

    } catch (err) {
        console.error("❌ Error creating channel:", err);
        res.status(500).json({ error: "Failed to create channel!" });
    }
});

app.post("/admin/default-channel", authenticate, isAdmin, async (req, res) => {
    console.log("📥 Received Default Channel Creation Request:", req.body);

    const { name } = req.body;

    if (!name) {
        console.log("❌ Bad Request: Missing required field name.");
        return res.status(400).json({ error: "Channel name is required!" });
    }

    try {
        console.log(`🔎 Checking if default channel '${name}' already exists...`);
        const existingChannel = await Channel.findOne({ name, isDefault: true }).lean();

        if (existingChannel) {
            console.log(`❌ Default channel '${name}' already exists!`);
            return res.status(400).json({ error: `Default channel '${name}' already exists!` });
        }

        console.log(`✅ Creating new default channel '${name}'...`);

        // Create the default channel
        const channel = new Channel({
            name,
            type: "channel",
            isDefault: true,
            createdBy: req.user.id
        });

        await channel.save();

        console.log(`✅ Default channel '${name}' created successfully!`);
        res.status(201).json({ message: `✅ Default channel '${name}' created successfully!` });

    } catch (err) {
        console.error("❌ Error creating default channel:", err);
        res.status(500).json({ error: "Failed to create default channel!" });
    }
});


// 1. Create a private channel (for regular users)
// Update the private channel creation endpoint
app.post("/user/private-channel", authenticate, async (req, res) => {
    console.log("📥 Received Private Channel Creation Request:", req.body);
    console.log("👤 User making the request:", req.user);

    const { name, invitedUsers } = req.body;

    if (!name) {
        console.log("❌ Bad Request: Missing required field name.");
        return res.status(400).json({ error: "Channel name is required!" });
    }

    try {
        // Check if channel with same name exists
        const existingChannel = await Channel.findOne({
            name,
            $or: [
                { createdBy: req.user.id },
                { users: req.user.id }
            ]
        });

        if (existingChannel) {
            console.log(`❌ Channel '${name}' already exists!`);
            return res.status(400).json({ error: `Channel '${name}' already exists!` });
        }

        // Initialize user IDs with the creator only
        let userIds = [req.user.id];
        console.log(`👥 Adding creator ID to channel: ${req.user.id}`);

        // Initialize pending invites array
        let pendingInvites = [];

        // Process invited users - add them to pendingInvites instead of users
        if (invitedUsers && invitedUsers.length > 0) {
            console.log(`👥 Processing invited users for invites: ${invitedUsers}`);
            const invitedUserDocs = await User.find({ username: { $in: invitedUsers } });

            if (invitedUserDocs.length > 0) {
                pendingInvites = invitedUserDocs.map(user => user._id);
                console.log(`✅ Added ${invitedUserDocs.length} users to pending invites`);
            } else {
                console.log(`⚠️ No matching users found for usernames: ${invitedUsers}`);
            }
        }

        // Create the private channel - Add team if user has one
        const channelData = {
            name,
            users: userIds,
            type: "channel",
            createdBy: req.user.id,
            isPrivate: true,
            pendingRequests: [],
            pendingInvites: pendingInvites  // Add the new field for invites
        };

        // Add team field if user has a team
        if (req.user.team) {
            channelData.team = req.user.team;
        }

        const channel = new Channel(channelData);
        await channel.save();

        console.log(`✅ Private channel '${name}' created successfully with ID: ${channel._id}`);
        res.status(201).json({ message: `✅ Private channel '${name}' created successfully!` });
    } catch (err) {
        console.error("❌ Error creating private channel:", err);
        res.status(500).json({ error: "Failed to create private channel!" });
    }
});

app.post("/channel/accept-invite/:channelId", authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if user has a pending invitation
        if (!channel.pendingInvites || !channel.pendingInvites.includes(req.user.id)) {
            return res.status(400).json({ error: "You don't have an invitation for this channel" });
        }

        // Remove from pending invites and add to users
        channel.pendingInvites = channel.pendingInvites.filter(id => id.toString() !== req.user.id);
        channel.users.push(req.user.id);
        await channel.save();

        res.json({ message: "You've joined the channel successfully" });
    } catch (error) {
        console.error("Error accepting channel invitation:", error);
        res.status(500).json({ error: "Failed to accept invitation" });
    }
});

// Add endpoint to decline an invitation
app.post("/channel/decline-invite/:channelId", authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if user has a pending invitation
        if (!channel.pendingInvites || !channel.pendingInvites.includes(req.user.id)) {
            return res.status(400).json({ error: "You don't have an invitation for this channel" });
        }

        // Remove from pending invites
        channel.pendingInvites = channel.pendingInvites.filter(id => id.toString() !== req.user.id);
        await channel.save();

        res.json({ message: "Invitation declined" });
    } catch (error) {
        console.error("Error declining channel invitation:", error);
        res.status(500).json({ error: "Failed to decline invitation" });
    }
});

// 2. Request to join a private channel
app.post("/channel/request-join/:channelId", authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        if (!channel.isPrivate) {
            return res.status(400).json({ error: "This is not a private channel" });
        }

        // Check if user is already in the channel
        if (channel.users.includes(req.user.id)) {
            return res.status(400).json({ error: "You are already a member of this channel" });
        }

        // Check if user already has a pending request
        if (channel.pendingRequests.includes(req.user.id)) {
            return res.status(400).json({ error: "You already have a pending request to join this channel" });
        }

        // Add user to pending requests
        channel.pendingRequests.push(req.user.id);
        await channel.save();

        res.json({ message: "Join request sent successfully" });
    } catch (error) {
        console.error("Error requesting to join channel:", error);
        res.status(500).json({ error: "Failed to send join request" });
    }
});

// 3. Accept a join request (channel creator only)
app.post("/channel/accept-request/:channelId/:userId", authenticate, async (req, res) => {
    try {
        const { channelId, userId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if requester is the channel creator
        if (channel.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ error: "Only the channel creator can accept join requests" });
        }

        // Check if user is in pending requests
        if (!channel.pendingRequests.includes(userId)) {
            return res.status(400).json({ error: "No pending request found for this user" });
        }

        // Add user to channel members and remove from pending requests
        channel.users.push(userId);
        channel.pendingRequests = channel.pendingRequests.filter(id => id.toString() !== userId);
        await channel.save();

        res.json({ message: "User added to channel successfully" });
    } catch (error) {
        console.error("Error accepting join request:", error);
        res.status(500).json({ error: "Failed to accept join request" });
    }
});

// 4. Reject a join request (channel creator only)
app.post("/channel/reject-request/:channelId/:userId", authenticate, async (req, res) => {
    try {
        const { channelId, userId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if requester is the channel creator
        if (channel.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ error: "Only the channel creator can reject join requests" });
        }

        // Remove user from pending requests
        channel.pendingRequests = channel.pendingRequests.filter(id => id.toString() !== userId);
        await channel.save();

        res.json({ message: "Join request rejected successfully" });
    } catch (error) {
        console.error("Error rejecting join request:", error);
        res.status(500).json({ error: "Failed to reject join request" });
    }
});

// 5. Invite a user to a private channel (channel members only)
app.post("/channel/invite/:channelId", authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: "Username is required" });
        }

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if requester is a channel member
        if (!channel.users.includes(req.user.id)) {
            return res.status(403).json({ error: "Only channel members can invite users" });
        }

        // Find the user to invite
        const userToInvite = await User.findOne({ username });

        if (!userToInvite) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if user is already in the channel
        if (channel.users.includes(userToInvite._id)) {
            return res.status(400).json({ error: "User is already a member of this channel" });
        }

        // Check if user is already invited
        if (channel.pendingInvites && channel.pendingInvites.includes(userToInvite._id)) {
            return res.status(400).json({ error: "User already has a pending invitation" });
        }

        // Add user to pending invites instead of directly to users
        if (!channel.pendingInvites) {
            channel.pendingInvites = [];
        }

        channel.pendingInvites.push(userToInvite._id);
        await channel.save();

        res.json({ message: `Invitation sent to ${username} successfully` });
    } catch (error) {
        console.error("Error inviting user to channel:", error);
        res.status(500).json({ error: "Failed to invite user" });
    }
});

// 6. Leave a channel
app.post("/channel/leave/:channelId", authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;

        // Find the channel
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if user is a channel member
        if (!channel.users.includes(req.user.id)) {
            return res.status(400).json({ error: "You are not a member of this channel" });
        }

        // Cannot leave if you're the creator
        if (channel.createdBy.toString() === req.user.id) {
            return res.status(400).json({ error: "Channel creator cannot leave the channel" });
        }

        // Remove user from channel members
        channel.users = channel.users.filter(id => id.toString() !== req.user.id);
        await channel.save();

        res.json({ message: "You have left the channel successfully" });
    } catch (error) {
        console.error("Error leaving channel:", error);
        res.status(500).json({ error: "Failed to leave channel" });
    }
});

app.post('/reminder', authenticate, async (req, res) => {
    const { messageId, channelId, reminderTime } = req.body;
    if (!messageId || !channelId || !reminderTime) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const reminder = new Reminder({
            userId: req.user.id,
            messageId,
            channelId,
            reminderTime: new Date(reminderTime),
            status: 'pending'
        });
        await reminder.save();
        res.status(201).json({ message: 'Reminder set successfully' });
    } catch (error) {
        console.error('Error setting reminder:', error);
        res.status(500).json({ error: 'Failed to set reminder' });
    }
});

//******************************DELETE Methods************************************//

app.delete('/reminder/:id', authenticate, async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id, status: 'pending' },
            { status: 'canceled' },
            { new: true }
        );
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found or already processed' });
        }
        res.json({ message: 'Reminder canceled successfully' });
    } catch (error) {
        console.error('Error canceling reminder:', error);
        res.status(500).json({ error: 'Failed to cancel reminder' });
    }
});

// Catch-all 404 route handler - place at the end
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" }); // Error 404 Page
});

// Initialize default channels if they don't exist
async function initializeDefaultChannels() {
    try {
        // Find an admin user
        const adminUser = await User.findOne({ role: "admin" });

        if (!adminUser) {
            console.log("⚠️ No admin user found to create default channels");
            return;
        }

        // Define default channels
        const defaultChannelNames = ["all-general", "all-announcements", "all-help"];

        for (const channelName of defaultChannelNames) {
            // Check if the default channel already exists
            const existingChannel = await Channel.findOne({ name: channelName, isDefault: true });

            if (!existingChannel) {
                // Create default channel
                const defaultChannel = new Channel({
                    name: channelName,
                    type: "channel",
                    isDefault: true,
                    createdBy: adminUser._id
                });

                await defaultChannel.save();
                console.log(`✅ Created default channel: ${channelName}`);
            }
        }

        console.log("✅ Default channels initialized");
    } catch (error) {
        console.error("❌ Error initializing default channels:", error);
    }
}

// Start the Server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Initialize default channels when server starts
    initializeDefaultChannels();

    // Start reminder checking
    setInterval(async () => {
        try {
            const now = new Date();
            const dueReminders = await Reminder.find({
                reminderTime: { $lte: now },
                status: 'pending'
            }).populate('messageId', 'username message');
            for (const reminder of dueReminders) {
                const userId = reminder.userId.toString();
                const message = reminder.messageId;
                io.to(userId).emit('reminder', {
                    message: `Reminder: ${message.username} said "${message.message}"`,
                    channelId: reminder.channelId,
                    messageId: reminder.messageId
                });
                await Reminder.updateOne({ _id: reminder._id }, { status: 'sent' });
            }
        } catch (error) {
            console.error('Error processing reminders:', error);
        }
    }, 60000); // Every minute
});
