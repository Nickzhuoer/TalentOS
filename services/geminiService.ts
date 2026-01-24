import { GoogleGenAI, Type } from "@google/genai";
import { extractRawText } from "mammoth";
import { Candidate, CandidateStatus } from '../types';

/**
 * Converts a File object to a Base64 string suitable for Gemini API.
 */
const fileToPart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const extractTextFromDocx = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await extractRawText({ arrayBuffer });
        return result.value;
    } catch (e) {
        console.error("Mammoth parsing error:", e);
        throw new Error("Failed to extract text from DOCX file.");
    }
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Full name" },
    gender: { type: Type.STRING, description: "Gender" },
    age: { type: Type.STRING, description: "Age" },
    education: { type: Type.STRING, description: "Highest degree" },
    yearsOfExperience: { type: Type.STRING, description: "Calculated total experience in format 'X年X个月'. If 0 years, just 'X个月'." },
    positionExperience: { type: Type.STRING, description: "Summary list of all positions and their duration/dates" },
    currentCompany: { type: Type.STRING, description: "The most recent company name only" },
    recentRole: { type: Type.STRING, description: "The most recent job title" },
    location: { type: Type.STRING, description: "City/Area" },
    factoryExperience: { type: Type.STRING, description: "Factory specific experience" },
    contact: { type: Type.STRING, description: "Phone/Email" },
    aiPersona: { type: Type.STRING, description: "A summary of the candidate's professional persona" },
    aiTags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5 short phrases summarizing the candidate" }
  },
  required: ["name", "recentRole", "yearsOfExperience"],
};

const getDateString = () => new Date().toISOString().split('T')[0];

const SYSTEM_INSTRUCTION = `
  You are an expert HR assistant. Analyze the resume.
  
  CRITICAL RULES FOR EXPERIENCE CALCULATION:
  1. **Definition**: 1 Year = 12 Months.
  2. **Logic**: Sum the duration of all "Work Experience" and "Internship Experience".
  3. **Exclusions**: STRICTLY EXCLUDE "Research Experience", "Academic Projects", "School Activities", or "Volunteer Work".
  4. **Date Parsing**: 
     - "2018-2019" counts as 12 months.
     - "2025.03 - Present" (Current Date: ${getDateString()}) counts as the months from 2025.03 to Today.
     - Example: If Candidate worked 2018-2019 (12 mos) AND 2025.03-Present (10 mos), Total = 1 Year 10 Months.
  5. **Format**: STRICTLY "X年X个月". If 0 years, "X个月". If 0 months, "X年".

  CRITICAL RULES FOR EXTRACTION:
  1. **Missing Data**: If a field is not found, try to ESTIMATE it from context and append "(估测)" to the value. If cannot be estimated, return an empty string "". NEVER return "null", "Unknown", "未知", or "N/A".
  2. 'currentCompany': Extract ONLY the name of the *most recent* company.
  3. 'recentRole': Extract the title of the *most recent* work experience.
  4. 'positionExperience': List all roles and their dates.
  5. 'aiPersona': Write a summary portrait in Simplified Chinese (max 100 chars).
  6. 'aiTags': Exactly 5 short keywords/phrases (total max 50 chars).
  7. Translate all output to Simplified Chinese.
`;

export const parseResumeWithGemini = async (
  file: File,
  apiKey: string
): Promise<Partial<Candidate>> => {
  const ai = new GoogleGenAI({ apiKey });
  let contentPart;

  // List of MIME types supported directly by Gemini (PDF + Images)
  const supportedDirectMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

  if (supportedDirectMimeTypes.includes(file.type)) {
      contentPart = await fileToPart(file);
  } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.name.endsWith('.docx')
  ) {
      // Handle .docx files by extracting text
      const extractedText = await extractTextFromDocx(file);
      contentPart = { text: `Resume Content from ${file.name}:\n${extractedText}` };
  } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      // Handle plain text files
      const text = await file.text();
      contentPart = { text: `Resume Content from ${file.name}:\n${text}` };
  } else {
      throw new Error(`Unsupported file type: ${file.type}. Please use PDF, DOCX, JPG, PNG, or TXT.`);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [contentPart, { text: "Analyze this resume." }],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    // Enhance error message for the UI
    if (error instanceof Error && error.message.includes("400")) {
         throw new Error("Gemini API Error: Bad Request. The file content might be too large or corrupted.");
    }
    throw error;
  }
};

export const parseTextWithGemini = async (
  inputString: string,
  apiKey: string
): Promise<Partial<Candidate>> => {
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ text: `Analyze this candidate information: \n${inputString}` }],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("Failed to parse text with AI.");
  }
};