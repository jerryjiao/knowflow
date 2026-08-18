# KnowFlow launch checklist

Use this checklist for the v0.3.0 release and the first coordinated public launch. Do not drive traffic until the install path and the capture → organize → graph boundary are both obvious from the repository homepage.

## Repository profile

- [ ] Set the repository description to:

  > Agent-native Markdown knowledge workspace: capture URLs and notes, organize them into linked wikis with your AI agent, then explore graphs and semantic search.

- [ ] Set the website field to the npm package page after publication: `https://www.npmjs.com/package/knowflow`.
- [ ] Add a 1280 × 640 social preview that remains legible at thumbnail size.
- [ ] Add these focused GitHub topics (keep the strongest topics first):

  ```text
  llm-wiki
  knowledge-management
  personal-knowledge-management
  knowledge-graph
  markdown
  ai-agents
  cli
  semantic-search
  second-brain
  karpathy
  ```

- [ ] Confirm Issues are enabled and the bug/feature forms render correctly.
- [ ] Confirm the Security tab exposes the private vulnerability-reporting flow.

## Demo and README

- [ ] Confirm the Social Preview and graph screenshot render correctly in both root READMEs.
- [ ] Add a short GIF or video link when a polished capture → organize → graph recording is available.
- [ ] Keep the demo under 30 seconds and show one complete sequence: capture → raw file → agent-reviewed Wiki pages → graph.
- [ ] Keep terminal text large enough to read on GitHub and social feeds.
- [ ] Verify the English README is the default and the language switch works in both directions.
- [ ] Test every Quick start command in a clean directory using the published package.
- [ ] Keep the sentence explaining that `ingest` does not synthesize Wiki pages above the fold.

## Release readiness

- [ ] Confirm `package.json` and `package-lock.json` use version `0.3.0`.
- [ ] Run `npm ci`, `npm run check`, `npm test`, and `npm pack --dry-run`.
- [ ] Install the generated tarball into a clean temporary directory and run `init`, text `ingest`, `status`, `health`, and `graph --no-open`.
- [ ] Inspect the tarball and confirm it includes both READMEs, examples, templates, contributor guidance, the changelog, and the license.
- [ ] Confirm no `.env`, API key, personal path, captured private content, test fixture, or build output is packaged.
- [ ] Review [CHANGELOG.md](../../CHANGELOG.md) and remove any promise that is not implemented.
- [ ] Commit and push the release changes; wait for all CI matrix jobs to pass.
- [ ] Publish `knowflow@0.3.0` to npm and verify `npx knowflow@latest --version` in a clean directory.
- [ ] Create Git tag `v0.3.0` and a GitHub Release using the changelog as the base.
- [ ] Update the README if the final npm command, graph output, or limitation differs from the release candidate.

## Coordinated launch

Publish only after npm and the GitHub Release are live. Use one canonical demo URL and reply to every substantive question during the first 24 hours.

### Suggested channels

| Channel | Angle |
| --- | --- |
| X / Twitter | Short build story, GIF, one-sentence positioning, GitHub link |
| Show HN | Technical motivation, explicit limitations, what is novel, request for feedback |
| Reddit | Workflow-first case study tailored to PKM, LocalLLaMA, or command-line communities; follow each community's self-promotion rules |
| V2EX | Chinese developer story, reproducible commands, current limitations |
| 公众号 / 小红书 | Before/after knowledge workflow, visual graph, Chinese tutorial |
| Awesome lists | Small PR with accurate category, one-line description, and no promotional language |

Do not publish the same generic copy everywhere. Lead with the problem each community already discusses.

## Suggested launch copy

### GitHub / repository tagline

> Capture sources as Markdown, organize them with your AI agent, and explore a linked Wiki as a knowledge graph.

### X / Twitter

> I built KnowFlow, an open-source, agent-native Markdown knowledge workspace.
>
> It captures URLs and notes into a traceable raw layer, lets you use any AI agent to organize linked Wiki pages, then builds an interactive knowledge graph.
>
> v0.2.0 adds portable projects, safer CLI execution, tests, and CI. Feedback welcome: https://github.com/jerryjiao/knowflow

### Show HN title

> Show HN: KnowFlow – An agent-native Markdown workspace for building linked LLM wikis

### Show HN opening

> I kept saving useful links but rarely returned to them. KnowFlow separates deterministic capture from AI synthesis: URLs and notes are preserved as raw Markdown, then any agent or manual workflow can turn them into reviewed, linked Wiki pages. The CLI builds a graph, checks Wiki health, and supports optional semantic search. It is intentionally not a one-command “AI writes your knowledge base” system yet; I would value feedback on that workflow boundary.

### 中文发布文案

> 我做了一个开源的 Agent 原生 Markdown 知识工作区 KnowFlow。它先把 URL 和笔记保留到可追溯的 raw 层，再让你选择任意 AI Agent 整理成互联 Wiki，最后生成知识图谱。v0.2.0 修复了 CLI 和路径问题，加入独立项目、测试与 CI。它目前不会把 `ingest` 伪装成全自动知识生成，欢迎一起把这条工作流做完整：https://github.com/jerryjiao/knowflow

## First-week follow-through

- [ ] Turn repeated questions into README or example improvements within 24 hours.
- [ ] Label small, well-scoped tasks as `good first issue` only after writing acceptance criteria.
- [ ] Share one technical follow-up (architecture, graph format, or agent workflow) instead of reposting the launch announcement.
- [ ] Track visits, clones, npm downloads, stars, issues, and successful first runs; do not optimize for stars alone.
- [ ] Publish a 0.2.1 patch quickly if onboarding reveals a blocking defect.
