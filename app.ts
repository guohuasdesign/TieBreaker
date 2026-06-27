import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.local") });

const app = express();

// Middleware for parsing JSON bodies
app.use(express.json());

const Type = {
  STRING: "STRING",
  INTEGER: "INTEGER",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
} as const;

// Initialize Gemini SDK with telemetry user-agent
const getGeminiClient = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not defined. Please add it in Settings > Secrets.",
    );
  }
  const { GoogleGenAI } = await import("@google/genai");
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
    instruction:
      "You are the ultimate analytical decision master. Your tone is highly logical, objective, pragmatic, and clear. You break ties using clear quantitative reasoning, highlighting costs, effort, and returns. Avoid vague feelings; focus on probability, risk mitigation, and tangible rewards.",
  },
  intuitive: {
    name: "The Intuitive Finder",
    instruction:
      "You are an emotionally intelligent decision guide. Your tone is warm, personal, deeply perceptive, and holistic. You break ties by prioritizing internal joy, mental health, energy preservation, creative stimulation, alignment with core values, and overall life fulfillment.",
  },
  bold_adventurer: {
    name: "The Bold Adventurer",
    instruction:
      "You are a daring explorer of paths. Your tone is energetic, motivating, and action-oriented. You break ties by encouraging the user to step out of their comfort zone, take calculated risks, prioritize growth, adventure, skill acquisition, and prevent regret from stagnation.",
  },
  risk_minimizer: {
    name: "The Safe Steward",
    instruction:
      "You are a highly protective advisor. Your tone is cautious, calculated, supportive, and safe. You break ties by looking for low-downside paths, robust fallbacks, high predictability, security, and minimizing loss or stress. You evaluate the worst-case scenario carefully.",
  },
};

// JSON Schema definition for our structured analysis
const DECISION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    decision: {
      type: Type.STRING,
      description: "The original decision prompt that was submitted.",
    },
    archetype: {
      type: Type.STRING,
      description: "The decision profile archetype utilized.",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of options analyzed.",
    },
    verdict: {
      type: Type.OBJECT,
      properties: {
        chosenOption: {
          type: Type.STRING,
          description: "The absolute best choice to pick to break the tie.",
        },
        confidenceScore: {
          type: Type.INTEGER,
          description:
            "A percentage confidence scoring (0 to 100) on why this option breaks the tie.",
        },
        mainArgument: {
          type: Type.STRING,
          description:
            "A compelling 2-sentence tie-breaking summary of why this option wins.",
        },
        whatToWatchOutFor: {
          type: Type.STRING,
          description:
            "The biggest reservation or warning sign the user should monitor if they proceed.",
        },
        actionableNextSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "2-3 immediate action items to kickstart or validate the selection.",
        },
      },
      required: [
        "chosenOption",
        "confidenceScore",
        "mainArgument",
        "whatToWatchOutFor",
        "actionableNextSteps",
      ],
    },
    optionAnalyses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          optionName: {
            type: Type.STRING,
            description: "Name of this particular option.",
          },
          overallScore: {
            type: Type.INTEGER,
            description:
              "Numerical overall score representing this path from 0 to 100.",
          },
          motto: {
            type: Type.STRING,
            description:
              "A catchy, fitting 5-word motto summarizing this path's mindset.",
          },
          pros: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description:
                    "Unique short alphanumeric code (e.g. 'pro1', 'pro2')",
                },
                text: {
                  type: Type.STRING,
                  description: "A concrete, specific advantage of this option.",
                },
                impact: {
                  type: Type.STRING,
                  description: "Must be exactly 'High', 'Medium', or 'Low'",
                },
                weight: {
                  type: Type.INTEGER,
                  description:
                    "Default initial suggested relevance weight from 1 to 5.",
                },
                category: {
                  type: Type.STRING,
                  description:
                    "Category label like Financial, Emotional, Growth, Effort, health, etc.",
                },
              },
              required: ["id", "text", "impact", "weight", "category"],
            },
          },
          cons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description:
                    "Unique short alphanumeric code (e.g. 'con1', 'con2')",
                },
                text: {
                  type: Type.STRING,
                  description:
                    "A concrete, specific disadvantage of this option.",
                },
                impact: {
                  type: Type.STRING,
                  description: "Must be exactly 'High', 'Medium', or 'Low'",
                },
                weight: {
                  type: Type.INTEGER,
                  description:
                    "Default initial suggested relevance weight from 1 to 5.",
                },
                category: {
                  type: Type.STRING,
                  description:
                    "Category label like Financial, Emotional, Growth, Effort, health, etc.",
                },
              },
              required: ["id", "text", "impact", "weight", "category"],
            },
          },
        },
        required: ["optionName", "overallScore", "motto", "pros", "cons"],
      },
    },
    swot: {
      type: Type.OBJECT,
      properties: {
        strengths: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Strengths profile overall (2-3 bullets).",
        },
        weaknesses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Weaknesses profile overall (2-3 bullets).",
        },
        opportunities: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Opportunities profile overall (2-3 bullets).",
        },
        threats: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Threats/risks profile overall (2-3 bullets).",
        },
      },
      required: ["strengths", "weaknesses", "opportunities", "threats"],
    },
    comparisons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dimension: {
            type: Type.STRING,
            description:
              "The dimension/criterion (e.g., Joy, Effort, Growth, Financial, Long-term Value).",
          },
          description: {
            type: Type.STRING,
            description:
              "Brief description of why this dimension is crucial to the decision.",
          },
          ratings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                optionName: {
                  type: Type.STRING,
                  description: "The name of the option.",
                },
                score: {
                  type: Type.INTEGER,
                  description: "Rating score between 1 and 10.",
                },
                justification: {
                  type: Type.STRING,
                  description: "A 1-sentence explanation of this score.",
                },
              },
              required: ["optionName", "score", "justification"],
            },
          },
        },
        required: ["dimension", "description", "ratings"],
      },
    },
  },
  required: [
    "decision",
    "archetype",
    "options",
    "verdict",
    "optionAnalyses",
    "swot",
    "comparisons",
  ],
};

