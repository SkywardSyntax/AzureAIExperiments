import OpenAI from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;

if (!apiKey) {
  console.warn(
    "[azureClient] Missing AZURE_OPENAI_API_KEY. Calls to Azure OpenAI will fail until this is set.",
  );
}

if (!endpoint) {
  console.warn(
    "[azureClient] Missing AZURE_OPENAI_ENDPOINT. Calls to Azure OpenAI will fail until this is set.",
  );
}

// For the Responses API v1, no api-version query parameter is needed
// The OpenAI library handles the endpoint correctly with /openai/v1
export const azureClient = new OpenAI({
  apiKey,
  baseURL: endpoint ? `${endpoint}/openai/v1` : undefined,
});

export const defaultDeployment =
  process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1";
