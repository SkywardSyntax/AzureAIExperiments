import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.AZURE_OPENAI_API_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

console.log("Testing Azure OpenAI Connection:");
console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET");
console.log("Endpoint:", endpoint);
console.log("Deployment:", deployment);

async function testConnections() {
  // Test 1: Current implementation (with /openai/v1 appended)
  const client1 = new OpenAI({
    apiKey,
    baseURL: endpoint ? `${endpoint}/openai/v1` : undefined,
  });

  console.log("\n=== Test 1: Current implementation ===");
  console.log("Base URL:", `${endpoint}/openai/v1`);

  try {
    const response = await client1.responses.create({
      model: deployment ?? "gpt-4.1",
      input: "Hello, this is a test.",
    });
    console.log("✅ SUCCESS - Current implementation works!");
    console.log("Response:", response.output_text);
  } catch (error: any) {
    console.log("❌ FAILED - Current implementation");
    console.log("Error:", error.message);
    if (error.status) console.log("Status:", error.status);
    if (error.code) console.log("Code:", error.code);
    console.log("Full error:", JSON.stringify(error, null, 2));
  }

  // Test 2: Direct endpoint without modification
  const client2 = new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/v1/`,
  });

  console.log("\n=== Test 2: Direct endpoint with /openai/v1/ ===");
  console.log("Base URL:", `${endpoint}/openai/v1/`);

  try {
    const response = await client2.responses.create({
      model: deployment ?? "gpt-4.1",
      input: "Hello, this is a test.",
    });
    console.log("✅ SUCCESS - Direct endpoint works!");
    console.log("Response:", response.output_text);
  } catch (error: any) {
    console.log("❌ FAILED - Direct endpoint");
    console.log("Error:", error.message);
    if (error.status) console.log("Status:", error.status);
    if (error.code) console.log("Code:", error.code);
    console.log("Full error:", JSON.stringify(error, null, 2));
  }
}

testConnections().catch(console.error);
