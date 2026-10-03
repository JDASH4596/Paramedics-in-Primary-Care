# Bloods engine: rules, limitations and verification

## Scope and version

Adult teaching support (18+, not pregnant). Updated 3 October 2026.
The reviewed source was main commit `5d37f97cd3dde2534823b054e0897afbe79b99af`;
`87d7dad1eb1e8254da46972f45be21f959c288c0` identifies its bloods.html blob, not a commit.

This revision corrects software defects and adds conservative safety prompts. It does
not constitute clinical validation or local pathway approval. Clinical governance
review is required before relying on it for patient management. The page is a teaching
aid; laboratory critical alerts, observations, symptoms and local pathways take precedence.

## Evaluation contract

1. Validate every supplied value; distinguish missing, invalid and valid zero counts.
2. Evaluate clinical emergency features and standalone numeric safety alerts.
3. If adult scope is unknown/outside scope, stop adult pattern interpretation. Retain
   potential safety warnings with an explicit scope limitation.
4. Interpret each supported marker and available related patterns. Missing companion
   tests limit interpretation but never suppress an urgent result.
5. Return the highest urgency, all findings/actions, invalid fields, missing information
   and limitations. Normal companion values cannot downgrade an existing alert.

There is deliberately no green safety clearance. Editing any result or context field
invalidates the previous output. Clear resets all results, reference limits and clinical
context to blank/unknown. If bloods-engine.js fails to load, the page reports that the
engine is unavailable instead of attempting interpretation.

## Inputs

Use the units stated on the page, with decimal points. B12 requires total-assay unit
selection (ng/L = pg/mL, or pmol/L); active B12 is not supported. BNP and NT-proBNP
require separate assay selection, with results in ng/L = pg/mL. Adjusted calcium must
already be adjusted by the laboratory; no albumin correction is calculated.

Plain finite non-negative numerical results are accepted. Physiologically positive
quantities and reference limits must exceed zero. Zero WCC/neutrophil/platelet counts
remain valid and trigger the relevant safety rules. Haematocrit must be expressed as
L/L (not percentage). Reversed reference limits and clearly inconsistent WCC/differential
counts generate errors without suppressing other valid urgent alerts.

Validation cannot identify every wrong unit or plausible transcription error. Values
reported as inequalities (for example eGFR >90) cannot be entered as exact numbers:
leave them blank, inspect the original laboratory report and interpret it clinically.
Do not substitute the bound as if it were the measured value. HbA1c in percent is not
supported. Clinical context is not inferred from a normal numerical result.

Hb, RBC and haematocrit use an explicitly selected indicative adult reference range.
Laboratory Hb lower/upper limits override the Hb defaults. Defaults preserve the
page's female 115–165/male 130–180 g/L values for consistency, not as universal
diagnostic cutoffs. Calcium defaults to 2.2–2.6 mmol/L with lab overrides.
ALT, ALP, GGT and high ferritin classification require laboratory upper limits.

Renal trend requires baseline creatinine and hours between samples (48h = 2 days,
168h = 7 days). A baseline older than seven days cannot exclude AKI using these two
samples. The tool does not stage AKI or calculate eGFR.

## Rules and provenance

The thresholds below distinguish guideline bands from conservative teaching review
prompts. They are not interchangeable with local referral/admission rules.

