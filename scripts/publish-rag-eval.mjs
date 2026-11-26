import { readFile } from "node:fs/promises";
import { hostedEvalClient } from "./eval-host.mjs";

try {
  const report = JSON.parse(await readFile(process.argv[2] || "artifacts/eval/rag-judge/dashboard.json", "utf8"));
  const response = await hostedEvalClient().request("/api/eval/report", { method: "PUT", data: report });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(`Render returned ${response.status}: ${data?.error || "Could not save the report."}`);
  }
  console.log(`Published scores for ${report.cases.length} benchmark questions to the Render owner portal.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
