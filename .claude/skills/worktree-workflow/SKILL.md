---
name: worktree-workflow
description: How to start, carry and land a change in this repo. Every agent gets its own git worktree on its own branch, lands it through a pull request it merges itself, and never commits to main. Use this before the first edit of any task that touches tracked files, and again when the work is ready to land.
---

# Working in a worktree

Several agents edit this repo at once, often at the same minute. One shared
checkout means one shared index, one shared `git stash`, one set of dirty
files, and a `git commit -a` that quietly ships somebody else's half-finished
work. A worktree each removes the whole class of problem: separate directories,
separate branches, one shared `.git`.

Three rules. The rest of this file is how to obey them.

1. **`main` is nobody's workspace.** `/Users/barak/oddfox` stays on `main` and
   is only ever moved by `git pull --ff-only`. Nobody edits there, nobody
   commits there, nobody checks a feature branch out there.
2. **One agent, one worktree, one branch.** Make it before your first edit,
   not after.
3. **Land through a PR you merge yourself.** Nobody is waiting to review it.
   The PR exists so the change has a page with a diff, a title and a date.

## Start

Before touching a tracked file:

```bash
git -C /Users/barak/oddfox fetch origin
git -C /Users/barak/oddfox worktree add -b <branch> /Users/barak/oddfox-wt/<branch> origin/main
cd /Users/barak/oddfox-wt/<branch>
```

Branch off `origin/main`, not off local `main` — the local one may be behind,
and starting behind is how you end up resurrecting a file somebody deleted.

Name the branch after the change, in the shape the merged ones use:
`unsubscribe-host-and-backfill`, `deck/insurance-explainer`. The directory takes
the same name (a `/` in the branch just makes a subdirectory, which is fine).

**Worktrees live outside the repo, in `/Users/barak/oddfox-wt/`.** This is not
tidiness. The marketing site's Firebase `public` is the repo root, so a worktree
checked out *inside* it ships with the site. There is usually one squatting
there — `node tools/hosting-deploy.mjs seaworth --dry` lists 28 files for a site
that has 14, the other half being a second copy of everything under `/dep/`,
`oddfox.ai/dep/brief.html` included.

None of it is live, and the reason matters: the deploy that actually runs is
`.github/workflows/deploy.yml`, from a clean CI checkout that has no worktrees
in it. It is a deploy **from this machine** that would publish them. So read the
dry-run file list before any local deploy from the root, and move a worktree you
find there:

```bash
git -C /Users/barak/oddfox worktree move dep /Users/barak/oddfox-wt/<name>
```

`git worktree list` shows who is where. A branch can only be checked out in one
worktree at a time — which is also what stops anyone claiming `main`, since the
primary checkout already holds it and `git worktree add … main` simply fails.

## While you work

- **The tree is yours, so `git add -A` is finally safe.** The old rule about
  staging only your own paths existed because everyone shared one directory.
  In your own worktree, everything dirty is yours. Commit as often as you like.
- **`node_modules` is per-worktree and not cheap** — 189 MB for
  `OddFoxOffice`, 269 MB for `server`. Only install the one you actually need
  to build, and don't install either for a docs- or data-only change.
- **Pick your own port.** A second `npm run dev` on 8787 either fails or, worse,
  attaches to the other agent's stale server. Check with
  `lsof -nP -iTCP:8787 -sTCP:LISTEN` and use `PORT=8790` if it's taken.
- **Rebase your own branch, never anyone else's.** If `main` moves under you:
  `git fetch origin && git rebase origin/main`. Force-pushing your own unmerged
  branch is fine; force-pushing a branch you did not create is not.
- Don't read another worktree's files to find out what someone is doing. Their
  uncommitted work is not a source of truth, and it will change under you.

## Land it

```bash
git push -u origin <branch>
gh pr create --base main --fill
gh pr merge --squash --delete-branch
```

**Merging is the approval.** Do not try `gh pr review --approve` first — GitHub
refuses to let an account approve its own pull request and returns a 422, and
the repo has no branch protection requiring one anyway. The PR is record
keeping: it gives the change a diff and a permalink. If it needs more than
`--fill` can say, write a body.

**A merge to `main` deploys production.** `.github/workflows/deploy.yml` fires
on every push to `main` and ships the Cloud Run server plus both hosting sites.
So merge when the change is finished, not when it is nearly finished, and say
in your report that you merged and therefore deployed. Check it landed:

```bash
gh run list --branch main --limit 3
```

## Clean up

```bash
cd /Users/barak/oddfox
git worktree remove /Users/barak/oddfox-wt/<branch>
git pull --ff-only
```

`git worktree remove` refuses if the tree is dirty — which is the point. If it
refuses, you left something uncommitted; look at it before you reach for
`--force`. Prune stale entries left by a directory somebody deleted by hand with
`git worktree prune`.

## When not to bother

A read-only task — answering a question, running a test, reading a log — needs
no worktree. Read from `/Users/barak/oddfox` and leave it alone. The worktree is
for writing.
