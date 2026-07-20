/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import * as xlsx from "xlsx";

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } else {
    console.warn("GEMINI_API_KEY environment variable is not defined. Gemini features will fallback to local regex.");
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI client:", error);
}

export interface ExtractionResult {
  caNumber: string;
  confidence: number;
  method: string;
  page: number | null;
  source: string;
}

/**
 * Normalizes text per Step 3 requirement:
 * Convert text to uppercase. Normalize whitespace. Remove duplicated spaces.
 * Normalize tabs. Normalize line breaks. Convert multiple delimiters into standard spaces.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toUpperCase()
    // Replace tabs, line breaks, carriage returns, and multiple spaces with a single space
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts CA number using layered local regex parsers as a fast local method or fallback (Step 4 & Priority 5)
 */
export function localExtractCANumber(text: string, methodPrefix = "Local Parser"): ExtractionResult | null {
  const normalized = normalizeText(text);

  // Layered regex parser matching labels: COMPLIANCE NUMBER, CONTROL NUMBER, CONTROL NO, CA NO, CA
  // Supports optional spaces around dashes/separators inside the capture group, e.g., 07 - 1326 - 26
  // Limit separators to at most 2 to prevent capturing trailing revisions or page numbers (e.g. 07-1326-27 instead of 07-1326-27-22-21)
  const regexPatterns = [
    // 1. COMPLIANCE NUMBER or CONTROL NUMBER labels
    /(?:COMPLIANCE\s*NUMBER|CONTROL\s*NUMBER)\s*[:#\-_=\s]*\s*([A-Z0-9]+(?:\s*[-_]\s*[A-Z0-9]+){1,2})\b/gi,
    // 2. CONTROL NO or CA NO labels
    /(?:CONTROL\s*NO\.?|CA\s*NO\.?)\s*[:#\-_=\s]*\s*([A-Z0-9]+(?:\s*[-_]\s*[A-Z0-9]+){1,2})\b/gi,
    // 3. CA Label followed by separators and numbers
    /\bCA\s*[:#\-_=]\s*([A-Z0-9]+(?:\s*[-_]\s*[A-Z0-9]+){1,2})\b/gi,
    // 4. Loose space separator: CA 07-1326-26 or CA 2026-00481
    /\bCA\s+([A-Z0-9]+(?:\s*[-_]\s*[A-Z0-9]+){1,2})\b/gi,
  ];

  const candidates: { caNumber: string; confidence: number; label: string }[] = [];

  for (let i = 0; i < regexPatterns.length; i++) {
    const pattern = regexPatterns[i];
    let match;
    pattern.lastIndex = 0; // Reset state
    
    while ((match = pattern.exec(normalized)) !== null) {
      let rawValue = match[1]?.trim();
      const fullMatch = match[0];

      if (!rawValue) continue;

      // Clean up any optional spaces around dashes/separators
      rawValue = rawValue.replace(/\s+/g, "");

      // Filter out generic text values
      const invalidWords = ["DATE", "TEL", "FAX", "PHONE", "EMAIL", "STATUS", "PAGE", "USER", "ROLE", "TRUE", "FALSE", "NAME", "COMPLIANCE", "CONTROL", "NUMBER"];
      if (invalidWords.includes(rawValue) || rawValue.length < 3 || /^[A-Z\s]+$/.test(rawValue)) {
        continue;
      }

      // Base confidence depends on specificity of the matched pattern
      let confidence = 80;
      if (fullMatch.includes("COMPLIANCE") || fullMatch.includes("CONTROL")) {
        confidence = 92;
      } else if (fullMatch.includes("CA NO") || fullMatch.includes("CA-") || fullMatch.includes("CA_")) {
        confidence = 90;
      }

      // Format-based confidence boost
      if (/^\d+-\d+-\d+$/.test(rawValue)) {
        confidence += 5; // e.g., 07-1326-26 -> hits 95%!
      } else if (/^\d+-\d+$/.test(rawValue)) {
        confidence += 3; // e.g., 2026-00481 -> hits 93%!
      }

      candidates.push({
        caNumber: rawValue,
        confidence: Math.min(confidence, 98), // High accuracy local exact matches can auto-save directly
        label: fullMatch,
      });
    }
  }

  if (candidates.length > 0) {
    // Sort descending by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);
    return {
      caNumber: candidates[0].caNumber,
      confidence: candidates[0].confidence,
      method: `${methodPrefix} Text Extraction`,
      page: 1,
      source: "Page Text",
    };
  }

  return null;
}

/**
 * Parser for DOCX documents using PizZip (Step 2 & Priority 2)
 * Respects paragraph structures and merges text runs cleanly to avoid word truncation and formatting splits.
 */
export function extractTextFromDocx(base64Data: string): string {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const zip = new PizZip(buffer);
    
    let textParts: string[] = [];

    const parseXmlToText = (xml: string): string => {
      if (!xml) return "";
      
      const paragraphMatches = xml.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g) || [];
      const paragraphsText = paragraphMatches.map((pXml) => {
        const tMatches = pXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
        return tMatches
          .map((t) => t.replace(/<[^>]+>/g, ""))
          .join(""); // Join text runs within a paragraph without spaces to preserve words
      });

      let res = paragraphsText.join("\n");
      
      // Fallback: if no paragraphs matched or result is empty, match all <w:t> tags directly
      if (!res.trim()) {
        const tMatches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
        res = tMatches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
      }
      return res;
    };

    // Main document text
    const docXml = zip.file("word/document.xml")?.asText() || "";
    if (docXml) {
      textParts.push(parseXmlToText(docXml));
    }

    // Headers and footers
    const files = zip.files;
    for (const fileName in files) {
      if (fileName.startsWith("word/header") || fileName.startsWith("word/footer")) {
        const xml = files[fileName].asText();
        textParts.push(parseXmlToText(xml));
      }
    }

    return textParts.join("\n\n");
  } catch (error) {
    console.error("Error extracting text from DOCX:", error);
    return "";
  }
}

/**
 * Parser for Excel documents using SheetJS (Step 2 & Priority 3)
 */
export function extractTextFromXlsx(base64Data: string): string {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    let text = "";

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      // Convert sheet cells to plain text
      const sheetText = xlsx.utils.sheet_to_txt(worksheet);
      text += `\n[Sheet: ${sheetName}]\n${sheetText}`;
    });

    return text;
  } catch (error) {
    console.error("Error extracting text from XLSX:", error);
    return "";
  }
}

