// server.js changes
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Socket.IO integration - FIXED: Move socket.io setup before routes
const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


// server.js additions - Add this after your existing Socket.IO setup
const messageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    username: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

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
                timestamp: new Date()
            });
            await newMessage.save();

            // Broadcast message to all users in the channel
            io.to(channelId).emit('message', {
                username,
                message,
                timestamp: newMessage.timestamp
            });

            // Log successful broadcast
            console.log('Message broadcast to channel:', channelId);
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', 'Failed to send message');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (socket.currentChannel) {
            socket.leave(socket.currentChannel);
        }
        console.log('User disconnected:', socket.id);
    });
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

// Configure middleware
app.use(express.static("public"));
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
    .connect("mongodb://localhost:27017/chatApp", {
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
    createdAt: { type: Date, default: Date.now } // Timestamp
});

const Team = mongoose.model("Team", teamSchema);

// Channel Schema
const channelSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the channel
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true }, // The team this channel belongs to
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Array of user IDs
});

const Channel = mongoose.model("Channel", channelSchema);

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

// Routes

//******************************GET Methods************************************//

// 1. Home Page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Get the teams for an admin
app.get("/admin/teams", authenticate, isAdmin, async (req, res) => {
    try {
        console.log("🔹 Fetching teams from database...");
        // ✅ Fetch the user's teams (users can be part of multiple teams)
        const user = await User.findById(req.user.id).select("team").lean();

        if (!user) {
            console.log(`❌ No user found with ID: ${req.user.id}`);
            return res.status(404).json({ error: "User not found!" });
        }

        if (!user.team) {
            console.log(`❌ User '${req.user.username}' is not assigned to any team.`);
            return res.status(400).json({ error: "User is not assigned to any team!" });
        }

        console.log(`✅ User '${req.user.username}' belongs to team ID: ${user.team}`);

        // ✅ Find the team(s) that the user belongs to
        const teams = await Team.find({ _id: user.team }, "name").lean();

        if (!teams || teams.length === 0) {
            console.log("⚠️ No teams found for user!");
            return res.status(404).json({ error: "No teams available for this user." });
        }

        console.log("✅ Teams retrieved:", teams);
        res.json(teams);
    } catch (error) {
        console.error("❌ Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams!" });
    }
});

// Get the teams for a user
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


// 1. Get Channels for a Team
app.get("/channels", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate("team").lean();

        if (!user) {
            return res.status(404).json({ error: "User not found!" });
        }

        if (!user.team) {
            return res.status(400).json({ error: "User is not assigned to any team!" });
        }

        const channels = await Channel.find({ team: user.team._id }).populate("team").lean();

        if (!channels || channels.length === 0) {
            return res.json([]); // Return empty array instead of error
        }

        res.json(channels);
    } catch (err) {
        console.error("Error fetching channels:", err);
        res.status(500).json({ error: "Failed to fetch channels!" });
    }
});

// 2. Get User Details by Username (No Authentication Required)
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
    res.json({ message: "Login successful!", token, role: user.role });
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

        // Create the team
        const team = new Team({ name: teamName, users: userIds });
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
        const existingChannel = await Channel.findOne({ name }).lean();

        if (existingChannel) {
            console.log(`❌ Channel '${name}' already exists!`);
            return res.status(400).json({ error: `Channel '${name}' already exists!` });
        }

        // fetching the user ids with the usernames
        const userDocs = await User.find({ username: { $in: users } });
        const userIds = userDocs.map(user => user._id); // Store ObjectIds instead of usernames

        console.log(`✅ Creating new channel '${name}' for team '${teamName}'...`);
        const channel = new Channel({ name, team: team._id, users: userIds });
        await channel.save();

        console.log(`🔹 Updating users: ${users} to be assigned to channel '${name}'...`);

        await User.updateMany(
            { _id: { $in: userIds } },
            { $push: { channels: channel._id } }
        );

        console.log(`✅ Channel '${name}' created successfully!`);
        res.status(201).json({ message: `✅ Channel '${name}' created successfully!` });

    } catch (err) {
        console.error("❌ Error creating channel:", err);
        res.status(500).json({ error: "Failed to create channel!" });
    }
});

app.use((req, res) => {
    res.status(404).json({ error: "Route not found" }); // Error 404 Page
});

// Start the Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});