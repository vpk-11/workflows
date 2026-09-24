#!/usr/bin/env bash
# usage: dryrun-classify.sh <repo-dir> [N]   prints level per recent commit using the proposed rules
repo=$1; n=${2:-25}; cd "$repo"
name=$(basename "$repo")
GEN='^(graphify-out/|dist/|[^/]+/dist/|target/|[^/]+/target/|\.idea/)'
NONSRC='(\.md$|^\.github/|^LICENSE$)'
case $name in
  donna|heimdall|narada|clinical-copilot|quantico) NONSRC="(\\.md\$|^tests/|^pipeline/tests/|^samples/|^images/|^bug_evidences/|^\\.github/|^LICENSE\$)"; GEN="$GEN|^wandb/";;
  leethub) NONSRC='(\.md$|^spec/|^assets/|^docs/|^\.github/|^LICENSE$)';;
  Portfolio) NONSRC='(\.md$|^src/data/|^src/test/|^public/|^\.github/|^LICENSE$)';;
  url-shortner) NONSRC='(\.md$|\.test\.ts$|^\.github/|^LICENSE$)';;
  atlas) NONSRC='(\.md$|/src/test/|^monitoring/|^load-testing/|^\.github/|^LICENSE$)';;
esac
git log -n "$n" --format='%h %P|%s' | while IFS='|' read -r hp subj; do
  h=${hp%% *}; parents=$(echo "${hp#* }" | wc -w)
  case "$subj" in "chore: bump version"*) continue;; esac
  if [ "$parents" -gt 1 ] || echo "$subj" | grep -qE '\(#[0-9]+\)$'; then echo "$h merge/PR       $subj"; continue; fi
  files=$(git diff --name-only "$h~1" "$h" 2>/dev/null)
  real=$(echo "$files" | grep -Ev "$GEN" | grep -v '^$' || true)
  if [ -z "$real" ]; then lvl=skip; else
    code=$(echo "$real" | grep -Ev "$NONSRC" || true); [ -z "$code" ] && lvl=patch || lvl=minor; fi
  printf '%s %-6s %s\n' "$h" "$lvl" "$subj" | cut -c1-90
done
