import PizZip from "pizzip";
import fs from "fs";

function validate() {
  const buffer = fs.readFileSync("test_canvass_output.docx");
  const zip = new PizZip(buffer);
  const docXml = zip.files["word/document.xml"].asText();

  // Simple tag balancer check
  const tags: string[] = [];
  const tagRegex = /<\/?([a-zA-Z0-9:]+)(?:\s+[^>]*)?\/?>/g;
  let match;
  let errorCount = 0;

  console.log("Analyzing XML tags balance...");

  // We can parse using a stack
  const stack: { tag: string; index: number }[] = [];
  let index = 0;
  
  while ((match = tagRegex.exec(docXml)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    
    const isSelfClosing = fullTag.endsWith("/>") || ["w:br", "w:proofErr"].includes(tagName);
    const isClosing = fullTag.startsWith("</");
    
    if (isSelfClosing) {
      // Do nothing
    } else if (isClosing) {
      if (stack.length === 0) {
        console.error(`Error: Found closing tag </${tagName}> but stack was empty at index ${tagRegex.lastIndex}`);
        errorCount++;
      } else {
        const last = stack.pop();
        if (last && last.tag !== tagName) {
          console.error(`Mismatched tag: Opened <${last.tag}> but closed </${tagName}> near index ${tagRegex.lastIndex}`);
          console.error(`Surrounding context: ...${docXml.substring(tagRegex.lastIndex - 100, tagRegex.lastIndex + 100)}...`);
          errorCount++;
        }
      }
    } else {
      stack.push({ tag: tagName, index: tagRegex.lastIndex });
    }
  }

  if (stack.length > 0) {
    console.error(`Error: Unclosed tags remaining in stack:`, stack.map(s => s.tag).join(", "));
    errorCount += stack.length;
  }

  if (errorCount === 0) {
    console.log("XML structure is perfectly balanced and valid!");
  } else {
    console.log(`XML validation failed with ${errorCount} errors.`);
  }
}

validate();