// Resilient content generator utility with fallback models and retry capability
async function generateContentWithFallback(
  ai: any,
  contents: string,
  config: any,
) {
  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    // Try the current model up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `Executing Tiebreaker analysis on model ${model} (Attempt ${attempt}/2)`,
        );
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
        const isTransient =
          msg.includes("503") ||
          msg.includes("unavailable") ||
          msg.includes("demand") ||
          msg.includes("429") ||
          msg.includes("rate limit") ||
          msg.includes("overloaded");

        if (!isTransient) {
          // Schema validation or bad request issues should fail early
          throw err;
        }

        console.warn(
          `Model ${model} failed with transient error ${err.message || err}. Retrying/falling back...`,
        );
        if (attempt < 2) {
          // Pause briefly (exponential ramp) before retry
          await new Promise((resolve) => setTimeout(resolve, attempt * 800));
        }
      }
    }
  }

  throw (
    lastError ||
    new Error("All active inference endpoints and retry fallbacks failed.")
  );
}

const parseJsonObjectFromText = (text: string) => {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Model returned text that could not be parsed as JSON.");
  }
};

const generateClaudeDecisionAnalysis = async (userPrompt: string) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const model = process.env.CLAUDE_DECISION_MODEL || "claude-sonnet-4-6";
  console.log(`Executing Tiebreaker analysis on Claude model ${model}`);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.CLAUDE_MAX_TOKENS || 10000),
      temperature: 0.45,
      system:
        "You are the analysis engine for a decision-making app. Return only one valid JSON object. Do not include markdown, commentary, code fences, or explanatory prose outside the JSON.",
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      json.error?.message ||
        json.message ||
        `Claude decision analysis failed: ${response.status}`,
    );
  }

  const textOutput = json.content
    ?.filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n")
    .trim();

  if (!textOutput) {
    throw new Error("Received empty response from Claude model.");
  }

  if (json.stop_reason === "max_tokens") {
    throw new Error(
      "Claude response was truncated before it finished valid JSON. Increase CLAUDE_MAX_TOKENS or reduce the response size.",
    );
  }

  return parseJsonObjectFromText(textOutput);
};

const generateGeminiDecisionAnalysis = async (userPrompt: string) => {
  const ai = await getGeminiClient();

  const response = await generateContentWithFallback(ai, userPrompt, {
    responseMimeType: "application/json",
    responseSchema: DECISION_RESPONSE_SCHEMA,
    temperature: 0.7,
  });

  const textOutput = response.text;
  if (!textOutput) {
    throw new Error("Received empty response from Gemini model.");
  }

  return JSON.parse(textOutput.trim());
};

const toDisplayText = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate =
      record.text ||
      record.title ||
      record.name ||
      record.summary ||
      record.description ||
      record.optionName;
    if (candidate) return toDisplayText(candidate, fallback);
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const toTextArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => toDisplayText(item)).filter(Boolean)
    : [];

const getImpactWeight = (impact: unknown) => {
  if (impact === "High") return 1.5;
  if (impact === "Low") return 0.6;
  return 1;
};

const deriveItemWeight = (item: any, index: number, type: "pro" | "con") => {
  const impact = item?.impact;
  const category = toDisplayText(item?.category).toLowerCase();
  let weight = impact === "High" ? 5 : impact === "Low" ? 2 : 3;

  if (index >= 2) weight -= 1;
  if (
    type === "con" &&
    /(financial|health|security|legal|time|stress|risk)/.test(category)
  )
    weight += 1;
  if (
    type === "pro" &&
    /(financial|growth|health|joy|career|long-term|value)/.test(category)
  )
    weight += 1;

  return Math.max(1, Math.min(5, weight));
};

const shouldDeriveWeights = (items: any[]) => {
  const weights = items
    .map((item) => Number(item?.weight))
    .filter((weight) => Number.isFinite(weight));
  return weights.length === 0 || new Set(weights).size === 1;
};

const deriveFallbackRating = (option: any, dimensionIndex: number) => {
  const base = Number.isFinite(Number(option?.overallScore))
    ? Math.round(Number(option.overallScore) / 10)
    : 6;
  const proPower = Array.isArray(option?.pros)
    ? option.pros.reduce(
        (total: number, pro: any) => total + getImpactWeight(pro?.impact),
        0,
      )
    : 0;
  const conPower = Array.isArray(option?.cons)
    ? option.cons.reduce(
        (total: number, con: any) => total + getImpactWeight(con?.impact),
        0,
      )
    : 0;
  const netSignal = proPower - conPower;
  const dimensionBias =
    dimensionIndex === 0
      ? netSignal * 0.45
      : dimensionIndex === 1
        ? -conPower * 0.35
        : proPower * 0.25;

  return Math.max(1, Math.min(10, Math.round(base + dimensionBias)));
};

