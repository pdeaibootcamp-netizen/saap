---
description: Delegate a task to the Designer agent
argument-hint: <task for the designer>
---

Delegate the following task to the `designer` subagent via the Agent tool. Use `subagent_type: "designer"`.

Task from the user:

$ARGUMENTS

When the subagent returns, relay its response to the user verbatim, prefixed with `**PD:**` on the first line so they know the reply is from the Designer. Do not summarize or paraphrase — the user wants to hear from the Designer directly. If the subagent asked clarifying questions, surface them as-is.
