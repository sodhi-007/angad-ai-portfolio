const topicAnswers = [
  {
    id: "overview",
    keywords: ["experience", "career", "years", "background", "profile", "overview", "parcours", "annees"],
    answer: "Based on the résumé date ranges, Angad has approximately 2 years and 6 months of documented professional experience: 22 months at Reliance Jio, 5 months at CIMA+, and 3 months at IBM. That combines nearly two years of full-time enterprise cybersecurity work with 8 months of AI and software-engineering internships."
  },
  {
    id: "cima",
    keywords: ["cima", "cima+", "rag", "retrieval", "agent", "agents", "document", "documents", "llm", "sales", "bilingual", "bilingue", "internship", "stage"],
    answer: "At CIMA+, Angad shipped a bilingual English/French RAG agent used by 700+ employees, cutting manual document search time by 60%. He built retrieval over 10,000+ engineering-document pages with MinerU, OpenAI embeddings, ChromaDB, and Azure Container Apps Jobs; 95% of queries retrieved in under three seconds. He also built evaluation and routing components and deployed a multi-agent Open WebUI/LiteLLM platform for 50+ concurrent users."
  },
  {
    id: "jio",
    keywords: ["jio", "reliance", "security", "securite", "cybersecurity", "cybersecurite", "vulnerability", "vulnerabilite", "tenable", "qualys", "compliance", "cis", "server", "servers", "serveur", "serveurs"],
    answer: "As Deputy Manager, Cybersecurity at Reliance Jio, Angad led vulnerability management for 40,000+ servers, mitigated 10,000+ exploitable vulnerabilities, and ran assessments across 100,000+ devices at 99%+ compliance. He authored 30+ CIS-based policies and reduced zero-day exposure by 70% with virtual patching."
  },
  {
    id: "ibm",
    keywords: ["ibm", "java", "spring", "microservice", "microservices", "ecommerce", "commerce"],
    answer: "During his IBM internship, Angad built a five-service e-commerce platform with Java, Spring Boot, and Spring MVC. He containerized it with Docker, automated CI/CD with Jenkins and Maven, and used Spring Cloud, MySQL, MongoDB, REST APIs, and Spring Security."
  },
  {
    id: "projects",
    keywords: ["project", "projects", "projet", "projets", "blockchain", "chaine", "fake", "product", "produit", "university", "universite", "django", "portfolio", "portefeuille", "momentum", "crowdfunding", "financement", "solidity"],
    answer: "Angad's academic projects include a blockchain fake-product identification system, a Django university information hub, a Python quantitative-momentum portfolio manager, and a Solidity-based crowdfunding platform. Ask about any one of them for a concise breakdown."
  },
  {
    id: "skills",
    keywords: ["skill", "skills", "competence", "competences", "stack", "pile", "technology", "technologies", "python", "fastapi", "azure", "mlops", "cloud", "infonuagique", "docker", "datadog", "clearml"],
    answer: "Angad's core AI stack includes Python, FastAPI, RAG, agentic systems, LLM-as-judge evaluation, OpenAI embeddings, ChromaDB, LiteLLM, Open WebUI, and DistilBERT. For production, he works with Azure Container Apps, AWS, Docker, Kubernetes, ClearML, Redis, Datadog, Jenkins, and Linux. He also brings Java/Spring and enterprise security experience."
  },
  {
    id: "education",
    keywords: ["education", "formation", "degree", "diplome", "university", "universite", "concordia", "meng", "master", "maitrise", "bachelor", "upes", "graduate", "graduating", "cgpa"],
    answer: "Angad is completing an MEng in Software Engineering (Co-op) at Concordia University, expected December 2026, with a 3.47/4.30 CGPA. He also holds a BTech in Computer Science from UPES, focused on cloud computing and virtualization, with a 7.87/10 CGPA."
  },
  {
    id: "certifications",
    keywords: ["certification", "certifications", "certified", "certifie", "ceh", "az-900", "az900", "language", "languages", "langue", "langues", "french", "francais"],
    answer: "Angad holds the Certified Ethical Hacker (CEH) and Microsoft Azure Fundamentals (AZ-900) certifications. He speaks English, Hindi, and Punjabi, with beginner French."
  },
  {
    id: "contact",
    keywords: ["contact", "contacter", "email", "courriel", "linkedin", "github", "reach", "hire", "embaucher", "available", "disponible", "role", "roles", "job", "emploi"],
    answer: "Angad is graduating in December 2026 and is seeking full-time AI/ML roles. You can reach him at angadfzr123@gmail.com, on LinkedIn at linkedin.com/in/angad-sodhi, or on GitHub at github.com/sodhi-007."
  }
];