const normalizeDecisionAnalysis = ({
  parsedJson,
  decision,
  normalizedOptions,
  archetype,
  analysisProvider,
}: {
  parsedJson: any;
  decision: string;
  normalizedOptions: string[];
  archetype: string;
  analysisProvider: string;
}) => {
  const safeOptions = normalizedOptions
    .map((option) => toDisplayText(option))
    .filter(Boolean);
  const fallbackOption = safeOptions[0] || "Option A";
  const safeVerdict =
    parsedJson?.verdict && typeof parsedJson.verdict === "object"
      ? parsedJson.verdict
      : {};
  const optionAnalyses = Array.isArray(parsedJson?.optionAnalyses)
    ? parsedJson.optionAnalyses
    : [];
  const normalizedOptionAnalyses = safeOptions.map((optionName, index) => {
    const existing =
      optionAnalyses.find((option: any) => {
        const label = toDisplayText(
          option?.optionName || option?.title || option?.name || option?.id,
        );
        return label === optionName;
      }) ||
      optionAnalyses[index] ||
      {};
    const rawPros = Array.isArray(existing.pros)
      ? existing.pros
      : Array.isArray(existing.swot?.strengths)
        ? existing.swot.strengths
        : [];
    const rawCons = Array.isArray(existing.cons)
      ? existing.cons
      : Array.isArray(existing.swot?.weaknesses)
        ? existing.swot.weaknesses
        : [];
    const pros = rawPros.length
      ? rawPros
      : [`${optionName} has enough upside to keep in consideration.`];
    const cons = rawCons.length
      ? rawCons
      : [`${optionName} still has uncertainty that should be managed.`];
    const deriveProWeights = shouldDeriveWeights(pros);
    const deriveConWeights = shouldDeriveWeights(cons);

    return {
      optionName: toDisplayText(
        existing.optionName || existing.title || existing.name || existing.id,
        optionName,
      ),
      overallScore: Number.isFinite(Number(existing.overallScore))
        ? Number(existing.overallScore)
        : 50,
      motto: toDisplayText(existing.motto, "Worth a grounded look"),
      pros: pros.map((pro: any, proIndex: number) => ({
        id: toDisplayText(pro?.id, `pro${proIndex + 1}`),
        text: toDisplayText(pro?.text ?? pro, "Potential upside to consider."),
        impact: ["High", "Medium", "Low"].includes(pro?.impact)
          ? pro.impact
          : "Medium",
        weight: deriveProWeights
          ? deriveItemWeight(pro, proIndex, "pro")
          : Number.isFinite(Number(pro?.weight))
            ? Math.max(1, Math.min(5, Number(pro.weight)))
            : deriveItemWeight(pro, proIndex, "pro"),
        category: toDisplayText(pro?.category, "General"),
      })),
      cons: cons.map((con: any, conIndex: number) => ({
        id: toDisplayText(con?.id, `con${conIndex + 1}`),
        text: toDisplayText(con?.text ?? con, "Potential downside to manage."),
        impact: ["High", "Medium", "Low"].includes(con?.impact)
          ? con.impact
          : "Medium",
        weight: deriveConWeights
          ? deriveItemWeight(con, conIndex, "con")
          : Number.isFinite(Number(con?.weight))
            ? Math.max(1, Math.min(5, Number(con.weight)))
            : deriveItemWeight(con, conIndex, "con"),
        category: toDisplayText(con?.category, "General"),
      })),
    };
  });

  const comparisons = Array.isArray(parsedJson?.comparisons)
    ? parsedJson.comparisons
    : [];
  const normalizedComparisons = comparisons
    .slice(0, 3)
    .map((comparison: any, index: number) => {
      const comparisonRatings = Array.isArray(comparison?.ratings)
        ? comparison.ratings
        : [];
      const numericScores = comparisonRatings
        .map((rating: any) => Number(rating?.score))
        .filter((score: number) => Number.isFinite(score));
      const isNeutralPlaceholder =
        numericScores.length >= safeOptions.length &&
        numericScores.every((score: number) => score === 5);

      return {
        dimension: toDisplayText(
          comparison?.dimension,
          ["Short-term fit", "Effort", "Long-term value"][index] ||
            "Decision fit",
        ),
        description: toDisplayText(
          comparison?.description,
          "How this factor changes the decision.",
        ),
        ratings: safeOptions.map((optionName) => {
          const optionAnalysis = normalizedOptionAnalyses.find(
            (option) => option.optionName === optionName,
          );
          const existing = comparisonRatings.find(
            (rating: any) => rating?.optionName === optionName,
          );
          return {
            optionName,
            score:
              !isNeutralPlaceholder && Number.isFinite(Number(existing?.score))
                ? Math.max(1, Math.min(10, Number(existing.score)))
                : deriveFallbackRating(optionAnalysis, index),
            justification: toDisplayText(
              existing?.justification,
              optionAnalysis
                ? `${optionName} scores this way based on its weighted upside/downside profile.`
                : "Needs more evidence before scoring strongly.",
            ),
          };
        }),
      };
    });

  while (normalizedComparisons.length < 3) {
    const index = normalizedComparisons.length;
    normalizedComparisons.push({
      dimension:
        ["Short-term fit", "Effort", "Long-term value"][index] ||
        "Decision fit",
      description:
        "Derived from the option's overall score and weighted pros/cons.",
      ratings: safeOptions.map((optionName) => ({
        optionName,
        score: deriveFallbackRating(
          normalizedOptionAnalyses.find(
            (option) => option.optionName === optionName,
          ),
          index,
        ),
        justification: `${optionName} is scored from its overall signal plus the balance of high-impact pros and cons.`,
      })),
    });
  }

  const safeSwot =
    parsedJson?.swot && typeof parsedJson.swot === "object"
      ? parsedJson.swot
      : {};

  return {
    decision: toDisplayText(parsedJson?.decision, decision),
    archetype: toDisplayText(parsedJson?.archetype, archetype),
    options: toTextArray(parsedJson?.options).length
      ? toTextArray(parsedJson.options)
      : safeOptions,
    verdict: {
      chosenOption: safeOptions.includes(safeVerdict.chosenOption)
        ? safeVerdict.chosenOption
        : fallbackOption,
      confidenceScore: Number.isFinite(Number(safeVerdict.confidenceScore))
        ? Math.max(0, Math.min(100, Number(safeVerdict.confidenceScore)))
        : 60,
      mainArgument: toDisplayText(
        safeVerdict.mainArgument,
        `${fallbackOption} currently has the clearest fit based on the available information.`,
      ),
      whatToWatchOutFor: toDisplayText(
        safeVerdict.whatToWatchOutFor,
        "Watch for missing evidence before making the final commitment.",
      ),
      actionableNextSteps: toTextArray(safeVerdict.actionableNextSteps).length
        ? toTextArray(safeVerdict.actionableNextSteps).slice(0, 3)
        : [
            "Clarify your top constraint.",
            "Run a small reality check.",
            "Revisit the weights after new evidence.",
          ],
    },
    optionAnalyses: normalizedOptionAnalyses,
    swot: {
      strengths: toTextArray(safeSwot.strengths),
      weaknesses: toTextArray(safeSwot.weaknesses),
      opportunities: toTextArray(safeSwot.opportunities),
      threats: toTextArray(safeSwot.threats),
    },
    comparisons: normalizedComparisons,
    analysisProvider,
  };
};