| Area | Rule implemented | Source / qualification |
| --- | --- | --- |
| Hyperkalaemia | 5.5 to <6.0 mild; unexpected community result repeat within 3 days. 6.0 to <6.5 moderate; same-day review and repeat within 1 day. ≥6.5 emergency hospital assessment. Acute illness/AKI can require hospital assessment below 6.5. | [UK Kidney Association, 2023, guidelines 1.2 and 4](https://guidelines.ukkidney.org/hyperkalaemia/). Confirmation must not delay emergency escalation. Decimal bands are continuous. |
| Hypokalaemia | <2.5 emergency hospital assessment; 2.5 to <3.0 same-day assessment; 3.0 to <3.5 prompt review. | [NHS SPS](https://sps.nhs.uk/articles/hypokalaemia/). Review timeframes are conservative teaching prompts; no replacement dosing supplied. |
| Hyponatraemia | <125 profound; 125 to <130 moderate; 130 to <135 mild. Moderate/profound prompts same-day assessment. Severe neurological features prompt emergency care regardless of numerical band. | [Society for Endocrinology, 2022](https://www.endocrinology.org/media/xhrhxhxm/emergency-management-of-severe-and-moderately-severely-symptomatic-hyponatraemia-in-adult-patients-2022.pdf). Symptoms/acuity determine treatment. |
| Hypernatraemia | >145 prompts review; ≥150 same-day; ≥160 emergency assessment. | Conservative teaching triggers; [NHS Lothian](https://www.rightdecisions.scot.nhs.uk/electrolyte-disturbance/hypernatraemia/) describes >160 as severe. The engine escalates at 160 deliberately; no correction calculation provided. |
| Hypocalcaemia | <1.9 or symptomatic below lab lower limit: emergency assessment. Other low values prompt review. | [Society for Endocrinology corrected guidance](https://pmc.ncbi.nlm.nih.gov/articles/PMC8117371/). |
| Hypercalcaemia | 3.0–3.5 same-day assessment; >3.5 emergency. Lesser elevation requires review/investigation. | [Society for Endocrinology](https://pmc.ncbi.nlm.nih.gov/articles/PMC5314807/). Preserve the original ≥3.0 alert, clarify grading and destination. |
| Anaemia | Hb <80 prompts same-day assessment/senior discussion independent of MCV. Symptoms override the number. Missing MCV produces unclassified anaemia. | Conservative teaching prompt informed by [NHS Borders macrocytic anaemia pathway](https://www.rightdecisions.scot.nhs.uk/borders-ref-help-toolkit/haematology/anaemia/anaemia-macrocytic/). Does not prescribe transfusion. |
| Neutropenia | <0.5 same-day haematology/assessment; 0.5 to <1 prompt review; 1 to <1.5 mild. Fever/systemic illness with <1 prompts emergency hospital assessment. | [NHS Highland neutropenia pathway](https://www.rightdecisions.scot.nhs.uk/tam-treatments-and-medicines-nhs-highland/adult-therapeutic-guidelines/haematology/neutropenia-guidelines/). 1.5–2.0 may be a normal variant despite the page's indicative range. |
| Platelets | <30 urgent same-day discussion/assessment; 30 to <50 same-day review; 50 to <150 review and repeat/film; >400 investigate/reactive-vs-persistent assessment. ≥1000 prompts same-day specialist discussion. | [NHS Highland thrombocytopenia](https://www.rightdecisions.scot.nhs.uk/tam-treatments-and-medicines-nhs-highland/therapeutic-guidelines/haematology/thrombocytopenia-guidelines/). <50 and ≥1000 timeframes are conservative teaching prompts requiring local approval. Significant bleeding is an emergency override. |
| WCC / cell lines | Recognises low WCC, high WCC, lymphopenia/lymphocytosis, indices, multiple cytopenias and concerning films. WCC ≥50 and multiple cytopenias prompt same-day discussion. | Conservative teaching prompts, aligned with the existing page's film/malignancy safety guidance. Not diagnostic of malignancy; use local haematology pathway. |
| AKI | Creatinine rise ≥26 µmol/L within 48h or ≥50% within 7 days: suspected biochemical AKI, same-day clinical assessment. | [NICE NG148](https://www.nice.org.uk/guidance/ng148/chapter/Recommendations). Urine output/complications can establish urgency without these values. |
| Severe renal impairment | eGFR <15 or creatinine ≥300 prompts establishment of acuity today; new/unknown abnormality needs same-day assessment. Known stable advanced CKD follows its documented renal plan. | Conservative review prompts, not AKI diagnostic cutoffs. Low eGFR alone cannot establish CKD; chronicity ≥3 months or qualifying kidney damage matters. |
| Natriuretic peptides | NT-proBNP <400: chronic HF less likely if untreated; 400–2000: assessment/echo within 6 weeks; >2000: within 2 weeks. BNP uses local assay pathway. | [NICE NG106](https://www.nice.org.uk/guidance/ng106/chapter/recommendations). Applies to suspected chronic HF. Acute decompensation overrides outpatient timing. Peptides are not specific for HF. |
| Total B12 | <180 ng/L / <133 pmol/L deficiency band; 180–350 ng/L / 133–258 pmol/L indeterminate. Symptoms/risk and assay validation govern assessment. | [NICE NG239](https://www.nice.org.uk/guidance/ng239/chapter/recommendations). Neurological concern prompts urgent assessment/treatment even without anaemia. |
| Folate | ≤4 µg/L low/borderline against the page's indicative >4 range. Standalone interpretation allowed. | Check laboratory cutoff. Exclude/treat B12 deficiency before folate alone, consistent with existing guidance. |
| Ferritin | <30 suggests deficiency. ≥30 cannot exclude inflammatory iron restriction. Lab upper limit determines high ferritin. | Existing page's ferritin + CRP ± transferrin saturation framework. No blanket 30–400 normal-range assertion. |
| LFTs | Report any result above supplied lab ULN; ALP with high GGT/bilirubin supports cholestatic pattern. ALT ≥1000 prompts same-day clinical/specialist assessment. Jaundice/concerning symptoms override numeric rules. | [BSG abnormal liver blood tests guideline](https://doi.org/10.1136/gutjnl-2017-314924). ≥1000 is a conservative review prompt, not a complete severity score; INR/synthetic failure are not modelled. |
| HbA1c | 42 to <48 high-risk band; ≥48 diabetes-range when not established diabetes. Known diabetes uses monitoring output. Acute hyperglycaemic symptoms trigger same-day glucose/ketone assessment. | Existing page's diagnostic/monitoring distinction; [NHS Borders diagnosis guidance](https://www.rightdecisions.scot.nhs.uk/borders-ref-help-toolkit-in-development/diabetes/diabetes-diagnosis/) for unreliable HbA1c contexts. Confirmation and targets are pathway-specific. |

Other unsupported/context-dependent matters include pregnancy/paediatrics, active B12,
complete blood-film interpretation, acute glucose values, INR, magnesium, phosphate,
all drug interactions, referral eligibility, treatment dosing and cause-specific
management. Normal CRP or counts cannot exclude serious illness. Red-flag GI symptoms
need the appropriate referral pathway; this tool does not assess cancer referral criteria.

## Verification

Run the dependency-free pure-rule regression suite with:

```sh
node --test tests/bloods-engine.test.cjs
```

The workflow runs that command on relevant pull requests and main-branch updates.
Tests cover exact threshold boundaries, standalone emergencies, valid zero counts,
invalid inputs alongside urgent results, absent MCV, AKI time windows, B12 units,
BNP/NT-proBNP separation, HbA1c diagnosis-vs-monitoring, lab limits, scope restrictions,
symptom overrides and urgency invariance.

Browser smoke checks should additionally verify: module loading/failure, run/clear,
invalid-field highlighting, result invalidation after input/context edits, keyboard
access, reference-card filtering/expansion and mobile layout. Pure-rule test success
does not prove browser behaviour or clinical safety. Require a clinician to review
the rule table, escalation wording and applicable local pathways before release.

Implementation verification: 156 Node tests passed, including adapter checks in a
minimal DOM harness (rendering, bad numeric input, invalid-field highlighting,
input/context invalidation, clear/reset, module failure and escaping). HTML checks
confirmed unique IDs and valid label targets. Real-browser/mobile visual checks
were not completed: no Chromium executable was installed and the browser download
failed. The DOM harness does not substitute for those browser checks.
