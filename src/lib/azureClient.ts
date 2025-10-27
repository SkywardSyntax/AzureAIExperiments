import OpenAI from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion =
  process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

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

export const azureClient = new OpenAI({
  apiKey,
  baseURL: endpoint ? `${endpoint}/openai/v1` : undefined,
  defaultQuery: { "api-version": apiVersion },
});

export const defaultDeployment =
  process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1";
