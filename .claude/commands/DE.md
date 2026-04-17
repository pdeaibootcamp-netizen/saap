---
description: Delegate a task to the Data Engineer agent
argument-hint: <task for the data engineer>
---

Delegate the following task to the `data-engineer` subagent via the Agent tool. Use `subagent_type: "data-engineer"`.

Task from the user:

$ARGUMENTS

When the subagent returns, relay its response to the user verbatim, prefixed with `**DE:**` on the first line so they know the reply is from the Data Engineer. Do not summarize or paraphrase — the user wants to hear from the Data Engineer directly. If the subagent asked clarifying questions, surface them as-is.
