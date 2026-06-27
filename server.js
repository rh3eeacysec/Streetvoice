import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.post('/api/generate-slogan', async (req, res) => {
  // Added location parameter extraction from the user resource payload
  const { problemContext, tone, location } = req.body;
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
  const instructionPrompt = `You are an elite public administrative communication analyst assistant.
Draft a formal, respectful, highly objective, and constructive headline text phrase suitable for a public notice, civic awareness banner, or neighborhood bulletin regarding this matter: "${problemContext}".
The linguistic layout style must carefully conform to this framing archetype: "${tone}".
The phrasing must be entirely respectful to municipal authorities and focus on constructive civic improvement or public cooperation.
Do not include any aggressive words, exclamation overloads, sarcasm, or emojis. Keep it under 10 clear words total. Return strictly the unquoted string text, nothing else.`;

  // Dynamic Rule-Based Local SLA Risk Sentinel evaluation
  // Calculates a live risk severity multiplier based on the textual data resource provided by the user
  let riskScore = 25; // Base baseline structural risk (Low)
  let hazardLevel = "LOW";
  
  const targetAssessmentString = `${problemContext} ${location || ''}`.toUpperCase();
  
  // Risk escalation triggers based on public safety indicators
  if (targetAssessmentString.includes("WATER") || targetAssessmentString.includes("BLOCK")) {
    riskScore += 25; // Medium escalation
    hazardLevel = "MEDIUM";
  }
  if (targetAssessmentString.includes("BROKEN") || targetAssessmentString.includes("खतरनाक") || targetAssessmentString.includes("टूटा")) {
    riskScore += 45; // High escalation
    hazardLevel = "HIGH";
  }
  if (targetAssessmentString.includes("DANGER") || targetAssessmentString.includes("EXPOSED") || targetAssessmentString.includes("LIVE WIRE")) {
    riskScore = 95; // Critical emergency safety threat ceiling
    hazardLevel = "CRITICAL";
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: instructionPrompt
          }]
        }]
      })
    });
    
    const data = await response.json();
    const generatedSlogan = data.candidates[0].content.parts[0].text.trim();
    
    // Returns both the slogan text asset AND the live telemetry values to update your client-side Risk Map layout!
    res.json({ 
      slogan: generatedSlogan,
      telemetry: {
        calculatedRisk: riskScore, // Pass this directly to your map data layers or radius metrics
        hazardLevel: hazardLevel,
        evaluatedTimestamp: new Date().toISOString()
      }
    });
    
  } catch (err) {
    res.status(500).json({ 
      slogan: "Public notice request under administrative review. Please check back shortly.",
      telemetry: { calculatedRisk: 10, hazardLevel: "PENDING" }
    });
  }
});

/* ==========================================================================
   GEMINI VISION — REAL IMAGE TRIAGE
   Used by dashboard.html's "AI Quick Triage" upload card.
   Sends the photo (as base64) straight to Gemini and returns real classification.
   ========================================================================== */
