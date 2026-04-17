---
description: Delegate a task to the Product Manager agent
argument-hint: <task for the product manager>
---

Delegate the following task to the `product-manager` subagent via the Agent tool. Use `subagent_type: "product-manager"`.

Task from the user:

$ARGUMENTS

When the subagent returns, relay its response to the user verbatim, prefixed with `**PM:**` on the first line so they know the reply is from the Product Manager. Do not summarize or paraphrase — the user wants to hear from the PM directly. If the subagent asked clarifying questions, surface them as-is.
