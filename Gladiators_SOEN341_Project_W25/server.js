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
    name: { type: String, required: true }, // Name of the channel or DM
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: function () { return this.type === "channel"; } },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // For team channels, this can include multiple users; for DMs, only 2 users
    type: { type: String, enum: ["channel", "dm"], default: "channel" }, // "channel" for team channels, "dm" for direct messages
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // Store admin who created the channel
});

const Channel = mongoose.model("Channel", channelSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    username: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false } // isDeleted field for message deletion
});

const Message = mongoose.model('Message', messageSchema);

// Store connected users and their roles
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Store user information when they connect
    socket.on('user info', (data) => {
        if (data.username && data.role) {
            connectedUsers.set(socket.id, {
                username: data.username,
                role: data.role
            });
            console.log(`User ${data.username} with role ${data.role} registered`);
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
    socket.on('disconnect', () => {
        // Remove user from connected users
        connectedUsers.delete(socket.id);

        if (socket.currentChannel) {
            socket.leave(socket.currentChannel);
        }
        console.log('User disconnected:', socket.id);
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

// Get Channels for a Team
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
                type: "channel"
            }).populate("team", "name").lean();

            channels = adminChannels;
        }
        // For regular users, get channels for their team
        else if (user.team) {
            const teamChannels = await Channel.find({
                team: user.team,
                type: "channel"
            }).populate("team", "name").lean();

            channels = teamChannels;
        }

        // For all users, get their DM channels
        const dmChannels = await Channel.find({
            users: user._id,
            type: "dm"
        }).lean();

        // Combine both types of channels
        const allChannels = [...channels, ...dmChannels];

        res.json(allChannels);
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

//******************************POST Methods************************************//

// 1. Register a New User
app.post("/register", async (req, res) => {
    console.log("Received register request:", req.body); // Debugging log
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }

    try {
        // Check if the username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists!" });
        }

        // If the username doesn't exist, hash the password and create a new user
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();
        res.json({ message: "User registered successfully!" });
    } catch (err) {
        // Catch any other errors and send a generic error response
        res.status(500).json({ error: "Server error. Please try again." });
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
        username: user.username // Include username in the response
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

// Catch-all 404 route handler - place at the end
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" }); // Error 404 Page
});

// Start the Server
const PORT = process.env.PORT || 5000;
const running = server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { app, running }; //export for testing