import test from "node:test";
import assert from "node:assert/strict";
import { smallTalkReply, retrievalQuestion } from "../lib/assistant-behavior.mjs";
import { localRagAnswer } from "../lib/rag.mjs";

test("casual greetings introduce the assistant without needing retrieved evidence", () => {
  for (const greeting of ["hi", "YO!", "yo wassup", "what’s up?", "hey there", "Hello 👋", "how are you?"]) {
    const answer = localRagAnswer(greeting, []);
    assert.match(answer, /Angad’s AI assistant/);
    assert.match(answer, /experience, projects, skills/);
    assert.doesNotMatch(answer, /could not find|40,000|700/);
  }
});

test("later greetings do not repeat the introduction", () => {
  const history = [{ role: "user", content: "yo" }, { role: "assistant", content: smallTalkReply("yo") }];
  assert.doesNotMatch(localRagAnswer("hey", [], "en", history), /AI assistant/);
  assert.match(smallTalkReply("who are you?", "en", history), /AI assistant/);
  assert.match(smallTalkReply("what’s your role?"), /AI assistant/);
  assert.match(smallTalkReply("yo", "en", { unexpected: true }), /AI assistant/);
});

test("greetings or thanks followed by a real question do not swallow the question", () => {
  for (const query of ["Hey, what did Angad build at CIMA+?", "Thanks, what about his projects?", "Yo, tell me about Jio"]) {
    assert.equal(smallTalkReply(query), null);
  }
  assert.equal(retrievalQuestion("Hey, what did Angad build at CIMA+?"), "what did Angad build at CIMA+?");
});

test("limits questions explain what the assistant cannot do", () => {
  for (const query of ["What can't you do?", "What are your limits?", "What are your limitations?", "What don't you know?"]) {
    const answer = smallTalkReply(query);
    assert.ok(answer, `Expected a reply for: ${query}`);
    assert.match(answer, /can't answer general knowledge/);
    assert.match(answer, /write code/);
  }
  assert.match(smallTalkReply("Quelles sont tes limites ?", "fr"), /questions générales/);
  assert.match(smallTalkReply("Qu'est-ce que tu ne peux pas faire ?", "fr"), /écrire du code/);
});

test("small talk stays brief and respects the selected language", () => {
  assert.equal(smallTalkReply("thanks!"), "You’re welcome!");
  assert.equal(smallTalkReply("merci", "fr"), "Avec plaisir !");
  assert.match(smallTalkReply("yo", "fr"), /assistant IA d’Angad/);
  assert.match(smallTalkReply("bye"), /See you/);
  assert.equal(smallTalkReply("what is the weather?"), null);
});
