const fetch = require("node-fetch");

async function run() {
  const RENDER_URL = "https://uptoskills-backend.onrender.com";
  
  // 1. Create a dummy user
  const email = `test.render.${Date.now()}@example.com`;
  console.log("Registering user:", email);
  
  let res = await fetch(`${RENDER_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: email,
      password: "Password123!",
      orgName: "Test Org"
    })
  });
  
  let data = await res.json();
  if (!res.ok) {
    console.log("Register failed:", data);
    return;
  }
  
  const token = data.token;
  console.log("Registered successfully. Token acquired.");
  
  // 2. Hit the test-email endpoint
  console.log("\nHitting /api/notifications/test-email...");
  res = await fetch(`${RENDER_URL}/api/notifications/test-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });
  
  data = await res.json();
  console.log("Test Email Response:");
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
