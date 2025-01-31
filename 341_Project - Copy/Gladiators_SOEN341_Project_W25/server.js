const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // For hashing passwords
const jwt = require("jsonwebtoken"); // For creating tokens
const cors = require("cors"); // To allow API calls from other domains

// Initialize Express App
const app = express();
app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Allow requests from other origins

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
    team: { type: String, default: null }, // The team assigned to the user (optional)
});

const User = mongoose.model("User", userSchema);

// Channel Schema
const channelSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name of the channel
    team: { type: String, required: true }, // The team this channel belongs to
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

// 1. Register a New User
app.post("/register", async (req, res) => {
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

// 3. Admin: Create a Team and Assign Users
app.post("/admin/team", authenticate, isAdmin, async (req, res) => {
    const { teamName, users } = req.body;

    if (!teamName || !users || users.length === 0) {
        return res.status(400).json({ error: "Team name and users are required!" });
    }

    try {
        await User.updateMany(
            { username: { $in: users } },
            { $set: { team: teamName } }
        );
        res.json({ message: `Team '${teamName}' created and users assigned!` });
    } catch (err) {
        res.status(400).json({ error: "Failed to assign users to the team!" });
    }
});

// 4. Admin: Create a Channel
app.post("/admin/channel", authenticate, isAdmin, async (req, res) => {
    const { name, team } = req.body;

    if (!name || !team) {
        return res.status(400).json({ error: "Channel name and team are required!" });
    }

    try {
        const newChannel = new Channel({ name, team });
        await newChannel.save();
        res.json({ message: `Channel '${name}' created for team '${team}'!` });
    } catch (err) {
        res.status(400).json({ error: "Failed to create channel!" });
    }
});

// 5. Get Channels for a Team
app.get("/channels", authenticate, async (req, res) => {
    const team = req.user.team; // Team comes from the logged-in user

    if (!team) {
        return res.status(400).json({ error: "User is not assigned to any team!" });
    }

    try {
        const channels = await Channel.find({ team });
        res.json(channels);
    } catch (err) {
        res.status(400).json({ error: "Failed to fetch channels!" });
    }
});

// 6. Get User Details by Username (No Authentication Required)
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

        // Create the team
        const team = new Team({ name: teamName });
        await team.save();

        // Assign users to the team
        await User.updateMany(
            { username: { $in: users } },
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

        console.log(`✅ Creating new channel '${name}' for team '${teamName}'...`);
        const channel = new Channel({ name, team: team._id, users: [] });
        await channel.save();

        console.log(`🔹 Updating users: ${users} to be assigned to channel '${name}'...`);
        await User.updateMany(
            { username: { $in: users } },
            { $push: { channels: channel._id } }
        );

        console.log(`✅ Channel '${name}' created successfully!`);
        res.status(201).json({ message: `✅ Channel '${name}' created successfully!` });

    } catch (err) {
        console.error("❌ Error creating channel:", err);
        res.status(500).json({ error: "Failed to create channel!" });
    }
});


// Get All Teams (for Admin Panel)
app.get("/admin/teams", authenticate, isAdmin, async (req, res) => {
    try {
        const teams = await Team.find({}, "name"); // Only return team names
        res.json(teams);
    } catch (error) {
        console.error("❌ Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams!" });
    }
});


app.get("/admin/teams", authenticate, isAdmin, async (req, res) => {
    try {
        console.log("🔹 Fetching teams from database...");
        const teams = await Team.find({}, "name").lean();

        if (!teams || teams.length === 0) {
            console.log("⚠️ No teams found!");
            return res.status(404).json({ error: "No teams available." });
        }

        console.log("✅ Teams retrieved:", teams);
        res.json(teams);
    } catch (error) {
        console.error("❌ Error fetching teams:", error);
        res.status(500).json({ error: "Failed to fetch teams!" });
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



// Start the Server
app.listen(5000, () => {
    console.log("Server is running on http://localhost:5000");
});