/**
 * Intelligent extraction using server-side Gemini API (Step 5)
 */
async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  fileType: string,
  textContext?: string
): Promise<ExtractionResult | null> {
  if (!ai) return null;

  const prompt = `You are a high-precision Compliance Document Parsing Engine.
Task: Locate and extract the CA Number (Compliance Authority/Certificate number) or Control Number in this ${fileType} document.
Supported labels to recognize: "CA", "CA NO", "CA NO.", "CONTROL NO", "CONTROL NUMBER", "COMPLIANCE NUMBER".
Examples of formats you must support:
- CA No. 07-1326-26
- CA NO 07-1326-26
- CA NO: 07-1326-26
- CA-07-1326-26
- CA 07-1326-26
- CA#07-1326-26
- CA_07_1326_26

CRITICAL Guardrails:
1. Only extract the specific alphanumeric sequence representing the CA or Control number.
2. DO NOT append unrelated trailing text, page numbers, revision codes, dates, year ranges (like 22-21, 2022-2021), or other numbers from nearby cells, lines, or headers.
3. If the document says "CA No. 07-1326-26", the extracted number MUST be exactly "07-1326-26". Do not add anything else.
4. Normalize the extracted CA Number to uppercase and remove spaces from it (keep dashes and underscores).
5. Determine a confidence score (0 to 100). If you are completely certain, return a score of 95-100.
6. Indicate the page number (1-based) where the CA Number was found.
7. Detail the location source (e.g. "Header", "Footer", "Cover Page", "Page 1 Body").

Return the result as a strictly compliant JSON object matching the requested schema.`;

  try {
    const contents: any[] = [];

    if (textContext) {
      // For text-based documents (DOCX, XLSX), pass the text context directly
      contents.push({
        text: `Below is the complete text extracted from the ${fileType} document:\n\n${textContext}\n\n${prompt}`,
      });
    } else {
      // For multimodal documents (PDF, JPG, JPEG, PNG), pass the file content directly
      contents.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
      contents.push({
        text: prompt,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caNumber: {
              type: Type.STRING,
              description: "The extracted CA Number value (uppercase), or 'NOT DETECTED' if not found.",
            },
            confidence: {
              type: Type.INTEGER,
              description: "Confidence score from 0 to 100.",
            },
            method: {
              type: Type.STRING,
              description: "Specific method, e.g. 'PDF Text Extraction', 'OCR Engine', 'DOCX Parser', 'Excel Cell Analysis'.",
            },
            page: {
              type: Type.INTEGER,
              description: "The 1-based page number where it was found, or null if unknown.",
            },
            source: {
              type: Type.STRING,
              description: "Contextual location inside the document, e.g. 'Header', 'Footer', 'Label match'.",
            },
          },
          required: ["caNumber", "confidence", "method", "page", "source"],
        },
      },
    });

    const text = response.text?.trim() || "";
    const parsed = JSON.parse(text);
    
    if (parsed && parsed.caNumber && parsed.caNumber !== "NOT DETECTED") {
      return {
        caNumber: parsed.caNumber.toUpperCase(),
        confidence: Number(parsed.confidence) || 0,
        method: parsed.method || `${fileType} AI Analyzer`,
        page: parsed.page || 1,
        source: parsed.source || "Document Text",
      };
    }
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
  }

  return null;
}

