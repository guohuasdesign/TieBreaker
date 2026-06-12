import express from "express";
import path from "path";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON bodies
app.use(express.json());

// Initialize Gemini SDK with telemetry user-agent
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// System instruction profiles for archetypes
const ARCHETYPE_PROFILES = {
  rationalist: {
    name: "The Rationalist",
    instruction: "You are the ultimate analytical decision master. Your tone is highly logical, objective, pragmatic, and clear. You break ties using clear quantitative reasoning, highlighting costs, effort, and returns. Avoid vague feelings; focus on probability, risk mitigation, and tangible rewards."
  },
  intuitive: {
    name: "The Intuitive Finder",
    instruction: "You are an emotionally intelligent decision guide. Your tone is warm, personal, deeply perceptive, and holistic. You break ties by prioritizing internal joy, mental health, energy preservation, creative stimulation, alignment with core values, and overall life fulfillment."
  },
  bold_adventurer: {
    name: "The Bold Adventurer",
    instruction: "You are a daring explorer of paths. Your tone is energetic, motivating, and action-oriented. You break ties by encouraging the user to step out of their comfort zone, take calculated risks, prioritize growth, adventure, skill acquisition, and prevent regret from stagnation."
  },
  risk_minimizer: {
    name: "The Safe Steward",
    instruction: "You are a highly protective advisor. Your tone is cautious, calculated, supportive, and safe. You break ties by looking for low-downside paths, robust fallbacks, high predictability, security, and minimizing loss or stress. You evaluate the worst-case scenario carefully."
  }
};

// JSON Schema definition for our structured analysis
const DECISION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    decision: { type: Type.STRING, description: "The original decision prompt that was submitted." },
    archetype: { type: Type.STRING, description: "The decision profile archetype utilized." },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of options analyzed."
    },
    verdict: {
      type: Type.OBJECT,
      properties: {
        chosenOption: { type: Type.STRING, description: "The absolute best choice to pick to break the tie." },
        confidenceScore: { type: Type.INTEGER, description: "A percentage confidence scoring (0 to 100) on why this option breaks the tie." },
        mainArgument: { type: Type.STRING, description: "A compelling 2-sentence tie-breaking summary of why this option wins." },
        whatToWatchOutFor: { type: Type.STRING, description: "The biggest reservation or warning sign the user should monitor if they proceed." },
        actionableNextSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2-3 immediate action items to kickstart or validate the selection."
        }
      },
      required: ["chosenOption", "confidenceScore", "mainArgument", "whatToWatchOutFor", "actionableNextSteps"]
    },
    optionAnalyses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          optionName: { type: Type.STRING, description: "Name of this particular option." },
          overallScore: { type: Type.INTEGER, description: "Numerical overall score representing this path from 0 to 100." },
          motto: { type: Type.STRING, description: "A catchy, fitting 5-word motto summarizing this path's mindset." },
          pros: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique short alphanumeric code (e.g. 'pro1', 'pro2')" },
                text: { type: Type.STRING, description: "A concrete, specific advantage of this option." },
                impact: { type: Type.STRING, description: "Must be exactly 'High', 'Medium', or 'Low'" },
                weight: { type: Type.INTEGER, description: "Default initial suggested relevance weight from 1 to 5." },
                category: { type: Type.STRING, description: "Category label like Financial, Emotional, Growth, Effort, health, etc." }
              },
              required: ["id", "text", "impact", "weight", "category"]
            }
          },
          cons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique short alphanumeric code (e.g. 'con1', 'con2')" },
                text: { type: Type.STRING, description: "A concrete, specific disadvantage of this option." },
                impact: { type: Type.STRING, description: "Must be exactly 'High', 'Medium', or 'Low'" },
                weight: { type: Type.INTEGER, description: "Default initial suggested relevance weight from 1 to 5." },
                category: { type: Type.STRING, description: "Category label like Financial, Emotional, Growth, Effort, health, etc." }
              },
              required: ["id", "text", "impact", "weight", "category"]
            }
          }
        },
        required: ["optionName", "overallScore", "motto", "pros", "cons"]
      }
    },
    swot: {
      type: Type.OBJECT,
      properties: {
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Strengths profile overall (2-3 bullets)." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Weaknesses profile overall (2-3 bullets)." },
        opportunities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Opportunities profile overall (2-3 bullets)." },
        threats: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Threats/risks profile overall (2-3 bullets)." }
      },
      required: ["strengths", "weaknesses", "opportunities", "threats"]
    },
    comparisons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dimension: { type: Type.STRING, description: "The dimension/criterion (e.g., Joy, Effort, Growth, Financial, Long-term Value)." },
          description: { type: Type.STRING, description: "Brief description of why this dimension is crucial to the decision." },
          ratings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                optionName: { type: Type.STRING, description: "The name of the option." },
                score: { type: Type.INTEGER, description: "Rating score between 1 and 10." },
                justification: { type: Type.STRING, description: "A 1-sentence explanation of this score." }
              },
              required: ["optionName", "score", "justification"]
            }
          }
        },
        required: ["dimension", "description", "ratings"]
      }
    }
  },
  required: ["decision", "archetype", "options", "verdict", "optionAnalyses", "swot", "comparisons"]
};

