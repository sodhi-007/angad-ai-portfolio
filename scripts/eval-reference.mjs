import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readPdfText, validateDocument } from "../lib/document-extractor.mjs";

const defaultPdf = fileURLToPath(new URL("../Angad_Singh_Sodhi_Professional_Profile_Public.pdf", import.meta.url));

// Each entry pairs an atomic reference fact with a literal anchor on its PDF page.
const cimaAgent = [3, "Shipped a bilingual (EN/FR) RAG agent", "Angad shipped a bilingual RAG agent at CIMA+."];
const cimaUsage = [9, "700+ employees", "The CIMA+ assistant reached 700+ employees."];
const cimaImpact = [9, "Manual document search time cut 60%", "The CIMA+ assistant cut manual document search time by 60%."];
const cimaPages = [9, "10,000+ pages", "Angad built retrieval over 10,000+ pages at CIMA+."];
const docFacts = {
  contact: [
    [1, "angadfzr123@gmail.com", "Angad's email is angadfzr123@gmail.com."],
    [1, "linkedin.com/in/angad-sodhi", "Angad's LinkedIn profile is linkedin.com/in/angad-sodhi."]
  ],
  kubernetes: [[4, "Containers and orchestration: Docker, Kubernetes", "Kubernetes was part of the CIMA+ platform's container and orchestration stack."]],
  "cima-work": [cimaAgent, cimaUsage, cimaImpact, cimaPages],
  "follow-up": [
    [4, "Fine-tuned DistilBERT as an intent/query router", "Angad fine-tuned DistilBERT as a query router at CIMA+."],
    [4, "Served via FastAPI on Azure Container Apps", "The CIMA+ router ran through FastAPI on Azure Container Apps."],
    [4, "ClearML managed experiments", "ClearML managed the CIMA+ router's MLOps lifecycle."]
  ],
  "french-cima": [cimaAgent, cimaUsage, cimaPages],
  "who-is-angad": [
    [1, "Applied AI Engineer", "Angad is an applied AI engineer."],
    [2, "Master of Engineering (MEng), Software Engineering (Co-op)", "Angad is completing an MEng in Software Engineering at Concordia University."]
  ],
  "jio-work": [
    [5, "Deputy Manager, Cybersecurity, Reliance Jio Infocomm", "Angad was a Deputy Manager in Cybersecurity at Reliance Jio."],
    [5, "vulnerability management for 40,000+ servers", "Angad led vulnerability management for 40,000+ servers at Jio."],
    [5, "100,000+ devices at 99%+ compliance", "Angad ran quarterly assessments on 100,000+ devices at 99%+ compliance."]
  ],
  "ibm-work": [
    [6, "5 independent services", "Angad built a five-service e-commerce platform at IBM."],
    [6, "Jenkins CI/CD pipeline with Maven", "Angad automated IBM service builds and deployment with Jenkins and Maven."]
  ],
  projects: [
    [7, "University Information Hub (Django)", "The University Information Hub used Django."],
    [7, "Quantitative Portfolio Manager", "Angad built a Quantitative Portfolio Manager in Python and Jupyter."],
    [7, "Blockchain Crowdfunding Platform", "Angad built a blockchain crowdfunding platform using Solidity smart contracts."]
  ],
  chromadb: [[4, "ChromaDB (vectors)", "ChromaDB stored the CIMA+ document vectors."]],
  "what-is-cima": [[3, "CIMA+ is a large Canadian engineering consultancy", "CIMA+ is a Canadian engineering consultancy."]],
  impressive: [cimaAgent, cimaUsage, cimaImpact],
  "angad-python": [
    [7, "in Python / Jupyter Notebook", "Angad built the Quantitative Portfolio Manager in Python and Jupyter."],
    [7, "University Information Hub (Django)", "Angad built a University Information Hub using Django."]
  ],
  "angad-langchain": [[4, "LangChain for retrieval chains", "Angad used LangChain for retrieval chains at CIMA+."]]
};

const normalize = (text) => text.normalize("NFKC").replace(/\s+/g, " ").trim();

export async function loadPdfReference(path = process.env.EVAL_REFERENCE_PDF || defaultPdf) {
  const pdf = await readFile(path);
  const name = basename(path);
  if (validateDocument(pdf, name).extension !== ".pdf") throw new Error("EVAL_REFERENCE_PDF must name a PDF.");
  const { pages } = await readPdfText(pdf);
  const pageText = new Map(pages.map(({ num, text }) => [num, normalize(text)]));
  const factsByCase = Object.fromEntries(Object.entries(docFacts).map(([caseName, facts]) => [
    caseName,
    facts.map(([page, anchor, text]) => {
      if (!pageText.get(page)?.includes(anchor)) {
        throw new Error(`Reference anchor for "${caseName}" missing on PDF page ${page}: ${anchor}`);
      }
      return { page, text, excerpt: anchor };
    })
  ]));
  return { name, sha256: createHash("sha256").update(pdf).digest("hex"), pageCount: pages.length, factsByCase };
}
