const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // For hashing passwords
const jwt = require("jsonwebtoken"); // For creating tokens
const cors = require("cors"); // To allow API calls from other domains
const path = require("path");

// Initialize Express App
const app = express();

app.use(express.json()); // This allows Express to parse JSON
app.use(cors()); // Allow requests from other origins
app.use(express.static(path.join(__dirname, "public"))); // Allowing backend to serve static files in frontend

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
app.get("/user/teams", authenticate, async (req, res) => {
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

// 1. Get Channels for a Team
app.get("/channels", authenticate, async (req, res) => {
    console.log("🔹 Fetching channels from database...");

    try {
        // ✅ Check if req.user is defined
        if (!req.user || !req.user.id) {
            console.log("❌ req.user is undefined or missing 'id'");
            return res.status(401).json({ error: "Unauthorized: No user data in request!" });
        }

        console.log(`🔎 Fetching user with ID: ${req.user.id}`);

        // ✅ Fetch the logged-in user's team
        const user = await User.findById(req.user.id).populate("team").lean();

        if (!user) {
            console.log(`❌ No user found with ID: ${req.user.id}`);
            return res.status(404).json({ error: "User not found!" });
        }

        if (!user.team) {
            console.log(`❌ User '${user.username}' does not belong to any team.`);
            return res.status(400).json({ error: "User is not assigned to any team!" });
        }

        console.log(`✅ User '${user.username}' belongs to team: ${user.team.name} (ID: ${user.team._id})`);

        // ✅ Find channels that belong to this team
        const channels = await Channel.find({ team: user.team }).populate("team").lean();

        console.log(`✅ Found ${channels.length} channels for team '${user.team.name}: '${channels[0].name}'.`);
        res.json(channels);
    } catch (err) {
        res.status(400).json({ error: "Failed to fetch channels!" });
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

    if (!name || !teamName || !Array.isArray(users) || users.length === 0) {
        console.log("❌ Bad Request: Missing required fields.");
        return res.status(400).json({ error: "Channel name, team, and users are required!" });
    }

    try {
        console.log(`🔎 Checking if team '${teamName}' exists in the database...`);
        const team = await Team.findOne({ name: teamName });

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

        // 🔎 Fetch user documents based on usernames in the request body
        const userDocs = await User.find({ username: { $in: users } });

        // Find users who are NOT in the specified team
        const usersNotInTeam = users.filter(username => {
            const user = userDocs.find(user => user.username === username);
            return !user || String(user.team) !== String(team._id); // If user is not found or not in the team
        });

        if (usersNotInTeam.length > 0) {
            console.log(`❌ The following users do not belong to the team '${teamName}': ${usersNotInTeam.join(", ")}`);
            return res.status(400).json({ error: `These users do not belong to team '${teamName}': ${usersNotInTeam.join(", ")}` });
        }

        // Extract user IDs for valid users
        const userIds = userDocs.map(user => user._id);

        console.log(`✅ Creating new channel '${name}' for team '${teamName}' with users: ${users.join(", ")}`);
        const channel = new Channel({ name, team: team._id, users: userIds });
        await channel.save();

        console.log(`🔹 Assigning users to channel '${name}'...`);
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
app.listen(5000, () => {
    console.log("Server is running on http://localhost:5000");
});