/**
 * Fallback to Filename Regex (Priority 5)
 */
export function extractFromFilename(fileName: string): ExtractionResult {
  // Try to find a robust CA pattern in the filename: e.g. CA-07-1326-26 or CA-2026-00481 or CA07-1326-26 or CA_07_1326_26
  // Match CA followed by spaces/separators, then a sequence of digits separated by dashes, underscores, or spaces
  const regex = /CA\s*[-_:#\s]*\s*([A-Z0-9]+(?:\s*[-_]\s*[A-Z0-9]+)+|[A-Z0-9]{4,})/i;
  const match = fileName.match(regex);
  if (match && match[1]) {
    const rawValue = match[1].trim().toUpperCase().replace(/\s+/g, "");
    return {
      caNumber: rawValue,
      confidence: 65, // Filename extraction is medium confidence
      method: "Filename Regex",
      page: null,
      source: "Filename Match",
    };
  }
  
  // Backwards compatibility loose match
  const looseRegex = /(CA[-_]?\d+)/i;
  const looseMatch = fileName.match(looseRegex);
  if (looseMatch && looseMatch[0]) {
    return {
      caNumber: looseMatch[0].toUpperCase(),
      confidence: 45,
      method: "Filename Regex",
      page: null,
      source: "Filename Match",
    };
  }

  return {
    caNumber: "NOT DETECTED",
    confidence: 0,
    method: "None",
    page: null,
    source: "N/A",
  };
}

/**
 * Main Enterprise Extraction Pipeline Entry Point
 */
export async function runExtractionPipeline(
  fileName: string,
  fileType: string,
  base64DataWithPrefix: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  // Clean prefix out of base64 data
  const base64Data = base64DataWithPrefix.includes(",")
    ? base64DataWithPrefix.split(",")[1]
    : base64DataWithPrefix;

  const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
  let mimeType = "application/octet-stream";
  
  if (fileExt === "pdf") mimeType = "application/pdf";
  else if (fileExt === "docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  else if (fileExt === "xlsx") mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  else if (fileExt === "jpg" || fileExt === "jpeg") mimeType = "image/jpeg";
  else if (fileExt === "png") mimeType = "image/png";

  try {
    // Priority 1: PDF Text Extraction (Handles both embedded text and automatic OCR)
    if (fileExt === "pdf") {
      // Try to extract using multimodal Gemini parser
      const geminiResult = await extractWithGemini(base64Data, mimeType, "PDF");
      if (geminiResult && geminiResult.confidence > 0) {
        return geminiResult;
      }
    }

    // Priority 2: DOCX Text Extraction
    if (fileExt === "docx") {
      const docxText = extractTextFromDocx(base64Data);
      if (docxText.trim()) {
        // Try local regex first
        const localRes = localExtractCANumber(docxText, "DOCX");
        if (localRes && localRes.confidence >= 80) {
          return localRes;
        }
        // Fallback to Gemini with text context for intelligent validation
        const geminiResult = await extractWithGemini(base64Data, mimeType, "DOCX", docxText);
        if (geminiResult && geminiResult.confidence > 0) {
          return geminiResult;
        }
        // Fallback to whatever local parser found if any
        if (localRes) return localRes;
      }
    }

    // Priority 3: Excel Cell Values
    if (fileExt === "xlsx") {
      const xlsxText = extractTextFromXlsx(base64Data);
      if (xlsxText.trim()) {
        // Try local regex first
        const localRes = localExtractCANumber(xlsxText, "Excel");
        if (localRes && localRes.confidence >= 80) {
          return localRes;
        }
        // Fallback to Gemini with cell values context
        const geminiResult = await extractWithGemini(base64Data, mimeType, "Excel", xlsxText);
        if (geminiResult && geminiResult.confidence > 0) {
          return geminiResult;
        }
        // Fallback to whatever local parser found if any
        if (localRes) return localRes;
      }
    }

    // Priority 4: Images (JPG, JPEG, PNG)
    if (["jpg", "jpeg", "png"].includes(fileExt)) {
      const geminiResult = await extractWithGemini(base64Data, mimeType, fileExt.toUpperCase());
      if (geminiResult && geminiResult.confidence > 0) {
        return geminiResult;
      }
    }

    // Priority 5: Fallback to Filename Regex if everything else failed
    const filenameRes = extractFromFilename(fileName);
    if (filenameRes.confidence > 0) {
      return filenameRes;
    }
  } catch (error) {
    console.error("Pipeline failure for file:", fileName, error);
  }

  // Graceful fallback on complete extraction failure
  return {
    caNumber: "NOT DETECTED",
    confidence: 0,
    method: "Failed Extraction",
    page: null,
    source: "N/A",
  };
}
