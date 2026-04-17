#!/usr/bin/env bash
# Enforce per-agent write-lane ownership on Write/Edit/NotebookEdit tool calls.
# Runs as a Claude Code PreToolUse hook. See .claude/settings.json.
#
# Payload shape (subset we care about):
#   { "tool_name": "Write|Edit|NotebookEdit",
#     "tool_input": { "file_path": "/absolute/path" },
#     "agent_type": "product-manager" | "designer" | ...   # absent in main session
#   }
#
# Exit 0: allow. Exit 2: block (stderr is fed back to Claude).

set -euo pipefail

PAYLOAD="$(cat)"

file_path="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // empty')"
agent_type="$(printf '%s' "$PAYLOAD" | jq -r '.agent_type // empty')"

# Nothing to enforce if we have no file_path.
[ -z "$file_path" ] && exit 0

# Normalize to repo-relative path.
project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
rel="${file_path#"$project_dir"/}"

# Orchestrator / main session: no agent_type. Always allowed.
if [ -z "$agent_type" ]; then
  exit 0
fi

# Ownership table: <path-prefix>|<required-agent-type>
# Longest prefix wins; first match here is taken in order.
case "$rel" in
  docs/product/*)                owner="product-manager" ;;
  docs/design/*)                 owner="designer" ;;
  docs/engineering/*|src/*)      owner="engineer" ;;
  docs/data/*)                   owner="data-engineer" ;;
  docs/project/*)                owner="__orchestrator_only__" ;;
  *) exit 0 ;;
esac

if [ "$owner" = "__orchestrator_only__" ]; then
  cat >&2 <<EOF
Blocked: $rel is in docs/project/, which is owned by the orchestrator (main session) only.
Current agent: $agent_type.
If you need a cross-cutting decision or an open-question entry, ask the orchestrator to add it.
EOF
  exit 2
fi

if [ "$agent_type" != "$owner" ]; then
  cat >&2 <<EOF
Blocked: $rel is owned by the '$owner' agent.
Current agent: '$agent_type'.
Escalate via docs/project/open-questions.md (ask the orchestrator to log it) instead of writing cross-lane.
EOF
  exit 2
fi

exit 0