app.post('/api/analyze-image', async (req, res) => {
  const { imageBase64, mimeType, description } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "No image provided." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `You are the Triage Agent for StreetVoice, a civic issue reporting platform in India.
You are shown a citizen-submitted photo of a public infrastructure problem.${description ? ` The citizen also wrote this note: "${description}"` : ""}

Look carefully at the image and classify the civic issue. Respond with ONLY a raw JSON object (no markdown fences, no extra text) in exactly this shape:
{
  "category": "<one of: Pothole, Road Damage, Broken Streetlight, Garbage Overflow, Water Leakage, Blocked Drain, Damaged Footpath, Open Manhole, Traffic Signal Issue, Public Safety Hazard, Illegal Dumping, Public Toilet Issue, Park Maintenance Issue, Other>",
  "severity": "<one of: LOW, MEDIUM, HIGH, CRITICAL>",
  "severityScore": <integer 1-100>,
  "suggestedDepartment": "<short department name, e.g. 'Roads & Public Works Department'>",
  "summary": "<one objective sentence describing exactly what is visible in the image>",
  "urgent": <true or false>
}
If the image does not clearly show a civic infrastructure issue, set category to "Other" and explain why in summary.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
            { text: prompt }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Gemini Vision returned no usable text:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini Vision returned no result.", raw: data });
    }

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Could not parse Gemini Vision JSON, raw text was:", rawText);
      analysis = {
        category: "Other",
        severity: "MEDIUM",
        severityScore: 50,
        suggestedDepartment: "General Civic Department",
        summary: rawText.slice(0, 200),
        urgent: false
      };
    }

    res.json({ analysis });

  } catch (err) {
    console.error("Gemini Vision request failed:", err);
    res.status(500).json({ error: "Gemini Vision request failed. Is your GEMINI_API_KEY set in .env?" });
  }
});

/* ==========================================================================
   GEMINI — AUTO-GENERATE INCIDENT TITLE FROM CATEGORY
   Used by report.html: when a citizen picks a category (and has optionally
   started typing a description/location), Gemini drafts a clean header title.
   ========================================================================== */
app.post('/api/generate-title', async (req, res) => {
  const { category, description, location } = req.body;

  if (!category) {
    return res.status(400).json({ error: "No category provided." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `You are the Triage Agent for StreetVoice, a civic issue reporting platform in India.
A citizen is filing a report under the category: "${category}".
${description ? `They have written this description so far: "${description}".` : "They haven't written a description yet."}
${location ? `Reported location: "${location}".` : ""}

Write ONE short, clear, professional incident header title for this report (max 8 words). It should read like a real civic complaint headline — specific and objective, not generic. Do not use quotes, emojis, or markdown. Return ONLY the title text, nothing else.

Examples of the style wanted:
- "Deep pothole cluster outside school gate"
- "Streetlight outage on Linking Road approach"
- "Overflowing garbage bin near market junction"`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const generatedTitle = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedTitle) {
      console.error("Gemini title generation returned no text:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini returned no title." });
    }

    // Strip stray quote marks Gemini sometimes adds anyway
    const cleanTitle = generatedTitle.replace(/^["']|["']$/g, '');

    res.json({ title: cleanTitle });

  } catch (err) {
    console.error("Gemini title generation failed:", err);
    res.status(500).json({ error: "Gemini title generation failed. Is GEMINI_API_KEY set in .env?" });
  }
});

/* ==========================================================================
   GEMINI — REAL MULTI-AGENT PIPELINE
   Used by agents.html. One shared endpoint, 6 distinct agent personas/prompts.
   Each agent gets the SAME citizen input but reasons about it differently,
   and returns its own real, distinct Gemini output (not a canned string).
   ========================================================================== */
const AGENT_PERSONAS = {
  "1": {
    name: "Linguistic Parser",
    instruction: `You are the Linguistic Parser agent for StreetVoice. You receive a raw citizen complaint (possibly mixed Hindi/English/slang, possibly messy). 
Output, in under 40 words: the cleaned-up civic-English version of the complaint, then on a new line "Category: X | Urgency: Y" where X is the issue category and Y is LOW/MEDIUM/HIGH.
Do not add commentary, markdown, or extra text — just those two lines.`
  },
  "2": {
    name: "Vision Validator",
    instruction: `You are the Vision Validator agent for StreetVoice. You don't have an actual photo here — you're auditing whether the citizen's WRITTEN report contains enough descriptive/evidentiary detail for a department to act on without a site visit.
In under 35 words: state whether the description is sufficiently detailed, and name ONE specific missing detail if it's lacking (e.g. exact size, time of day, photo angle). If it's already sufficient, say so plainly.`
  },
  "3": {
    name: "Area Scanner",
    instruction: `You are the Area Scanner agent for StreetVoice, responsible for duplicate/spam suppression via spatial clustering.
You will be told how many existing reports in the same category currently exist nearby (within ~500m, based on shared location keywords). Using that real count, in under 30 words state whether this looks like a duplicate cluster worth merging, or a fresh standalone issue, and recommend an action (merge / keep separate / escalate due to repeat reports).`
  },
  "4": {
    name: "Dept Linker",
    instruction: `You are the Dept Linker agent for StreetVoice. Given a civic complaint, in under 25 words name the single most appropriate Indian municipal department/authority to route this to, and a one-line reason why.`
  },
  "5": {
    name: "Credit Allocator",
    instruction: `You are the Credit Allocator agent for StreetVoice, responsible for calculating gamified StreetCredits rewards (a points system, NOT real money).
Given a civic complaint, output a fair StreetCredits value between 15 and 50 based on how detailed/severe it is, then a one-line reason. Format exactly as: "Award: <number> StreetCredits — <reason>". Under 25 words total.`
  },
  "6": {
    name: "SLA Sentinel",
    instruction: `You are the SLA Sentinel agent for StreetVoice, responsible for setting realistic resolution timelines and escalation policy.
Given a civic complaint, in under 30 words state a realistic resolution SLA in days for an Indian municipal body to fix this, and what should happen if that SLA is breached (e.g. auto-escalate to a senior officer).`
  }
};

app.post('/api/run-agent', async (req, res) => {
  const { agentId, inputText, extraContext } = req.body;
  const persona = AGENT_PERSONAS[agentId];

  if (!persona) {
    return res.status(400).json({ error: "Unknown agentId. Must be 1-6." });
  }
  if (!inputText || !inputText.trim()) {
    return res.status(400).json({ error: "No input text provided for the agent to analyze." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `${persona.instruction}

Citizen report: "${inputText}"
${extraContext ? `Additional real context: ${extraContext}` : ""}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!output) {
      console.error(`Agent ${agentId} (${persona.name}) returned no text:`, JSON.stringify(data));
      return res.status(500).json({ error: `${persona.name} returned no result.` });
    }

    res.json({ agentName: persona.name, output });

  } catch (err) {
    console.error(`Agent ${agentId} (${persona.name}) request failed:`, err);
    res.status(500).json({ error: `${persona.name} request failed. Is GEMINI_API_KEY set in .env?` });
  }
});