const buildLocalFallbackAnalysis = ({
  decision,
  normalizedOptions,
  archetype,
  personalSituation,
  providerError,
}: {
  decision: string;
  normalizedOptions: string[];
  archetype: string;
  personalSituation?: string;
  providerError?: string;
}) => {
  const safeOptions = normalizedOptions.length
    ? normalizedOptions
    : ["Option A", "Option B"];
  const profile =
    ARCHETYPE_PROFILES[archetype as keyof typeof ARCHETYPE_PROFILES] ||
    ARCHETYPE_PROFILES.rationalist;
  const chosenOption =
    archetype === "risk_minimizer"
      ? safeOptions[0]
      : safeOptions[Math.min(1, safeOptions.length - 1)];
  const dimensions =
    archetype === "bold_adventurer"
      ? ["Growth potential", "Regret prevention", "Momentum"]
      : archetype === "risk_minimizer"
        ? ["Downside protection", "Predictability", "Recovery options"]
        : archetype === "intuitive"
          ? ["Energy fit", "Values alignment", "Emotional sustainability"]
          : ["Expected value", "Execution friction", "Long-term payoff"];

  return {
    decision,
    archetype,
    options: safeOptions,
    personalSituation,
    verdict: {
      chosenOption,
      confidenceScore: 62,
      mainArgument: `${chosenOption} has the clearest signal under the ${profile.name} lens based on the information available. This is a fallback analysis because the AI provider did not return a usable structured response.`,
      whatToWatchOutFor:
        providerError ||
        "The main risk is acting before the most important unknowns are clarified.",
      actionableNextSteps: [
        "Name the one constraint that matters most.",
        `Run a small test of ${chosenOption} before fully committing.`,
        "Recheck the decision after new evidence arrives.",
      ],
    },
    optionAnalyses: safeOptions.map((optionName, index) => {
      const isChosen = optionName === chosenOption;
      return {
        optionName,
        overallScore: isChosen ? 68 : Math.max(45, 62 - index * 4),
        motto:
          archetype === "bold_adventurer"
            ? "Move toward meaningful growth"
            : "Choose with grounded clarity",
        pros: [
          {
            id: "pro1",
            text: isChosen
              ? "This option appears to create the strongest forward signal for the selected decision style."
              : "This option remains viable and may fit some constraints well.",
            impact: isChosen ? "High" : "Medium",
            weight: isChosen ? 4 : 3,
            category: archetype === "bold_adventurer" ? "Growth" : "Fit",
          },
          {
            id: "pro2",
            text: personalSituation
              ? "It can be pressure-tested against the personal context you provided."
              : "It can be evaluated with a small next step before committing.",
            impact: "Medium",
            weight: 3,
            category: "Validation",
          },
        ],
        cons: [
          {
            id: "con1",
            text: "The evidence is incomplete because the AI provider response failed during structured analysis.",
            impact: "Medium",
            weight: 3,
            category: "Uncertainty",
          },
          {
            id: "con2",
            text: "A wrong assumption about your priorities could change the recommendation.",
            impact: "Medium",
            weight: 3,
            category: "Assumptions",
          },
        ],
      };
    }),
    swot: {
      strengths: [
        "The decision has clear alternatives to compare.",
        "The selected reasoning style gives the evaluation a consistent lens.",
      ],
      weaknesses: [
        "The fallback result is less nuanced than a full model-generated analysis.",
        "Some personal tradeoffs may need manual adjustment with the sliders.",
      ],
      opportunities: [
        "A small experiment can quickly reveal which option feels real.",
        "Clarifying one top constraint can sharpen the recommendation.",
      ],
      threats: [
        "Provider instability may hide useful nuance.",
        "Delayed action can preserve ambiguity longer than necessary.",
      ],
    },
    comparisons: dimensions.map((dimension, dimensionIndex) => ({
      dimension,
      description: `How ${dimension.toLowerCase()} changes the strength of each option.`,
      ratings: safeOptions.map((optionName, optionIndex) => ({
        optionName,
        score:
          optionName === chosenOption
            ? Math.max(7, 8 - dimensionIndex)
            : Math.max(4, 6 - optionIndex - dimensionIndex),
        justification:
          optionName === chosenOption
            ? `${optionName} currently has the stronger signal on ${dimension.toLowerCase()}.`
            : `${optionName} may still work, but its signal is less clear on ${dimension.toLowerCase()}.`,
      })),
    })),
    analysisProvider: "local-fallback",
  };
};

const escapeSvgText = (value: unknown) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const truncateText = (value: unknown, maxLength: number) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
};

