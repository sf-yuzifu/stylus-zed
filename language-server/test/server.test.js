import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(directory, "../bin/stylus-language-server.js");

function startServer(context) {
  const child = spawn(process.execPath, [serverPath, "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages = [];
  const waiters = [];
  let output = Buffer.alloc(0);
  let stderr = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  function dispatch(message) {
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message));
    if (waiterIndex === -1) {
      messages.push(message);
      return;
    }

    const [{ resolve, timer }] = waiters.splice(waiterIndex, 1);
    clearTimeout(timer);
    resolve(message);
  }

  child.stdout.on("data", (chunk) => {
    output = Buffer.concat([output, chunk]);

    while (true) {
      const headerEnd = output.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      const header = output.subarray(0, headerEnd).toString("ascii");
      const lengthMatch = /(?:^|\r\n)Content-Length: (\d+)/i.exec(header);
      assert.ok(lengthMatch, `missing Content-Length header: ${header}`);

      const contentLength = Number(lengthMatch[1]);
      const messageEnd = headerEnd + 4 + contentLength;
      if (output.length < messageEnd) return;

      const body = output.subarray(headerEnd + 4, messageEnd).toString("utf8");
      output = output.subarray(messageEnd);
      dispatch(JSON.parse(body));
    }
  });

  function send(message) {
    const body = JSON.stringify(message);
    child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  function waitFor(predicate, timeout = 5_000) {
    const messageIndex = messages.findIndex(predicate);
    if (messageIndex !== -1) {
      return Promise.resolve(messages.splice(messageIndex, 1)[0]);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index !== -1) waiters.splice(index, 1);
        reject(new Error(`timed out waiting for server message\nstderr: ${stderr}`));
      }, timeout);
      waiters.push({ predicate, resolve, timer });
    });
  }

  context.after(() => {
    if (child.exitCode === null) child.kill();
  });

  return { child, send, waitFor };
}

test("publishes and clears diagnostics over stdio", async (context) => {
  const server = startServer(context);
  const uri = "file:///tmp/protocol-test.styl";

  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      processId: null,
      rootUri: null,
      capabilities: {},
    },
  });

  const initialize = await server.waitFor((message) => message.id === 1);
  assert.equal(initialize.result.serverInfo.name, "stylus-language-server");
  assert.equal(initialize.result.capabilities.textDocumentSync.change, 2);
  assert.deepEqual(Object.keys(initialize.result.capabilities), ["textDocumentSync"]);

  server.send({ jsonrpc: "2.0", method: "initialized", params: {} });
  server.send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri,
        languageId: "stylus",
        version: 1,
        text: "body\n  color red\n  broken(",
      },
    },
  });

  const reported = await server.waitFor(
    (message) =>
      message.method === "textDocument/publishDiagnostics" &&
      message.params.uri === uri &&
      message.params.diagnostics.length === 1,
  );
  assert.deepEqual(reported.params.diagnostics[0].range.start, {
    line: 2,
    character: 9,
  });

  server.send({
    jsonrpc: "2.0",
    method: "textDocument/didChange",
    params: {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: "body\n  color red" }],
    },
  });

  const cleared = await server.waitFor(
    (message) =>
      message.method === "textDocument/publishDiagnostics" &&
      message.params.uri === uri &&
      message.params.diagnostics.length === 0,
  );
  assert.deepEqual(cleared.params.diagnostics, []);

  server.send({
    jsonrpc: "2.0",
    method: "textDocument/didClose",
    params: { textDocument: { uri } },
  });
  server.send({ jsonrpc: "2.0", id: 2, method: "shutdown", params: null });
  await server.waitFor((message) => message.id === 2);
  server.send({ jsonrpc: "2.0", method: "exit", params: null });
});
