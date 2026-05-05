import { aresCritic } from "./lib/ares/critic";

async function testAresCritic() {
  console.log("Starting ARES Critic test...");
  
  const draft = `
    The defendant's motion to dismiss should be denied. 
    As an AI model, I cannot provide legal advice, but the citations support the claim.
    There is no bottom line here.
  `;

  const result = await aresCritic({
    draft,
    matterId: "test-matter-123"
  });

  console.log("Critic Result:", JSON.stringify(result, null, 2));
}

testAresCritic().catch(console.error);