const buildFallbackDecisionSvg = ({
  decision,
  leadingOption,
  chosenOption,
  confidenceScore,
  scores,
}: {
  decision: string;
  leadingOption?: string;
  chosenOption: string;
  confidenceScore?: number;
  scores?: any[];
}) => {
  const winner = leadingOption || chosenOption;
  const safeDecision = escapeSvgText(truncateText(decision, 78));
  const safeWinner = escapeSvgText(truncateText(winner, 58));
  const confidence = Math.max(0, Math.min(100, Number(confidenceScore || 0)));
  const normalizedScores =
    Array.isArray(scores) && scores.length > 0
      ? scores.slice(0, 4)
      : [{ optionName: winner, score: confidence || 72 }];

  const bars = normalizedScores
    .map((score, index) => {
      const value = Math.max(8, Math.min(100, Number(score.score || 50)));
      const y = 448 + index * 44;
      const isWinner = score.optionName === winner;
      return `
      <text x="80" y="${y - 10}" fill="${isWinner ? "#d1fae5" : "#cbd5e1"}" font-family="Inter, Arial" font-size="18" font-weight="700">${escapeSvgText(truncateText(score.optionName, 32))}</text>
      <rect x="80" y="${y}" width="520" height="18" rx="9" fill="#1f2937"/>
      <rect x="80" y="${y}" width="${Math.round(value * 5.2)}" height="18" rx="9" fill="${isWinner ? "url(#winnerBar)" : "#64748b"}"/>
      <text x="630" y="${y + 15}" fill="${isWinner ? "#34d399" : "#94a3b8"}" font-family="Inter, Arial" font-size="16" font-weight="800">${value}%</text>
    `;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="52%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#064e3b"/>
        </linearGradient>
        <linearGradient id="winnerBar" x1="0" x2="1">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="55%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#818cf8"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#34d399" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <circle cx="975" cy="250" r="250" fill="url(#glow)" opacity="0.6"/>
      <circle cx="1080" cy="540" r="190" fill="#38bdf8" opacity="0.09"/>
      <path d="M740 565 C860 445, 890 315, 1028 228" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round" opacity="0.95"/>
      <path d="M740 565 C840 530, 910 535, 1046 590" fill="none" stroke="#64748b" stroke-width="14" stroke-linecap="round" opacity="0.55"/>
      <circle cx="1040" cy="220" r="74" fill="#ecfdf5" filter="url(#softShadow)"/>
      <path d="M1002 220 l25 25 l54 -66" fill="none" stroke="#059669" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="1046" cy="590" r="48" fill="#1f2937" stroke="#64748b" stroke-width="5"/>
      <text x="80" y="105" fill="#34d399" font-family="Inter, Arial" font-size="18" font-weight="800" letter-spacing="4">DECISION VISUAL</text>
      <text x="80" y="170" fill="#ffffff" font-family="Inter, Arial" font-size="48" font-weight="900">${safeWinner}</text>
      <text x="80" y="224" fill="#cbd5e1" font-family="Inter, Arial" font-size="24" font-weight="600">${safeDecision}</text>
      <rect x="80" y="280" width="210" height="94" rx="24" fill="#ffffff" opacity="0.08" stroke="#ffffff" stroke-opacity="0.12"/>
      <text x="108" y="318" fill="#94a3b8" font-family="Inter, Arial" font-size="15" font-weight="800" letter-spacing="2">CONFIDENCE</text>
      <text x="108" y="356" fill="#34d399" font-family="Inter, Arial" font-size="38" font-weight="900">${confidence || 72}%</text>
      <text x="80" y="410" fill="#94a3b8" font-family="Inter, Arial" font-size="16" font-weight="800" letter-spacing="2">WEIGHTED OPTION STRENGTH</text>
      ${bars}
      <text x="80" y="675" fill="#64748b" font-family="Inter, Arial" font-size="14" font-weight="600">Local fallback visual. Configure a working DashScope/OpenAI image provider for AI-generated artwork.</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const fetchImageAsDataUrl = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
};

const generateOpenAIDecisionImage = async (prompt: string) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const configuredModels = (process.env.OPENAI_IMAGE_MODEL || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const modelCandidates = [
    ...new Set([...configuredModels, "gpt-image-2", "gpt-image-1"]),
  ];
  const errors: string[] = [];

  for (const model of modelCandidates) {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: process.env.OPENAI_IMAGE_SIZE || "1536x1024",
          quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
        }),
      },
    );

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        json.error?.message ||
        json.message ||
        `OpenAI image request failed: ${response.status}`;
      errors.push(`${model}: ${message}`);
      continue;
    }

    const image = json.data?.[0];
    if (image?.b64_json) {
      return {
        dataUrl: `data:image/png;base64,${image.b64_json}`,
        model,
      };
    }

    if (image?.url) {
      return {
        dataUrl: await fetchImageAsDataUrl(image.url),
        model,
      };
    }

    errors.push(`${model}: OpenAI returned no image data.`);
  }

  throw new Error(`No OpenAI image model worked. ${errors.join(" | ")}`);
};

const getAlibabaVideoEndpoint = () => {
  if (process.env.ALIBABA_VIDEO_ENDPOINT) {
    return process.env.ALIBABA_VIDEO_ENDPOINT.replace(/\/$/, "");
  }

  if (!process.env.ALIBABA_VIDEO_BASE_URL) {
    return null;
  }

  return `${process.env.ALIBABA_VIDEO_BASE_URL.replace(/\/$/, "")}/api/v1/services/aigc/video-generation/video-synthesis`;
};

const getTaskBaseUrlFromEndpoint = (endpoint: string) => {
  const explicitBaseUrl =
    process.env.ALIBABA_VIDEO_TASK_BASE_URL ||
    process.env.ALIBABA_VIDEO_BASE_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  const url = new URL(endpoint);
  return url.origin;
};

const extractVideoUrl = (output: any) => {
  return (
    output?.video_url ||
    output?.url ||
    output?.video?.url ||
    output?.results?.[0]?.url ||
    output?.results?.[0]?.video_url ||
    output?.videos?.[0]?.url ||
    output?.video_urls?.[0]
  );
};

