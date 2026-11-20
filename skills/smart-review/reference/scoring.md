# Scoring

`smart-review score` checks criterion coverage before computing deductions from confirmed
findings. This file documents scoring version `4`.

## Coverage

Coverage is reported as **assessed / applicable**. Each `scored` criterion counts toward
both numbers, including a criterion rated 0/5. An `unknown` criterion counts only toward
applicable. A criterion marked `na` contributes to neither number.

| Criteria in the section | Result |
|---|---|
| At least one `scored` | A numeric score and band. The report shows how much was assessed. |
| Every criterion is `na` and at least one criterion is recorded | Not applicable (`not-applicable`). |
| No `scored` criteria and at least one `unknown`, or no criteria recorded | Insufficient data (`insufficient-data`). |

An unscored section stores its `reason` and sets `value` and `band` to `null`.
Criterion ratings from 0 to 5 describe individual criteria. Only findings determine deductions.

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

Accepted-risk entries apply only to low and medium severities. A confirmed finding tagged
with several topics still contributes a single deduction.

## Bands

| Score | Band | Meaning |
|---|---|---|
| 70–100 | good | no counted critical or high finding, and medium and low deductions together cost at most 30 points |
| 40–69 | fair | a counted high finding with no critical one, or medium and low findings together costing more than 30 points |
| 0–39 | poor | a counted critical finding, or counted high findings numerous enough to sink the score below 40 |

The overall score starts with the rounded, unweighted mean of numeric section scores.
Reviewed and compatible carried sections each count once. Unscored sections and stale
results are excluded from the mean. Aggregate coverage sums the assessed and applicable
criterion counts across the included review documents, including unscored sections.

A counted critical finding in any included section caps the overall score at 39.
Otherwise, a counted high finding caps it at 69. This includes severe findings in unscored
sections. For example, an assessed section scoring 100 and an unassessed section with a
confirmed high finding give a mean of 100 and an overall score of 69.

With no numeric section scores, the overall score and band are both `null`. The report
shows **Not applicable** only when every included section is explicitly inapplicable.
An empty report or any other combination without a numeric score shows **Insufficient data**.
A known severity cap remains visible even when there is no numeric score to cap.

## Why these numbers

The weights are chosen so that the bands mean something a reader can state in one sentence:

- **A confirmed critical problem always lands in the poor band.** Forty points alone would leave 60; the cap at 39 makes the rule unconditional.
- **A confirmed high problem can never be green.** Fifteen points alone would leave 85; the cap at 69 makes "good" mean "no known high-severity problem".
- **Medium findings together deduct at most 30, so thoroughness is not punished.** Each costs six points; without a limit, the more carefully the section looks, the more medium findings it reports and the lower the score falls — the careful section would score a repository below the shallow one, exactly as the low findings once did. The limit is chosen so medium findings alone can never push the score out of the good band (100 − 30 = 70), the same idea as the 14-point limit for low findings.
- **Low problems are noise, and stay noise.** Each costs two points and all of them together at most fourteen, which is less than one high finding. Without this limit a more thorough section, which finds more small things, would score a repository lower than a shallow one. The first real run showed exactly that: fourteen low findings alone cost 28 points.
- **Each step is roughly 2.5–3× the one below it**, so one finding of a higher severity always outweighs two of the next lower one.

The overall score inherits the per-section caps because the per-section formula makes two promises —
a counted critical finding means the poor band, and a counted high finding is never good — that a
plain mean would break: one section holding a critical finding, averaged with clean sections, would
read "good". With the caps, one rule holds at both levels: a counted critical means poor, and a
counted high can never be good.

Deductions stay linear apart from the aggregate limits and caps above, so anyone can redo the
arithmetic from the findings list. The report prints every step, including each limit and cap.

## Comparing scores

Scores are comparable between two runs only when the rubric version and the scoring version are
the same. The report says so when they differ. A higher score on a later run can mean the code
improved or that the later run found less; the per-finding comparison (`fixed`, `still present`,
`new`, `missed earlier`, `not reproduced`) tells which.

## Versions

- `1` — initial weights and caps.
- `2` — low findings together deduct at most 14.
- `3` — medium findings together deduct at most 30; the overall score inherits the per-section caps (39 with a counted critical finding, 69 with a counted high finding).
- `4` — numeric scores require at least one assessed criterion. Reports retain stored scores when displaying earlier scoring versions.

Any change to weights, caps, bands, or counting rules bumps `SCORING_VERSION` in
`cli/lib/score.mjs`, this file, and the tests in the same commit.
