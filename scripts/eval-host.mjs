import { setTimeout as delay } from "node:timers/promises";

export function hostedEvalClient() {
  const base = new URL(process.env.EVAL_BASE_URL || "https://angad-portfolio.onrender.com");
  const token = process.env.RAG_EVAL_TOKEN || "";
  const commit = process.env.EVAL_EXPECT_COMMIT || "";
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("EVAL_BASE_URL must be an HTTPS origin for hosted evaluation.");
  }
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Set RAG_EVAL_TOKEN to the 64-character hex benchmark token.");
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Set EVAL_EXPECT_COMMIT to the full Git commit SHA.");

  function request(path, { method = "GET", data } = {}) {
    return fetch(new URL(path, base), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Eval-Commit": commit,
        ...(data === undefined ? {} : { "Content-Type": "application/json" })
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      redirect: "error",
      signal: AbortSignal.timeout(90_000)
    });
  }

  async function waitForDeployment() {
    const deadline = Date.now() + 8 * 60_000;
    let state = "waiting for the service";
    while (Date.now() < deadline) {
      const response = await request("/api/eval/status").catch(() => null);
      if (response?.status === 401) {
        await response.body?.cancel();
        throw new Error("Render rejected RAG_EVAL_TOKEN. Verify that the GitHub and Render values match.");
      }
      if (response?.ok) {
        const status = await response.json().catch(() => null);
        if (status?.commit === commit) return status;
        if (status && !status.commit) throw new Error("Render did not report its deployed commit.");
        state = status?.commit ? `current commit ${status.commit.slice(0, 12)}` : "unexpected status response";
      } else if (response) {
        state = `status endpoint returned ${response.status}`;
        if (response.status === 404) {
          const data = await response.json().catch(() => null);
          if (data?.error === "Hosted evaluation is disabled.") {
            throw new Error("Enable hosted evaluation by setting RAG_EVAL_TOKEN on the Render service.");
          }
        } else await response.body?.cancel();
      }
      console.log(`Waiting for Render commit ${commit.slice(0, 12)} (${state}).`);
      await delay(10_000);
    }
    throw new Error(`Render did not serve commit ${commit.slice(0, 12)} in time. Last check: ${state}.`);
  }

  return { request, waitForDeployment };
}