const frenchAnswers = {
  overview: "Selon les périodes indiquées dans son CV, Angad possède environ 2 ans et 6 mois d’expérience professionnelle documentée : 22 mois chez Reliance Jio, 5 mois chez CIMA+ et 3 mois chez IBM. Cela combine près de deux ans en cybersécurité d’entreprise et huit mois de stages en IA et en génie logiciel.",
  cima: "Chez CIMA+, Angad a livré un agent RAG bilingue anglais-français utilisé par plus de 700 employés, réduisant de 60 % le temps de recherche manuelle. Il a construit la recherche sur plus de 10 000 pages de documents d’ingénierie avec MinerU, les embeddings OpenAI, ChromaDB et Azure Container Apps Jobs; 95 % des requêtes étaient traitées en moins de trois secondes. Il a aussi développé des composants d’évaluation et de routage ainsi qu’une plateforme multi-agents Open WebUI/LiteLLM pour plus de 50 utilisateurs simultanés.",
  jio: "Comme gestionnaire adjoint en cybersécurité chez Reliance Jio, Angad a dirigé la gestion des vulnérabilités de plus de 40 000 serveurs, atténué plus de 10 000 vulnérabilités exploitables et réalisé des évaluations sur plus de 100 000 appareils avec une conformité supérieure à 99 %. Il a rédigé plus de 30 politiques fondées sur CIS et réduit de 70 % l’exposition aux vulnérabilités zero-day grâce au correctif virtuel.",
  ibm: "Durant son stage chez IBM, Angad a construit une plateforme de commerce électronique composée de cinq services avec Java, Spring Boot et Spring MVC. Il l’a conteneurisée avec Docker, automatisé le CI/CD avec Jenkins et Maven, et utilisé Spring Cloud, MySQL, MongoDB, des API REST et Spring Security.",
  projects: "Les projets universitaires d’Angad comprennent un système d’identification de produits contrefaits sur chaîne de blocs, un portail d’information universitaire Django, un gestionnaire quantitatif de portefeuille en Python et une plateforme de financement participatif en Solidity. Vous pouvez me demander un résumé de chacun.",
  skills: "La pile IA principale d’Angad comprend Python, FastAPI, RAG, les systèmes agentiques, l’évaluation LLM-as-judge, les embeddings OpenAI, ChromaDB, LiteLLM, Open WebUI et DistilBERT. Pour la production, il travaille avec Azure Container Apps, AWS, Docker, Kubernetes, ClearML, Redis, Datadog, Jenkins et Linux. Il apporte aussi une expérience Java/Spring et en sécurité d’entreprise.",
  education: "Angad termine une maîtrise en génie logiciel (coop) à l’Université Concordia, prévue en décembre 2026, avec une moyenne de 3,47/4,30. Il détient également un BTech en informatique de l’UPES, axé sur l’infonuagique et la virtualisation, avec une moyenne de 7,87/10.",
  certifications: "Angad détient les certifications Certified Ethical Hacker (CEH) et Microsoft Azure Fundamentals (AZ-900). Il parle anglais, hindi et pendjabi, avec un niveau débutant en français.",
  contact: "Angad obtiendra son diplôme en décembre 2026 et recherche un poste à temps plein en IA/ML. Vous pouvez le joindre à angadfzr123@gmail.com, sur LinkedIn à linkedin.com/in/angad-sodhi ou sur GitHub à github.com/sodhi-007."
};

const stopWords = new Set(["a", "an", "and", "are", "about", "can", "did", "do", "does", "for", "how", "i", "is", "me", "of", "on", "the", "their", "they", "to", "what", "who", "with", "you", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "est", "et", "il", "la", "le", "les", "me", "moi", "par", "pour", "que", "qui", "sa", "ses", "son", "sur", "un", "une"]);

function tokens(text) {
  return String(text).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9+.#-]+/g, " ").split(/\s+/).filter((token) => token && !stopWords.has(token));
}

export function rankTopics(message) {
  const words = tokens(message);
  return topicAnswers.map((topic) => ({ ...topic, score: topic.keywords.reduce((score, keyword) => score + (words.includes(keyword) ? 1 : 0), 0) })).filter((topic) => topic.score > 0).sort((a, b) => b.score - a.score);
}

export function fallbackReply(message, language = "en") {
  const french = language === "fr";
  const normalized = String(message).trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (!normalized) return french ? "Posez-moi des questions sur le travail RAG d’Angad chez CIMA+, son expérience en sécurité chez Jio, son stage chez IBM, ses projets, sa pile technique ou sa formation." : "Ask me about Angad's CIMA+ RAG work, Jio security experience, IBM internship, projects, technical stack, or education.";
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|bonjour|salut)[!. ]*$/.test(normalized)) return french ? "Bonjour — je suis l’assistant du portfolio d’Angad. Je réponds à partir de son expérience, de ses projets, de ses compétences et de sa formation documentés dans son CV." : "Hi — I’m Angad's portfolio assistant. I answer from his résumé-backed experience, projects, skills, and education.";
  const ranked = rankTopics(message);
  if (ranked.length) return french ? frenchAnswers[ranked[0].id] : ranked[0].answer;
  if (/who (is|are)|tell me about|overview|summary|qui est|parle-moi|resume/.test(normalized)) return french ? "Angad Singh Sodhi est un ingénieur en IA appliquée à Montréal qui a livré un agent RAG en production chez CIMA+ après près de deux ans en sécurité d’entreprise chez Reliance Jio. Il termine une maîtrise en génie logiciel à l’Université Concordia et recherche un poste à temps plein en IA/ML après décembre 2026." : "Angad Singh Sodhi is an applied AI engineer in Montreal who shipped a production RAG agent at CIMA+ after nearly two years in enterprise security at Reliance Jio. He is completing an MEng in Software Engineering at Concordia University and is seeking full-time AI/ML roles after graduating in December 2026.";
  return french ? "Ce détail ne figure pas dans les données vérifiées du CV d’Angad, donc je préfère ne pas deviner. Essayez une question sur CIMA+, Jio, IBM, ses projets universitaires, sa pile technique, sa formation ou ses certifications." : "That detail is not in Angad's curated résumé data, so I don’t want to guess. Try asking about CIMA+, Jio, IBM, his academic projects, technical stack, education, or certifications.";
}

export function suggestedQuestions(language = "en") {
  return language === "fr" ? ["Qu’a construit Angad chez CIMA+?", "Parlez-moi de ses projets", "Quelle est sa pile IA?"] : ["What did Angad build at CIMA+?", "Tell me about his projects", "What is his AI stack?"];
}