// Resilient content generator utility with fallback models and retry capability
async function generateContentWithFallback(ai: any, contents: string, config: any) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    // Try the current model up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Executing Tiebreaker analysis on model ${model} (Attempt ${attempt}/2)`);
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: config,
        });

        if (response && response.text) {
          return response;
        }
        throw new Error("Received empty text output from GenAI model.");
      } catch (err: any) {
        lastError = err;
        const msg = String(err.message || "").toLowerCase();
        const isTransient = msg.includes("503") || 
                            msg.includes("unavailable") || 
                            msg.includes("demand") || 
                            msg.includes("429") || 
                            msg.includes("rate limit") ||
                            msg.includes("overloaded");

        if (!isTransient) {
          // Schema validation or bad request issues should fail early
          throw err;
        }

        console.warn(`Model ${model} failed with transient error ${err.message || err}. Retrying/falling back...`);
        if (attempt < 2) {
          // Pause briefly (exponential ramp) before retry
          await new Promise((resolve) => setTimeout(resolve, attempt * 800));
        }
      }
    }
  }

  throw lastError || new Error("All active inference endpoints and retry fallbacks failed.");
}

// API Route for decision analysis
app.post("/api/analyze-decision", async (req, res) => {
  try {
    const { decision, options, archetype, personalSituation } = req.body;

    if (!decision) {
      res.status(400).json({ error: "No decision prompt provided" });
      return;
    }

    const normalizedOptions = options && options.length >= 2 
      ? options.filter((o: string) => o.trim() !== "")
      : ["Option A: Do it", "Option B: Do not do it"]; // Default binary

    const profile = ARCHETYPE_PROFILES[archetype as keyof typeof ARCHETYPE_PROFILES] || ARCHETYPE_PROFILES.rationalist;

    // Build the prompt for Gemini
    const userPrompt = `
      Please perform a highly objective, rigorous decision comparison for the following decision query:
      Decision Prompt: "${decision}"
      
      Personal Situation / Context of the Decision Maker:
      "${personalSituation || "None provided."}"
      
      Options to analyze:
      ${normalizedOptions.map((opt: string, idx: number) => `- ${idx + 1}. "${opt}"`).join("\n")}

      Analyze this from the perspective of the decision archetype profile: "${profile.name}".
      ${profile.instruction}

      CRITICAL ROLE: The entire analysis—including the pros and cons, the SWOT quadrants, the chosen winner, the next steps, and the rated parameters—MUST be directly tailored to and heavily influenced by the 'Personal Situation / Context' provided above. For example, if they have '0 marketing budget', options with high marketing costs must have that noted as a major Con and receive lower scores in corresponding dimensions. Customize every rating to make sense for their stated reality.

      You must strictly adhere to the provided JSON Schema. Do not return any other text besides the valid JSON.
      Include 3-5 vivid and custom pros and cons for each option. Map out the SWOT items and provide exactly 3 comparisons dimensions (e.g., Short-term Happiness, Effort/Friction, Long-term Growth) with rated metrics.
      Ensure the chosen option is EXACTLY one of the options listed: ${JSON.stringify(normalizedOptions)} (do not rewrite or alter the text of the chosen option in the verdict).
    `;

    // Retrieve client
    const ai = getGeminiClient();

    const response = await generateContentWithFallback(ai, userPrompt, {
      responseMimeType: "application/json",
      responseSchema: DECISION_RESPONSE_SCHEMA,
      temperature: 0.7,
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Received empty response from Gemini model.");
    }

    const parsedJson = JSON.parse(textOutput.trim());
    res.json(parsedJson);

  } catch (error: any) {
    console.error("Gemini decision-making analysis error:", error);
    res.status(500).json({ 
      error: error.message || "An error occurred while generating your decision breakdown. Check that your GEMINI_API_KEY is configured." 
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Vite Setup / static file serving flow
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`The Tiebreaker server bounds securely to http://localhost:${PORT}`);
  });
}

initializeServer();
