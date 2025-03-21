const request = require("supertest");   //install this: npm install supertest --save-dev
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server"); //install this: npm install --save-dev mongodb-memory-server
const {app} = require("./server"); // Path
const {running} = require("./server"); // Path

let mongoServer;
let serverInstance;

//SETTING UP THE EVIRONMENT
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect(); // Make sure no prior connections are open
    }

    await mongoose.connect(mongoUri);

    serverInstance = app.listen(5001, () => console.log("Test server running on 5001"));
});

afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }
  
    if (serverInstance) {
      serverInstance.close(); // Make sure the server is closed after tests
    }

    if (running) {
        running.close(); // Close the server running on port 5000
    }

  });
// CLOSING THE ENVIRONEMENT

describe("User Authentication", () => {
    it("should register a new user", async () => {
        const res = await request(app)
            .post("/register")
            .send({ username: "test", password: "123", role: "user" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("User registered successfully!");
    });

    it("should not allow duplicate usernames", async () => {
        const res = await request(app)
            .post("/register")
            .send({ username: "test", password: "123", role: "user" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username already exists!");
    });

    it("should login with valid credentials", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: "test", password: "123" });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    it("should reject invalid login credentials", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: "test", password: "321" });

        expect(res.status).toBe(400);
        expect(["User not found!", "Incorrect password!"]).toContain(res.body.error);
    });
});
