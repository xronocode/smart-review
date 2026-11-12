# Scoring

The score is computed by `smart-audit score` from confirmed findings. The model never computes,
estimates, or adjusts a score. This file documents scoring version `3`.

## Formula

```
score = 100 − 40·critical − 15·high − 6·medium − 2·low      (never below 0)
medium findings together deduct at most 30
low findings together deduct at most 14
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
| 70–100 | good | no counted critical or high finding, and medium and low deductions together cost at most 30 points |
| 40–69 | fair | a counted high finding with no critical one, or medium and low findings together costing more than 30 points |
| 0–39 | poor | a counted critical finding, or counted high findings numerous enough to sink the score below 40 |

The overall score of a run is the rounded mean of the audit scores, then capped: at 39 when any
audit that ran has a counted critical finding, otherwise at 69 when any audit has a counted high
finding. The report shows the mean, the cap, and the result as separate steps.

## Why these numbers

The weights are chosen so that the bands mean something a reader can state in one sentence:

- **A confirmed critical problem always lands in the poor band.** Forty points alone would leave 60; the cap at 39 makes the rule unconditional.
- **A confirmed high problem can never be green.** Fifteen points alone would leave 85; the cap at 69 makes "good" mean "no known high-severity problem".
- **Medium findings together deduct at most 30, so thoroughness is not punished.** Each costs six points; without a limit, the more carefully the audit looks, the more medium findings it reports and the lower the score falls — the careful audit would score a repository below the shallow one, exactly as the low findings once did. The limit is chosen so medium findings alone can never push the score out of the good band (100 − 30 = 70), the same idea as the 14-point limit for low findings.
- **Low problems are noise, and stay noise.** Each costs two points and all of them together at most fourteen, which is less than one high finding. Without this limit a more thorough audit, which finds more small things, would score a repository lower than a shallow one. The first real run showed exactly that: fourteen low findings alone cost 28 points.
- **Each step is roughly 2.5–3× the one below it**, so one finding of a higher severity always outweighs two of the next lower one.

The overall score inherits the per-audit caps because the per-audit formula makes two promises —
a counted critical finding means the poor band, and a counted high finding is never good — that a
plain mean would break: one audit holding a critical finding, averaged with clean audits, would
read "good". With the caps, one rule holds at both levels: a counted critical means poor, and a
counted high can never be good.

Deductions stay linear apart from the aggregate limits and caps above, so anyone can redo the
arithmetic from the findings list. The report prints every step, including each limit and cap.

## Comparing scores

Scores are comparable between two runs only when the rubric version and the scoring version are
the same. The report says so when they differ. A higher score on a later run can mean the code
improved or that the later run found less; the per-finding comparison (`fixed`, `still present`,
`new`, `missed earlier`, `not reproduced`) tells which.

## Changing the formula

## Versions

- `1` — initial weights and caps.
- `2` — low findings together deduct at most 14.
- `3` — medium findings together deduct at most 30; the overall score inherits the per-audit caps (39 with a counted critical finding, 69 with a counted high finding).

Any change to weights, caps, bands, or counting rules bumps `SCORING_VERSION` in
`cli/lib/score.mjs`, this file, and the tests in the same commit.
