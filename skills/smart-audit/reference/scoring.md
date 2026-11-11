# Scoring

The score is computed by `smart-audit score` from confirmed findings. The model never computes,
estimates, or adjusts a score. This file documents scoring version `1`.

## Formula

```
score = 100 − 40·critical − 15·high − 6·medium − 2·low      (never below 0)
if any critical is counted:  score = min(score, 39)
else if any high is counted: score = min(score, 69)
```

A finding is **counted** unless one of these holds:

- its severity is `info`;
- its confidence is `low` (move it to `unconfirmed` or confirm it);
- it is `low` or `medium` and listed in the repository's accepted-risks file.

`high` and `critical` findings are always counted. An accepted-risks entry cannot remove them.

Criteria scores (0–5) are diagnostic. They are shown in the report and never enter the formula.

## Bands

| Score | Band | Meaning |
|---|---|---|
| 70–100 | good | no known top risk; keep building |
| 40–69 | fair | known problems worth scheduling |
| 0–39 | poor | at least one problem that should stop a release |

The overall score of a run is the rounded mean of the audits that ran.

## Why these numbers

The weights are chosen so that the bands mean something a reader can state in one sentence:

- **A confirmed critical problem always lands in the poor band.** Forty points alone would leave 60; the cap at 39 makes the rule unconditional.
- **A confirmed high problem can never be green.** Fifteen points alone would leave 85; the cap at 69 makes "good" mean "no known high-severity problem".
- **Medium problems are tolerable in small numbers.** Five leave the score at 70, the sixth leaves the good band.
- **Low problems are noise until they pile up.** A handful barely moves the score; fifteen of them leave it at 70.
- **Each step is roughly 2.5–3× the one below it**, so one finding of a higher severity always outweighs two of the next lower one.

Deductions are linear and uncapped apart from the two rules above, so anyone can redo the
arithmetic from the findings list. The report prints every step.

## Comparing scores

Scores are comparable between two runs only when the rubric version and the scoring version are
the same. The report says so when they differ. A higher score on a later run can mean the code
improved or that the later run found less; the per-finding comparison (`fixed`, `still present`,
`new`, `missed earlier`, `not reproduced`) tells which.

## Changing the formula

Any change to weights, caps, bands, or counting rules bumps `SCORING_VERSION` in
`cli/lib/score.mjs`, this file, and the tests in the same commit.
