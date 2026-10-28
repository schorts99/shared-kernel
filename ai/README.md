# AI agent docs for `@schorts/shared-kernel`

These files teach AI coding agents (Claude Code, Cursor, GitHub Copilot, Codex, and others) how to use this package correctly in **your** project. They ship inside the npm package, so they always match the installed version.

```
node_modules/@schorts/shared-kernel/ai/
├── AGENTS.md   Overview, imports, and the rules that matter most. Start here.
├── rules/      Short, always-on conventions per area.
└── skills/     Step-by-step workflows for common tasks, with complete examples.
```

Every TypeScript example is type-checked against the package source before each release.

## Set it up

Pick the option for your tool. Each one points the agent at the installed copy, so upgrading the package upgrades the docs.

### Claude Code

Add a pointer to your project's `CLAUDE.md`:

```md no-check
## @schorts/shared-kernel
Before writing code that uses @schorts/shared-kernel, read
node_modules/@schorts/shared-kernel/ai/AGENTS.md and follow its rules.
For a task it lists, follow the matching skill in node_modules/@schorts/shared-kernel/ai/skills/.
```

To make the skills show up as Claude Code skills, link them into your project:

```bash
mkdir -p .claude/skills
for skill in node_modules/@schorts/shared-kernel/ai/skills/*/; do
  ln -sfn "../../$skill" ".claude/skills/shared-kernel-$(basename "$skill")"
done
```

### Cursor

Create `.cursor/rules/shared-kernel.mdc`:

```md no-check
---
description: Using @schorts/shared-kernel (DDD, CQRS, events, criteria, JSON:API)
globs: ["**/*.ts"]
alwaysApply: false
---
Read node_modules/@schorts/shared-kernel/ai/AGENTS.md and the rule files it links before
writing code that imports @schorts/shared-kernel. For a task it lists, follow the matching
skill in node_modules/@schorts/shared-kernel/ai/skills/.
```

### GitHub Copilot, Codex, and other `AGENTS.md`-aware tools

Add the same pointer to `.github/copilot-instructions.md` or your root `AGENTS.md`:

```md no-check
When code imports @schorts/shared-kernel, follow
node_modules/@schorts/shared-kernel/ai/AGENTS.md and the rules and skills it links.
```

### Copying instead of linking

If your tool cannot read `node_modules`, copy the folder into the repository and refresh it when you upgrade:

```bash
rm -rf docs/ai/shared-kernel && cp -R node_modules/@schorts/shared-kernel/ai docs/ai/shared-kernel
```
