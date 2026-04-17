---
description: Delegate a task to the Engineer agent
argument-hint: <task for the engineer>
---

Delegate the following task to the `engineer` subagent via the Agent tool. Use `subagent_type: "engineer"`.

Task from the user:

$ARGUMENTS

When the subagent returns, relay its response to the user verbatim, prefixed with `**EN:**` on the first line so they know the reply is from the Engineer. Do not summarize or paraphrase — the user wants to hear from the Engineer directly. If the subagent asked clarifying questions, surface them as-is.
