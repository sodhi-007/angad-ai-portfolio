const metrics = ["context_precision", "context_recall", "faithfulness", "answer_relevancy"];

function text(value, maxLength) {
  if (typeof value !== "string" || value.length > maxLength) throw new Error("Invalid report text.");
  return value.trim();
}

export function validateEvalDashboard(report) {
  if (report?.schemaVersion !== 1 || !Array.isArray(report.cases) || !report.cases.length || report.cases.length > 200) {
    throw new Error("Use the dashboard.json file from a completed RAG judge run.");
  }

  const judgedAt = text(report.judgedAt, 40);
  if (!Number.isFinite(Date.parse(judgedAt))) throw new Error("The report is missing a valid run date.");
  const commit = text(report.commit ?? "", 40);
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error("The report has an invalid deployment commit.");

  const seen = new Set();
  const cases = report.cases.map((entry) => {
    const name = text(entry?.name, 120);
    const question = text(entry.question, 800);
    if (!name || !question || seen.has(name)) throw new Error("Each report case needs a unique name and a question.");
    seen.add(name);
    const scores = Object.fromEntries(metrics.map((metric) => {
      const score = entry.scores?.[metric];
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > 1)) {
        throw new Error("Metric scores must be numbers from 0 to 1 or null.");
      }
      return [metric, score];
    }));
    return { name, question, scores };
  });

  const averages = Object.fromEntries(metrics.map((metric) => {
    const scores = cases.map((entry) => entry.scores[metric]).filter((score) => score !== null);
    return [metric, {
      mean: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
      scoredCases: scores.length
    }];
  }));

  return {
    schemaVersion: 1,
    judgedAt: new Date(judgedAt).toISOString(),
    commit,
    provider: text(report.provider, 80),
    model: text(report.model, 160),
    chatMode: text(report.chatMode ?? "", 40),
    referencePdf: text(report.referencePdf ?? "", 256),
    cases,
    averages
  };
}
