import test from "node:test";
import assert from "node:assert/strict";
import { fallbackReply, rankTopics } from "../lib/chat.mjs";

test("answers CIMA+ questions with resume-backed production metrics", () => {
  const answer = fallbackReply("What did Angad build at CIMA+?");
  assert.match(answer, /700\+/);
  assert.match(answer, /10,000\+/);
  assert.match(answer, /60%/);
});

test("answers Jio questions with verified security scale", () => {
  const answer = fallbackReply("What did he do at Jio?");
  assert.match(answer, /40,000\+/);
  assert.match(answer, /100,000\+/);
});

test("deduces total documented experience from resume date ranges", () => {
  const answer = fallbackReply("How much experience does Angad have?");
  assert.match(answer, /2 years and 6 months/i);
  assert.match(answer, /22 months at Reliance Jio/i);
  assert.match(answer, /5 months at CIMA\+/i);
  assert.match(answer, /3 months at IBM/i);
});

test("routes co-op resume project questions correctly", () => {
  assert.equal(rankTopics("Tell me about the Solidity crowdfunding project")[0].id, "projects");
});

test("provides only verified contact links", () => {
  const answer = fallbackReply("How can I contact Angad?");
  assert.match(answer, /angadfzr123@gmail\.com/);
  assert.match(answer, /linkedin\.com\/in\/angad-sodhi/);
});

test("declines facts not found in the curated resume data", () => {
  const answer = fallbackReply("What is his favourite movie?");
  assert.match(answer, /don’t want to guess/i);
});

test("answers French portfolio questions in French", () => {
  const answer = fallbackReply("Parlez-moi de ses projets", "fr");
  assert.match(answer, /projets universitaires/i);
  assert.match(answer, /Solidity/i);
});
