SKILL_DIR := skills/smart-review

.PHONY: validate update-tree check-freshness check-links

validate:
	@echo "=== Checking structure ==="
	@test -f $(SKILL_DIR)/SKILL.md || (echo "FAIL: SKILL.md missing" && exit 1)
	@test -f $(SKILL_DIR)/reference/index.md || (echo "FAIL: reference/index.md missing" && exit 1)
	@for agent in project-scanner excellence-reviewer code-simplifier targeted-reviewer silent-failure-hunter; do \
		test -f $(SKILL_DIR)/agents/$$agent.md || (echo "FAIL: agents/$$agent.md missing" && exit 1); \
	done
	@test -f $(SKILL_DIR)/commands/update.md || (echo "FAIL: commands/update.md missing" && exit 1)
	@echo "✅ Structure OK"

update-tree:
	@echo "=== Refreshing reference/index.md source tree ==="
	@python3 -c "\
import os, json; \
base='$(SKILL_DIR)/reference'; \
sources=[]; \
[sources.append(f'{base}/{f}') for f in sorted(os.listdir(base)) if f.endswith('.md') and f != 'index.md']; \
print('\n'.join(sources))"

check-freshness:
	@echo "=== Checking reference freshness ==="
	@python3 -c "\
import datetime, re, sys; \
idx=open('$(SKILL_DIR)/reference/index.md').read(); \
pattern=r'\|\s*\S+\s*\|\s*\S+\s*\|\s*\S+\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|'; \
dates=re.findall(pattern, idx); \
now=datetime.date.today(); \
stale=[d for d in dates if (now-datetime.date.fromisoformat(d)).days>7]; \
print(f'Total sources: {len(dates)}'); \
print(f'Stale (>7 days): {len(stale)}'); \
sys.exit(1 if stale else 0)" || echo "⚠️  Stale references detected — run /smart-review:update"

check-links:
	@echo "=== Checking upstream URLs ==="
	@urls=$$(grep -rhoE 'https://[a-zA-Z0-9._/?=&%-]+' README.md $(SKILL_DIR)/reference/index.md | sort -u); \
	fail=0; \
	for url in $$urls; do \
		code=$$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$$url"); \
		if [ "$$code" -ge 400 ]; then \
			echo "FAIL: $$url -> HTTP $$code"; \
			fail=1; \
		else \
			echo "$$url -> $$code"; \
		fi; \
	done; \
	exit $$fail