const generateAlibabaDecisionVideo = async (prompt: string) => {
  const endpoint = getAlibabaVideoEndpoint();
  if (!endpoint) {
    throw new Error(
      "ALIBABA_VIDEO_ENDPOINT or ALIBABA_VIDEO_BASE_URL is not configured.",
    );
  }

  const apiKey = process.env.ALIBABA_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("ALIBABA_API_KEY or DASHSCOPE_API_KEY is not configured.");
  }

  const model = process.env.ALIBABA_VIDEO_MODEL || "happyhorse-1.0-t2v";
  const createResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input: {
        prompt,
      },
      parameters: {
        resolution: process.env.ALIBABA_VIDEO_RESOLUTION || "720P",
        ratio: process.env.ALIBABA_VIDEO_RATIO || "16:9",
        duration: Number(process.env.ALIBABA_VIDEO_DURATION || 5),
      },
    }),
  });

  const createJson: any = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    throw new Error(
      createJson.message ||
        createJson.error?.message ||
        `Alibaba video task creation failed: ${createResponse.status}`,
    );
  }

  const taskId = createJson.output?.task_id || createJson.task_id;
  if (!taskId) {
    throw new Error("Alibaba video API did not return a task id.");
  }

  const taskBaseUrl = getTaskBaseUrlFromEndpoint(endpoint);
  for (let attempt = 0; attempt < 72; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const taskResponse = await fetch(`${taskBaseUrl}/api/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const taskJson: any = await taskResponse.json().catch(() => ({}));
    if (!taskResponse.ok) {
      throw new Error(
        taskJson.message ||
          taskJson.error?.message ||
          `Alibaba video task polling failed: ${taskResponse.status}`,
      );
    }

    const status = taskJson.output?.task_status || taskJson.task_status;
    if (status === "SUCCEEDED") {
      const mediaUrl = extractVideoUrl(taskJson.output);
      if (!mediaUrl) {
        throw new Error(
          "Alibaba video task succeeded but returned no video URL.",
        );
      }

      return {
        mediaUrl,
        mimeType: "video/mp4",
        model,
      };
    }

    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      throw new Error(
        taskJson.output?.message || `Alibaba video task ${status}.`,
      );
    }
  }

  throw new Error(`${model}: Alibaba video task timed out.`);
};

const generateAlibabaCompatibleDecisionImage = async (prompt: string) => {
  const baseUrl = process.env.ALIBABA_COMPATIBLE_BASE_URL;
  if (!baseUrl) {
    throw new Error("ALIBABA_COMPATIBLE_BASE_URL is not configured.");
  }

  const apiKey = process.env.ALIBABA_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("ALIBABA_API_KEY or DASHSCOPE_API_KEY is not configured.");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const model =
    process.env.ALIBABA_IMAGE_MODEL ||
    process.env.DASHSCOPE_IMAGE_MODEL ||
    "qwen-image";
  const response = await fetch(`${normalizedBaseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: process.env.ALIBABA_IMAGE_SIZE || "1536x1024",
      response_format: "b64_json",
    }),
  });

  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      json.error?.message ||
        json.message ||
        `Alibaba compatible image request failed: ${response.status}`,
    );
  }

  const image = json.data?.[0];
  if (image?.b64_json) {
    return {
      dataUrl: `data:image/png;base64,${image.b64_json}`,
      model,
    };
  }

  if (image?.url) {
    return {
      dataUrl: await fetchImageAsDataUrl(image.url),
      model,
    };
  }

  throw new Error("Alibaba compatible image API returned no image data.");
};