/* ==========================================================================
   GEMINI — DRAFT FORMAL COMPLAINT EMAIL
   Used by report.html after the Dept Linker agent names the real department.
   Generates an actual subject + body, not a hardcoded template.
   ========================================================================== */
app.post('/api/draft-email', async (req, res) => {
  const { category, location, desc, department, ticketId } = req.body;

  if (!category || !desc) {
    return res.status(400).json({ error: "Missing category or description." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `You are drafting a formal civic complaint email on behalf of a citizen, to be sent to an Indian municipal authority.

Details:
- Issue category: ${category}
- Location: ${location || "Not specified"}
- Description: ${desc}
- Responsible department (already determined): ${department || "General Civic Department"}
- Reference ticket ID: ${ticketId || "N/A"}

Write a short, respectful, formal complaint email. Return ONLY a raw JSON object (no markdown fences) in exactly this shape:
{
  "subject": "<concise formal subject line, include the ticket ID>",
  "body": "<formal email body, 80-150 words, addressed to 'Respected Sir/Madam', mentioning the issue, location, and requesting timely action, signed 'A Concerned Citizen, via StreetVoice'>"
}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Email draft generation returned no text:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini returned no email draft." });
    }

    let draft;
    try {
      draft = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Could not parse email draft JSON, raw text was:", rawText);
      draft = {
        subject: `Civic Issue Report [${ticketId || ''}] — ${category}`,
        body: rawText.slice(0, 500)
      };
    }

    res.json(draft);

  } catch (err) {
    console.error("Email draft generation failed:", err);
    res.status(500).json({ error: "Email draft generation failed. Is GEMINI_API_KEY set in .env?" });
  }
});

/* ==========================================================================
   GEMINI — REAL AWARENESS POSTER GENERATION
   One call: classifies severity, picks a color palette grounded in real
   color psychology (not random), and writes punchy poster copy.
   Used by report.html (auto-fires after submission) and studio.html (manual).
   ========================================================================== */
app.post('/api/generate-poster', async (req, res) => {
  const { category, location, desc, tone } = req.body;

  if (!category || !desc) {
    return res.status(400).json({ error: "Missing category or description." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `You are the Studio Agent for StreetVoice, a civic awareness poster designer. You apply real color psychology principles when choosing poster colors:
- Red (#dc2626 / #ef4444): danger, urgency, immediate physical safety risk
- Orange (#ea580c / #f97316): warning, caution, moderate urgency
- Amber/Yellow (#d97706 / #f59e0b): attention, caution, "notice this"
- Blue/Teal (#0284c7 / #0891b2): calm, trust, informational — fits water issues, infrastructure that's serious but not immediately dangerous
- Green (#16a34a / #22c55e): environmental, cleanliness, parks, "this should be fixed for community wellbeing"

Issue details:
- Category: ${category}
- Location: ${location || "Not specified"}
- Description: ${desc}
${tone ? `- Desired framing/tone: ${tone}` : ""}

Step 1: Classify severity as LOW, MEDIUM, HIGH, or CRITICAL based on real risk to public safety.
Step 2: Pick a primary + secondary hex color pair that matches that severity AND category using the psychology rules above.
Step 3: Pick ONE single emoji icon that visually represents this issue category.
Step 4: Write a punchy poster headline (under 12 words, no quotes, objective and attention-grabbing, NOT aggressive or insulting toward any authority).
Step 5: Write one supporting sentence (under 20 words) that reinforces civic urgency or community impact.
Step 6: Write a short campaign hashtag (no spaces, starts with #).

Return ONLY a raw JSON object (no markdown fences) in exactly this shape:
{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "primaryColor": "#rrggbb",
  "secondaryColor": "#rrggbb",
  "icon": "<single emoji>",
  "headline": "<headline text>",
  "subtext": "<supporting sentence>",
  "hashtag": "#example"
}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Poster generation returned no text:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini returned no poster data." });
    }

    let poster;
    try {
      poster = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Could not parse poster JSON, raw text was:", rawText);
      poster = null;
    }

    // Validate / fall back to a safe default palette if Gemini's output is malformed
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (!poster || !hexPattern.test(poster.primaryColor || "")) {
      poster = {
        severity: poster?.severity || "MEDIUM",
        primaryColor: "#ea580c",
        secondaryColor: "#fb923c",
        icon: poster?.icon || "⚠️",
        headline: poster?.headline || `${category} reported — community action needed`,
        subtext: poster?.subtext || "Verified by StreetVoice citizens. Help us get this resolved.",
        hashtag: poster?.hashtag || "#StreetVoice"
      };
    }

    res.json(poster);

  } catch (err) {
    console.error("Poster generation failed:", err);
    res.status(500).json({ error: "Poster generation failed. Is GEMINI_API_KEY set in .env?" });
  }
});

/* ==========================================================================
   GEMINI — VOICE COMPLAINT PARSER (Linguistic Parser, structured for forms)
   Used by report.html's voice input button. Takes the raw browser speech-to-text
   transcript (often messy mixed Hindi/English/Hinglish) and extracts clean,
   structured fields ready to auto-fill the report form.
   This is a JSON-structured sibling to the free-text Linguistic Parser persona
   (agentId '1' in /api/run-agent) — same job, shaped for direct form binding.
   ========================================================================== */
app.post('/api/parse-voice-complaint', async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "No transcript provided." });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `You are the Linguistic Parser agent for StreetVoice, a civic issue reporting platform in India.
A citizen spoke a complaint out loud (likely English, Hindi, Marathi, or mixed "Hinglish"). Browser speech-to-text transcribed it, so the raw transcript below may be messy, phonetic, or mixed-language.

Raw transcript: "${transcript}"

Extract the civic complaint into clean structured fields. Translate/clean into civic-English for the description, but PRESERVE any specific place names, landmarks, or street names exactly as said (don't translate proper nouns).

Return ONLY a raw JSON object (no markdown fences, no extra text) in exactly this shape:
{
  "title": "<short civic incident headline, max 8 words>",
  "category": "<one of: Pothole, Road Damage, Broken Streetlight, Garbage Overflow, Water Leakage, Blocked Drain, Damaged Footpath, Open Manhole, Traffic Signal Issue, Public Safety Hazard, Illegal Dumping, Public Toilet Issue, Park Maintenance Issue, Other>",
  "location": "<any place/landmark/street name mentioned, or empty string if none was said>",
  "description": "<clean civic-English description of the issue, 1-2 sentences>",
  "detectedLanguage": "<your best guess: English, Hindi, Marathi, or Hinglish>",
  "confidence": "<HIGH, MEDIUM, or LOW — how confident you are this transcript was a clear, parseable civic complaint>"
}
If the transcript doesn't clearly describe a civic issue, set category to "Other", confidence to "LOW", and put your best-effort guess in description.`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Voice parser returned no text:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini returned no parsing result." });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Could not parse voice complaint JSON, raw text was:", rawText);
      parsed = {
        title: "Voice-reported civic issue",
        category: "Other",
        location: "",
        description: transcript,
        detectedLanguage: "Unknown",
        confidence: "LOW"
      };
    }

    res.json(parsed);

  } catch (err) {
    console.error("Voice complaint parsing failed:", err);
    res.status(500).json({ error: "Voice parsing failed. Is GEMINI_API_KEY set in .env?" });
  }
});

app.listen(3000, () => console.log('Server active on port 3000'));