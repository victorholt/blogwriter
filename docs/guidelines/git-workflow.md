# Git Workflow

## Branch Strategy

All work happens on feature branches off `main`. Main is always deployable.

### Branch Naming

```
feature/short-description    # New features
fix/short-description        # Bug fixes
docs/short-description       # Documentation only
refactor/short-description   # Code restructuring (no behavior change)
chore/short-description      # Tooling, config, dependencies
```

Examples:
- `feature/stepper-ui`
- `fix/dress-selection-overflow`
- `docs/api-endpoints`
- `refactor/extract-agent-factory`

### Branch Lifecycle

1. Create branch from `main`
2. Work in small, focused commits
3. Push and open PR when ready for review
4. Merge to `main` after approval
5. Delete the branch after merge

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style` | Formatting, whitespace (no logic change) |
| `test` | Adding or modifying tests |
| `chore` | Build process, dependencies, tooling |

### Rules

- **Imperative mood**: "Add stepper component", not "Added" or "Adds"
- **Lowercase first word**: `feat: add stepper`, not `feat: Add stepper`
- **No period at end**: `feat: add stepper`, not `feat: add stepper.`
- **Under 72 characters** for the first line
- **One logical change per commit** — don't mix refactoring with feature work
- Reference design docs in commit body when relevant

### Examples

```
feat: add wizard stepper indicator component

Implements the 4-step horizontal stepper matching the design in
docs/designs/frontend-components.md. Steps show active/completed/pending
states with connecting lines.
```

```
fix: prevent dress selection when loading

The dress grid was interactive during the loading state, allowing
selections before data was ready. Added disabled state to cards
while isDressesLoading is true.
```

---

## Pull Requests

### PR Title
- Same format as commit messages: `feat: add wizard stepper UI`
- Under 72 characters

### PR Description
- Reference the relevant design doc
- List what changed and why
- Include testing instructions
- Note any follow-up work needed

### Template

```markdown
## Summary
Brief description of what this PR does.

## Design Doc
Link to relevant `docs/designs/*.md` document.

## Changes
- Added X
- Modified Y
- Removed Z

## Testing
How to verify this works:
1. Step one
2. Step two

## Follow-up
- [ ] Any remaining work for a future PR
```

---

## Merge Strategy

- **Squash merge** for feature branches (keeps main history clean)
- **Merge commit** only for release branches or significant milestones
- Always delete the source branch after merging