const generateDashScopeDecisionImage = async (prompt: string) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured.");
  }

  const baseUrl =
    process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com";
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const configuredModels = (process.env.DASHSCOPE_IMAGE_MODEL || "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => !/qwen|vl/i.test(model))
    .filter(Boolean);
  const modelCandidates = [
    ...new Set([
      ...configuredModels,
      "wan2.2-t2i-flash",
      "wan2.2-t2i-plus",
      "wanx-v1",
    ]),
  ];
  const errors: string[] = [];

  for (const model of modelCandidates) {
    const createResponse = await fetch(
      `${normalizedBaseUrl}/api/v1/services/aigc/text2image/image-synthesis`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model,
          input: {
            prompt,
          },
          parameters: {
            size: process.env.DASHSCOPE_IMAGE_SIZE || "1280*720",
            n: 1,
          },
        }),
      },
    );

    const createJson: any = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      const message =
        createJson.message ||
        createJson.error?.message ||
        `DashScope task creation failed: ${createResponse.status}`;
      errors.push(`${model}: ${message}`);
      continue;
    }

    const taskId = createJson.output?.task_id;
    if (!taskId) {
      errors.push(`${model}: DashScope did not return a task id.`);
      continue;
    }

    for (let attempt = 0; attempt < 36; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const taskResponse = await fetch(
        `${normalizedBaseUrl}/api/v1/tasks/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      const taskJson: any = await taskResponse.json().catch(() => ({}));
      if (!taskResponse.ok) {
        throw new Error(
          taskJson.message ||
            taskJson.error?.message ||
            `DashScope task polling failed: ${taskResponse.status}`,
        );
      }

      const status = taskJson.output?.task_status;
      if (status === "SUCCEEDED") {
        const imageUrl = taskJson.output?.results?.[0]?.url;
        if (!imageUrl) {
          throw new Error(
            "DashScope task succeeded but returned no image URL.",
          );
        }
        return {
          dataUrl: await fetchImageAsDataUrl(imageUrl),
          model,
        };
      }

      if (
        status === "FAILED" ||
        status === "CANCELED" ||
        status === "UNKNOWN"
      ) {
        throw new Error(
          taskJson.output?.message || `DashScope image task ${status}.`,
        );
      }
    }

    throw new Error(`${model}: DashScope image task timed out.`);
  }

  throw new Error(`No DashScope image model worked. ${errors.join(" | ")}`);
};

// API Route for decision analysis
app.post("/api/analyze-decision", async (req, res) => {
  try {
    const { decision, options, archetype, personalSituation } = req.body;

    if (!decision) {
      res.status(400).json({ error: "No decision prompt provided" });
      return;
    }

    const normalizedOptions =
      options && options.length >= 2
        ? options.filter((o: string) => o.trim() !== "")
        : ["Option A: Do it", "Option B: Do not do it"]; // Default binary

    const profile =
      ARCHETYPE_PROFILES[archetype as keyof typeof ARCHETYPE_PROFILES] ||
      ARCHETYPE_PROFILES.rationalist;

    // Build the prompt for the decision model
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

      IMPORTANT SCORING RULES:
      - Do not use neutral placeholder scores like 5/10 unless the option is genuinely neutral on that dimension.
      - The ratings must express a real recommendation signal. At least one option should clearly lead on each comparison dimension.
      - Use the full 1-10 range where warranted: 8-10 for strong fit, 6-7 for moderate fit, 3-4 for weak fit, 1-2 for poor fit.
      - If two options are close, still show the slight difference, e.g. 7 vs 6, and explain why.
      - The verdict confidenceScore and each option overallScore must align with the comparison ratings.
      - Each rating justification must be concrete and refer to the user's stated situation.
      - For every pro and con, set weight from 1 to 5 based on importance to THIS user, not generic importance.
      - Do not assign the same weight to every factor. Use 5 only for decisive factors, 4 for important factors, 3 for moderate factors, 1-2 for minor factors.
      - High impact usually maps to weight 4-5, Medium to 3-4, Low to 1-2, but adjust for the user's personal situation.

      Required JSON shape:
      {
        "decision": string,
        "archetype": string,
        "options": string[],
        "verdict": {
          "chosenOption": string,
          "confidenceScore": number,
          "mainArgument": string,
          "whatToWatchOutFor": string,
          "actionableNextSteps": string[]
        },
        "optionAnalyses": [
          {
            "optionName": string,
            "overallScore": number,
            "motto": string,
            "pros": [{"id": string, "text": string, "impact": "High"|"Medium"|"Low", "weight": number, "category": string}],
            "cons": [{"id": string, "text": string, "impact": "High"|"Medium"|"Low", "weight": number, "category": string}]
          }
        ],
        "swot": {"strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[]},
        "comparisons": [
          {
            "dimension": string,
            "description": string,
            "ratings": [{"optionName": string, "score": number, "justification": string}]
          }
        ]
      }
    `;

    let parsedJson: any;
    let analysisProvider = "gemini";
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        parsedJson = await generateClaudeDecisionAnalysis(userPrompt);
        analysisProvider = process.env.CLAUDE_DECISION_MODEL || "claude";
      } catch (err: any) {
        console.warn(`Claude decision analysis failed: ${err.message || err}`);
        if (
          process.env.ENABLE_GEMINI_FALLBACK !== "true" ||
          !process.env.GEMINI_API_KEY
        ) {
          throw err;
        }
        parsedJson = await generateGeminiDecisionAnalysis(userPrompt);
        analysisProvider = "gemini-fallback";
      }
    } else {
      parsedJson = await generateGeminiDecisionAnalysis(userPrompt);
    }

    const normalizedAnalysis = normalizeDecisionAnalysis({
      parsedJson,
      decision,
      normalizedOptions,
      archetype,
      analysisProvider,
    });
    res.json(normalizedAnalysis);
  } catch (error: any) {
    console.error("Decision-making analysis error:", error);
    const normalizedOptions =
      Array.isArray(req.body?.options) && req.body.options.length >= 2
        ? req.body.options
            .map((option: unknown) => toDisplayText(option).trim())
            .filter(Boolean)
        : ["Option A: Do it", "Option B: Do not do it"];
    const fallbackAnalysis = buildLocalFallbackAnalysis({
      decision: toDisplayText(req.body?.decision, "Untitled decision"),
      normalizedOptions,
      archetype: toDisplayText(req.body?.archetype, "rationalist"),
      personalSituation: toDisplayText(req.body?.personalSituation),
      providerError:
        error.message ||
        "The AI provider failed before returning a usable structured response.",
    });
    res.json(fallbackAnalysis);
  }
});

