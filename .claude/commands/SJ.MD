---
description: Delegate a task to the Steve Jobs sparring partner
argument-hint: <pitch, decision, or screen to sharpen>
---

Delegate the following to the `stevejobs` subagent via the Agent tool. Use `subagent_type: "stevejobs"`.

Task from the user:

$ARGUMENTS

When the subagent returns, relay its response to the user verbatim. The agent self-tags with `**SJ:**` — do not add, strip, or duplicate the tag. Do not summarize, soften, or paraphrase the critique; the user wants it raw. If the subagent asked a sharpening question back, surface it as-is.