app.post("/api/generate-decision-image", async (req, res) => {
  try {
    const {
      decision,
      chosenOption,
      leadingOption,
      confidenceScore,
      mainArgument,
      whatToWatchOutFor,
      personalSituation,
      scores,
    } = req.body;

    if (!decision || !chosenOption) {
      res
        .status(400)
        .json({
          error:
            "Decision and chosen option are required for illustration generation.",
        });
      return;
    }

    const recommendedOption = leadingOption || chosenOption;

    const prompt = `
      Create a polished editorial decision illustration for a modern AI decision-making app.
      The image must communicate ONE clear recommendation, not a comparison.

      Decision: "${decision}"
      Recommended option to visualize: "${recommendedOption}"
      Confidence: ${confidenceScore ?? "unknown"}%
      Reasoning: ${mainArgument || "No reasoning provided."}
      Main caution: ${whatToWatchOutFor || "No caution provided."}
      Personal context: ${personalSituation || "No personal context provided."}

      Visual direction:
      - Show only the recommended outcome as the central subject.
      - Do not show two paths, two doors, split screens, scales, versus layouts, or ambiguous alternatives.
      - Make the scene feel like the user has already chosen "${recommendedOption}" and is moving forward with clarity.
      - Use one confident focal point, warm directional light, and a calm sense of progress.
      - Use premium product illustration style: cinematic lighting, clean composition, soft depth, modern colors.
      - No readable text, no logos, no watermarks, no charts, no interface mockups, no comparison symbols.
      - Aspect ratio should feel like a wide card image for a dashboard.
    `;

    let lastError: any = null;
    const providerErrors: string[] = [];

    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("Generating decision visual with OpenAI image API");
        const openAIImage = await generateOpenAIDecisionImage(prompt);
        res.json({
          dataUrl: openAIImage.dataUrl,
          mimeType: "image/png",
          prompt,
          source: "openai",
          model: openAIImage.model,
        });
        return;
      } catch (err: any) {
        lastError = err;
        providerErrors.push(`OpenAI: ${err.message || err}`);
        console.warn(`OpenAI decision visual failed: ${err.message || err}`);
      }
    }

    if (
      (process.env.ALIBABA_VIDEO_ENDPOINT ||
        process.env.ALIBABA_VIDEO_BASE_URL) &&
      process.env.ENABLE_ALIBABA_VISUALS === "true"
    ) {
      try {
        console.log("Generating decision visual with Alibaba video API");
        const video = await generateAlibabaDecisionVideo(prompt);
        res.json({
          mediaUrl: video.mediaUrl,
          mimeType: video.mimeType,
          prompt,
          source: "alibaba-video",
          model: video.model,
        });
        return;
      } catch (err: any) {
        lastError = err;
        providerErrors.push(`Alibaba video: ${err.message || err}`);
        console.warn(`Alibaba decision video failed: ${err.message || err}`);

        if (process.env.ENABLE_IMAGE_FALLBACKS !== "true") {
          const fallbackDataUrl = buildFallbackDecisionSvg({
            decision,
            leadingOption,
            chosenOption,
            confidenceScore,
            scores,
          });
          res.json({
            dataUrl: fallbackDataUrl,
            mimeType: "image/svg+xml",
            prompt,
            source: "local-fallback",
            warning: err.message || "Alibaba video generation failed.",
            providerErrors,
          });
          return;
        }
      }
    }

    if (
      !process.env.ENABLE_IMAGE_FALLBACKS ||
      process.env.ENABLE_IMAGE_FALLBACKS !== "true"
    ) {
      const fallbackDataUrl = buildFallbackDecisionSvg({
        decision,
        leadingOption,
        chosenOption,
        confidenceScore,
        scores,
      });
      res.json({
        dataUrl: fallbackDataUrl,
        mimeType: "image/svg+xml",
        prompt,
        source: "local-fallback",
        warning:
          lastError?.message ||
          "Set OPENAI_API_KEY to enable OpenAI image generation.",
        providerErrors,
      });
      return;
    }

    try {
      console.log(
        "Generating decision illustration with Alibaba compatible image API",
      );
      const compatibleImage =
        await generateAlibabaCompatibleDecisionImage(prompt);
      res.json({
        dataUrl: compatibleImage.dataUrl,
        mimeType: "image/png",
        prompt,
        source: "alibaba-compatible",
        model: compatibleImage.model,
      });
      return;
    } catch (err: any) {
      lastError = err;
      providerErrors.push(`Alibaba compatible: ${err.message || err}`);
      console.warn(
        `Alibaba compatible decision illustration failed: ${err.message || err}`,
      );
    }

    try {
      console.log("Generating decision illustration with DashScope");
      const dashScopeImage = await generateDashScopeDecisionImage(prompt);
      res.json({
        dataUrl: dashScopeImage.dataUrl,
        mimeType: "image/png",
        prompt,
        source: "dashscope",
        model: dashScopeImage.model,
      });
      return;
    } catch (err: any) {
      lastError = err;
      providerErrors.push(`DashScope: ${err.message || err}`);
      console.warn(
        `DashScope decision illustration failed: ${err.message || err}`,
      );
    }

    if (
      (process.env.ALIBABA_COMPATIBLE_BASE_URL ||
        process.env.DASHSCOPE_API_KEY) &&
      process.env.ENABLE_GOOGLE_IMAGE_FALLBACK !== "true"
    ) {
      const fallbackDataUrl = buildFallbackDecisionSvg({
        decision,
        leadingOption,
        chosenOption,
        confidenceScore,
        scores,
      });
      res.json({
        dataUrl: fallbackDataUrl,
        mimeType: "image/svg+xml",
        prompt,
        source: "local-fallback",
        warning: lastError?.message || "DashScope image generation failed.",
        providerErrors,
      });
      return;
    }

    const ai = await getGeminiClient();
    const imageModels = [
      "imagen-4.0-fast-generate-001",
      "imagen-4.0-generate-001",
      "imagen-4.0-ultra-generate-001",
    ];

    for (const model of imageModels) {
      try {
        console.log(`Generating decision illustration with ${model}`);
        const response = await ai.models.generateImages({
          model,
          prompt,
          config: {
            numberOfImages: 1,
            includeRaiReason: true,
            outputMimeType: "image/png",
            aspectRatio: "16:9",
          },
        });

        const generatedImage = response.generatedImages?.[0];
        if (generatedImage?.image?.imageBytes) {
          const mimeType = generatedImage.image.mimeType || "image/png";
          res.json({
            dataUrl: `data:${mimeType};base64,${generatedImage.image.imageBytes}`,
            mimeType,
            prompt,
          });
          return;
        }

        throw new Error(
          generatedImage?.raiFilteredReason ||
            "Image model returned no image output.",
        );
      } catch (err: any) {
        lastError = err;
        providerErrors.push(`${model}: ${err.message || err}`);
        console.warn(
          `Decision illustration model ${model} failed: ${err.message || err}`,
        );
      }
    }

    const fallbackDataUrl = buildFallbackDecisionSvg({
      decision,
      leadingOption,
      chosenOption,
      confidenceScore,
      scores,
    });
    res.json({
      dataUrl: fallbackDataUrl,
      mimeType: "image/svg+xml",
      prompt,
      source: "local-fallback",
      warning:
        lastError?.message ||
        "AI image generation is unavailable for this API key or plan.",
      providerErrors,
    });
  } catch (error: any) {
    console.error("Gemini decision illustration error:", error);
    res.status(500).json({
      error:
        error.message ||
        "An error occurred while generating the decision illustration.",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
