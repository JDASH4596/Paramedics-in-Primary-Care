/* Adult teaching support. Policy and source provenance: docs/bloods-engine.md.
 * Pure evaluation: absent/invalid companions never suppress valid safety alerts.
 */
(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  else root.BloodsEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";
  const fields = {
    hb:["Hb","g/L"], wcc:["WCC","×10⁹/L"], neut:["Neutrophils","×10⁹/L"],
    lymph:["Lymphocytes","×10⁹/L"], platelets:["Platelets","×10⁹/L"],
    rbc:["RBC","×10¹²/L"], hct:["Haematocrit","L/L"], mch:["MCH","pg"],
    mchc:["MCHC","g/L"], mcv:["MCV","fL"], ferritin:["Ferritin","µg/L"],
    b12:["Total B12","selected units"], folate:["Folate","µg/L"], tsh:["TSH","mU/L"],
    hba1c:["HbA1c","mmol/mol"], bnp:["Natriuretic peptide","ng/L (pg/mL)"],
    cr:["Creatinine","µmol/L"], egfr:["eGFR","mL/min/1.73m²"],
    sodium:["Sodium","mmol/L"], potassium:["Potassium","mmol/L"],
    calcium:["Adjusted calcium","mmol/L"], alt:["ALT","U/L"], alp:["ALP","U/L"],
    ggt:["GGT","U/L"], bili:["Bilirubin","µmol/L"], albumin:["Albumin","g/L"],
    crp:["CRP","mg/L"], baselineCr:["Baseline creatinine","µmol/L"],
    elapsedHours:["Hours since baseline sample","hours"], hbLow:["Hb lower limit","g/L"],
    hbHigh:["Hb upper limit","g/L"], altUln:["ALT upper limit","U/L"],
    alpUln:["ALP upper limit","U/L"], ggtUln:["GGT upper limit","U/L"],
    calciumLow:["Adjusted calcium lower limit","mmol/L"],
    calciumHigh:["Adjusted calcium upper limit","mmol/L"],
    ferritinUln:["Ferritin upper limit","µg/L"]
  };
  const contextFields = new Set(["baselineCr","elapsedHours","hbLow","hbHigh","altUln",
    "alpUln","ggtUln","calciumLow","calciumHigh","ferritinUln"]);
  const positiveFields = new Set(["baselineCr","elapsedHours","hbLow","hbHigh","altUln",
    "alpUln","ggtUln","calciumLow","calciumHigh","ferritinUln","hb","mcv","hct",
    "mch","mchc","cr","sodium","potassium","calcium","albumin"]);
  const symptomKeys = ["unstable","fever","bleeding","neuro","oliguria","jaundice",
    "hyperglycaemia","b12Neuro","abnormalFilm","lowCalciumSymptoms","labCritical","akiReport"];
  const levels = ["Limited assessment — review results in clinical context",
    "Clinical review and follow-up required","Prompt clinical review",
    "Urgent same-day clinical assessment","Emergency assessment now"];

  function evaluate(raw = {}){
    const v = {}, errors = [], missing = [], limitations = [], findings = [], actions = [], alerts = [];
    let level = 0;
    const add = (code, text, action, urgency = 1) => {
      findings.push({code, text});
      if(action) actions.push(action);
      if(urgency >= 2) alerts.push({code, text, action, level:urgency});
      level = Math.max(level, urgency);
    };
    for(const [key, [label, unit]] of Object.entries(fields)){
      const input = raw[key];
      if(input === undefined || input === null || String(input).trim() === ""){
        v[key] = null; continue;
      }
      const str = String(input).trim();
      const number = /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(str) ? Number(str) : NaN;
      if(!Number.isFinite(number) || number < 0 || (positiveFields.has(key) && number === 0) ||
          (key === "hct" && number > 1)){
        errors.push({field:key, text:label + ": enter a valid " + (positiveFields.has(key) ? "positive" : "non-negative") + " number in " + unit + "."});
        v[key] = null;
      } else v[key] = number;
    }
    function bounds(lowKey, highKey){
      if(v[lowKey] !== null && v[highKey] !== null && v[lowKey] >= v[highKey]){
        errors.push({field:highKey, text:"The upper reference limit must exceed the lower limit."});
        v[lowKey] = v[highKey] = null;
      }
    }
    bounds("hbLow","hbHigh"); bounds("calciumLow","calciumHigh");
    const resultCount = Object.keys(fields).filter(k => !contextFields.has(k) && v[k] !== null).length;
    const anyRaw = Object.keys(fields).some(k => raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== "");
    const symptoms = Object.fromEntries(symptomKeys.map(k => [k, raw[k] === true]));
    const symptomsKnown = ["checked","none"].includes(raw.symptomStatus);
    if(!symptomsKnown) limitations.push("Red-flag symptoms have not been assessed; urgency may be higher than the numeric result suggests.");
    if(raw.symptomStatus === "none" && Object.values(symptoms).some(Boolean)){
      errors.push({field:"symptomStatus",text:"Symptoms are selected but the assessment says none. Selected symptoms take priority."});
    }
    limitations.push("This is a limited adult teaching assessment, not a diagnosis or clearance. Use laboratory critical flags and your local pathway; unmodelled causes remain possible.");

    // Clinical emergency overrides run even without any numerical results.
    if(symptoms.unstable || symptoms.neuro || symptoms.bleeding)
      add("CLINICAL_EMERGENCY","Severe symptoms: instability/chest pain/breathlessness at rest, seizure/reduced consciousness, or significant active bleeding.",
        "Arrange emergency clinical assessment now; use the emergency services pathway if unstable. Do not wait for more blood results.",4);
    if(symptoms.hyperglycaemia)
      add("GLYCAEMIC_EMERGENCY","Acute hyperglycaemic emergency features cannot be assessed using HbA1c.",
        "Arrange same-day assessment with immediate glucose/ketones and observations; use emergency care if vomiting, drowsy or clinically unstable.",3);
    if(symptoms.oliguria)
      add("OLIGURIA","New markedly reduced urine output: possible AKI or obstruction.",
        "Arrange same-day assessment; review volume status, obstruction, medicines and AKI complications.",3);
    if(symptoms.jaundice)
      add("JAUNDICE","New jaundice or concerning hepatobiliary symptoms.",
        "Arrange same-day clinical assessment; fever, severe pain, confusion or instability require emergency care.",3);
    if(symptoms.abnormalFilm)
      add("ABNORMAL_FILM","Laboratory report flags blasts or a concerning blood film.",
        "Discuss urgently with haematology today; follow the laboratory's immediate advice.",3);
    if(symptoms.labCritical)
      add("LAB_CRITICAL","Laboratory critical-result flag or urgent laboratory advice.",
        "Act on the laboratory's advice immediately; arrange same-day or emergency assessment as directed, even if this engine has no rule for that marker.",3);
    if(symptoms.akiReport)
      add("LAB_AKI","Laboratory AKI alert reported.",
        "Arrange same-day clinical assessment and review the alert stage, recent trend, urine output and complications; do not dismiss it because one creatinine appears within range.",3);
    if(symptoms.lowCalciumSymptoms && v.calcium === null)
      add("CA_SYMPTOMS","Possible hypocalcaemic symptoms; no valid adjusted calcium result supplied.",
        "Arrange urgent clinical assessment with ECG and calcium/magnesium testing; significant tetany or deterioration needs emergency care.",3);
    if(symptoms.fever){
      if(v.neut !== null && v.neut < 1)
        add("NEUTROPENIC_SEPSIS","Fever/systemic illness with neutropenia: possible neutropenic sepsis.",
          "Arrange emergency hospital assessment now; do not wait for repeat FBC.",4);
      else actions.push("Fever/systemic illness: assess observations and sepsis risk now; a normal count or CRP does not exclude sepsis.");
    }
    if(symptoms.b12Neuro)
      add("B12_NEURO","Neurological features with suspected B12 deficiency.",
        "Arrange urgent clinical assessment and prompt B12 treatment per pathway; do not delay for repeat tests or a normal MCV.",3);

    // Safety checks precede scope checks and all pattern/companion requirements.
    if(v.hb !== null && v.hb < 80)
      add("HB_SEVERE","Very low Hb (<80 g/L): potentially severe anaemia.",
        "Arrange same-day clinical assessment/senior discussion. Assess symptoms, bleeding, observations and rate of fall; this is not an automatic transfusion rule.",3);
    if(v.neut !== null && v.neut < 0.5)
      add("NEUT_SEVERE","Severe neutropenia (<0.5 ×10⁹/L).",
        "Urgent same-day assessment/haematology discussion; fever or systemic illness requires emergency hospital assessment.",3);
    if(v.platelets !== null && v.platelets < 30)
      add("PLT_SEVERE","Very low platelets (<30 ×10⁹/L).",
        "Urgent same-day haematology discussion/assessment and repeat/film for clumping. Do not delay hospital care for significant bleeding.",3);
    if(v.potassium !== null){
      if(v.potassium >= 6.5)
        add("K_SEVERE_HIGH","Severe hyperkalaemia (K ≥6.5 mmol/L).",
          "Arrange immediate hospital assessment and treatment. ECG/confirmation should be arranged without delaying escalation; do not wait to exclude haemolysis.",4);
      else if(v.potassium >= 6)
        add("K_MODERATE_HIGH","Moderate hyperkalaemia (K 6.0 to <6.5 mmol/L).",
          "Arrange same-day clinical review and repeat within 1 day; review medicines, renal trend and ECG need. Hospital assessment if acutely unwell, AKI, ECG changes or rapid rise.",3);
      else if(v.potassium >= 5.5)
        add("K_MILD_HIGH","Mild hyperkalaemia (K 5.5 to <6.0 mmol/L).",
          "If unexpected, repeat within 3 days or sooner per local pathway; review medicines/renal function. Hospital assessment if acutely unwell or AKI.",2);
      else if(v.potassium > 5)
        add("K_BORDERLINE_HIGH","Potassium above the indicative upper reference limit.",
          "Check laboratory range, trend, medicines and sampling quality; review treatment safety and arrange repeat as indicated.");
      else if(v.potassium < 2.5)
        add("K_SEVERE_LOW","Severe hypokalaemia (K <2.5 mmol/L).",
          "Arrange emergency hospital assessment with ECG and magnesium/renal review; do not prescribe replacement solely from this tool.",4);
      else if(v.potassium < 3)
        add("K_MODERATE_LOW","Moderate hypokalaemia (K 2.5 to <3.0 mmol/L).",
          "Arrange same-day review, ECG/risk assessment and magnesium/medicine review; follow local replacement and repeat pathway.",3);
      else if(v.potassium < 3.5)
        add("K_MILD_LOW","Mild hypokalaemia (K 3.0 to <3.5 mmol/L).",
          "Review losses, medicines, magnesium and cardiac risk; arrange prompt repeat/treatment per pathway.",2);
    }
    if(v.sodium !== null){
      if(v.sodium < 125)
        add("NA_PROFOUND_LOW","Profound hyponatraemia (Na <125 mmol/L).",
          "Arrange urgent same-day assessment and discuss hospital management; neurological symptoms require emergency care. Establish acuity and cause; do not attempt correction using this tool.",3);
      else if(v.sodium < 130)
        add("NA_MODERATE_LOW","Moderate hyponatraemia (Na 125 to <130 mmol/L).",
          "Arrange same-day clinical review; assess symptoms, trend, volume status and medicines. Severe neurological symptoms require emergency care.",3);
      else if(v.sodium < 135)
        add("NA_MILD_LOW","Mild hyponatraemia (Na 130 to <135 mmol/L).",
          "Review symptoms, volume status, medicines and trend promptly; repeat timing per local pathway. Acute deterioration or severe symptoms overrides this band.",2);
      else if(v.sodium >= 160)
        add("NA_SEVERE_HIGH","Marked hypernatraemia (Na ≥160 mmol/L).",
          "Arrange emergency hospital assessment; evaluate hydration/access to fluids and acuity. Do not attempt rapid correction using this tool.",4);
      else if(v.sodium >= 150)
        add("NA_HIGH","Hypernatraemia (Na 150 to <160 mmol/L).",
          "Arrange same-day clinical assessment of hydration, acuity and cause; discuss hospital assessment per local pathway.",3);
      else if(v.sodium > 145)
        add("NA_MILD_HIGH","Sodium above the indicative reference range.",
          "Review hydration, losses, access to fluids and trend; arrange prompt repeat/clinical review.",2);
    }
    const caLow = v.calciumLow ?? 2.2, caHigh = v.calciumHigh ?? 2.6;
    if(v.calcium !== null){
      if(v.calcium < 1.9 || (v.calcium < caLow && symptoms.lowCalciumSymptoms))
        add("CA_SEVERE_LOW","Severe or symptomatic hypocalcaemia.",
          "Arrange emergency hospital assessment (adjusted Ca <1.9 mmol/L or symptoms below the reference range); ECG and magnesium assessment are needed.",4);
      else if(v.calcium < caLow)
        add("CA_LOW","Adjusted calcium below the reference range.",
          "Review symptoms and repeat/confirm; consider magnesium, vitamin D, PTH and renal context. New tetany/spasm or significant symptoms requires emergency assessment.",2);
      else if(v.calcium > 3.5)
        add("CA_SEVERE_HIGH","Severe hypercalcaemia (adjusted Ca >3.5 mmol/L).",
          "Arrange emergency hospital assessment and urgent treatment; review hydration, ECG and renal function.",4);
      else if(v.calcium >= 3)
        add("CA_HIGH","Significant hypercalcaemia (adjusted Ca 3.0–3.5 mmol/L).",
          "Arrange urgent same-day assessment; prompt treatment is usually indicated. Acuity, symptoms and renal impairment determine hospital care.",3);
      else if(v.calcium > caHigh)
        add("CA_MILD_HIGH","Adjusted calcium above the reference range.",
          "Review symptoms, hydration and medicines; repeat and investigate PTH/cause per pathway.",2);
      if(v.calciumLow === null || v.calciumHigh === null)
        limitations.push("Calcium uses indicative limits 2.2–2.6 mmol/L unless supplied. Enter an already adjusted result; the tool does not calculate albumin correction.");
    }
    if(v.egfr !== null && v.egfr < 15)
      add("RENAL_SEVERE","Severely reduced eGFR (<15); acuity is not established.",
        "If new or baseline unknown, arrange same-day assessment/senior discussion. For established stable advanced CKD, follow the documented renal plan; assess AKI complications urgently.",3);
    if(v.cr !== null && v.cr >= 300)
      add("CR_MARKED","Marked creatinine elevation (≥300 µmol/L); this alone does not diagnose AKI.",
        "Establish baseline and acuity today; if new/unknown, arrange same-day clinical assessment. Known stable CKD needs its documented renal plan.",3);
    if(v.cr !== null && v.baselineCr !== null && v.elapsedHours !== null){
      const delta = v.cr - v.baselineCr, ratio = v.cr / v.baselineCr;
      if((v.elapsedHours <= 48 && delta >= 26) || (v.elapsedHours <= 168 && ratio >= 1.5))
        add("AKI","Creatinine change meets a biochemical AKI criterion.",
          "Arrange same-day clinical assessment: observations, urine output/dip, medicines, hydration and obstruction. Escalate complications (hyperkalaemia, pulmonary oedema, severe illness) immediately.",3);
      else if(v.elapsedHours > 168)
        limitations.push("Baseline is over 7 days old: these two samples cannot exclude AKI; obtain recent trend/laboratory AKI alert.");
    } else if(v.cr !== null || v.egfr !== null)
      missing.push("Baseline creatinine and elapsed hours: AKI cannot be assessed or excluded from a single result.");
    if(v.alt !== null && v.alt >= 1000)
      add("ALT_MARKED","Marked ALT elevation (≥1000 U/L).",
        "Arrange same-day clinical assessment/specialist discussion; assess acute hepatitis, drug injury, symptoms and synthetic function. Confusion/instability requires emergency care.",3);

    const out = () => ({
      level, severity:levels[level], findings, actions:[...new Set(actions)], alerts,
      errors, missing:[...new Set(missing)], limitations:[...new Set(limitations)],
      resultCount, empty:!anyRaw && !Object.values(symptoms).some(Boolean)
    });
    if(raw.scope !== "adult"){
      limitations.push(raw.scope === "outside" ?
        "Outside scope: do not apply adult patterns to children or pregnancy. Use the appropriate age/pregnancy pathway." :
        "Confirm that this is an adult (18+) who is not pregnant before using adult pattern interpretation.");
      if(alerts.length) limitations.push("Potential urgent values/symptoms are still highlighted; scope-specific clinical assessment is required.");
      return out();
    }

    // Adult pattern interpretation does not require unrelated input pairs.
    const hbLow = v.hbLow ?? (raw.sex === "male" ? 130 : raw.sex === "female" ? 115 : null);
    const hbHigh = v.hbHigh ?? (raw.sex === "male" ? 180 : raw.sex === "female" ? 165 : null);
    if(v.hb !== null){
      if(hbLow === null) missing.push("Select the applicable Hb reference range or enter the laboratory lower/upper limits.");
      else if(v.hb < hbLow){
        if(v.mcv === null){
          add("ANAEMIA_UNCLASSIFIED","Anaemia; morphology cannot be classified without MCV.",
            "Add MCV/haematinics as indicated; assess symptoms, blood loss and Hb trend.");
          missing.push("MCV is needed to classify the anaemia pattern.");
        } else if(v.mcv < 80)
          add("ANAEMIA_MICRO","Microcytic anaemia pattern.",
            "Check ferritin + CRP ± transferrin saturation; consider blood loss/iron restriction and thalassaemia trait. Use the relevant GI/menstrual investigation pathway.");
        else if(v.mcv > 100)
          add("ANAEMIA_MACRO","Macrocytic anaemia pattern.",
            "Check total B12/folate, TFTs, medicines, alcohol and liver context; consider reticulocytes/film. Do not delay B12 treatment if neurological features.");
        else
          add("ANAEMIA_NORMO","Normocytic anaemia pattern.",
            "Consider blood loss, early/mixed deficiency, inflammation, renal disease and marrow causes; review reticulocytes/film and trend.");
      } else if(hbHigh !== null && v.hb > hbHigh)
        add("HB_HIGH","Hb above the selected reference range.",
          "Review hydration, hypoxia, smoking and medicines; persistent elevation requires the polycythaemia pathway.");
      if(v.hbLow === null || v.hbHigh === null)
        limitations.push("Hb uses the page's indicative adult ranges (female 115–165, male 130–180 g/L) where selected; these are not universal diagnostic cutoffs. Prefer laboratory limits.");
    }
    if(v.mcv !== null && (v.hb === null || hbLow === null || v.hb >= hbLow)){
      if(v.mcv < 80) add("MCV_LOW","Microcytosis, without confirmed anaemia.",
        "Review Hb/MCH, ferritin/CRP and possible haemoglobinopathy.");
      if(v.mcv > 100) add("MCV_HIGH","Macrocytosis, without confirmed anaemia.",
        "Review B12/folate, thyroid/liver markers, alcohol, medicines and film.");
    }
    const extraRanges = {
      rbc:raw.sex === "male" ? [4.3,5.7] : raw.sex === "female" ? [3.8,5.2] : null,
      hct:raw.sex === "male" ? [0.40,0.52] : raw.sex === "female" ? [0.36,0.46] : null,
      mch:[27,32], mchc:[320,360]
    };
    for(const [key, range] of Object.entries(extraRanges)){
      if(v[key] === null) continue;
      if(!range) missing.push("Applicable reference range needed for " + fields[key][0] + ".");
      else if(v[key] < range[0] || v[key] > range[1])
        add("INDEX_" + key.toUpperCase(),fields[key][0] + " outside the indicative adult range.",
          "Compare with laboratory range and full FBC; this index alone does not determine cause or urgency.");
    }
    if(v.wcc !== null){
      if(v.wcc < 4) add("WCC_LOW","Leukopenia.", "Review differential, medicines, infection symptoms, film and trend.");
      else if(v.wcc > 11) add("WCC_HIGH","Leucocytosis.", "Review differential/film, infection symptoms and persistence; marked unexplained rise needs specialist discussion.");
      if(v.wcc >= 50) add("WCC_MARKED","Marked leucocytosis (≥50 ×10⁹/L).", "Discuss urgently with haematology today and review film/symptoms; do not assume infection.",3);
    }
    if(v.neut !== null){
      if(v.neut >= 0.5 && v.neut < 1) add("NEUT_MODERATE","Moderate neutropenia.", "Arrange prompt clinical review/repeat and haematology advice per pathway; fever/unwell requires emergency hospital assessment.",2);
      else if(v.neut >= 1 && v.neut < 1.5) add("NEUT_MILD","Mild neutropenia.", "Review symptoms, medicines, baseline and local repeat pathway.");
      else if(v.neut >= 1.5 && v.neut < 2) add("NEUT_BORDERLINE","Neutrophils below this page's indicative range.", "Compare with local range and baseline; 1.5–2.0 may be a normal variant.");
      else if(v.neut > 7.5) add("NEUT_HIGH","Neutrophilia.", "Correlate with infection, stress, steroids and clinical picture.");
    }
    if(v.lymph !== null && v.lymph < 1) add("LYMPH_LOW","Lymphopenia.", "Review symptoms, medicines, persistence and other cell lines.");
    if(v.lymph !== null && v.lymph > 4) add("LYMPH_HIGH","Lymphocytosis.", "Review reactive causes and persistence; request film/refer per pathway if unexplained or with red flags.");
    if(v.wcc !== null && ((v.neut !== null && v.neut > v.wcc) || (v.lymph !== null && v.lymph > v.wcc) ||
        (v.neut !== null && v.lymph !== null && v.neut + v.lymph > v.wcc + 0.2)))
      errors.push({field:"wcc",text:"Differential counts exceed total WCC (allowing small rounding). Check units/transcription; valid safety alerts remain active."});
    if(v.platelets !== null){
      if(v.platelets >= 30 && v.platelets < 50) add("PLT_LOW_URGENT","Platelets 30 to <50 ×10⁹/L.", "Arrange same-day clinical/haematology review; assess bleeding, medicines, film and clumping.",3);
      else if(v.platelets >= 50 && v.platelets < 150) add("PLT_LOW","Thrombocytopenia.", "Assess bleeding, medicines and trend; repeat/film to exclude clumping, with referral/repeat timing per pathway.",2);
      else if(v.platelets > 400) add("PLT_HIGH","Thrombocytosis.", "Check iron deficiency/inflammation and persistence; do not assume reactive cause.");
      if(v.platelets >= 1000) add("PLT_MARKED_HIGH","Marked thrombocytosis (≥1000 ×10⁹/L).", "Discuss urgently with haematology today; assess thrombotic/bleeding symptoms.",3);
    }
    const lowLines = [v.hb !== null && hbLow !== null && v.hb < hbLow,
      (v.wcc !== null && v.wcc < 4) || (v.neut !== null && v.neut < 1.5),
      v.platelets !== null && v.platelets < 150].filter(Boolean).length;
    if(lowLines >= 2) add("MULTIPLE_CYTOPENIAS",lowLines === 3 ? "Pancytopenia pattern." : "Multiple cytopenias.",
      "Arrange same-day senior/haematology discussion, film and cause assessment; assess clinical urgency.",3);
    if(v.egfr !== null && v.egfr < 60)
      add("EGFR_LOW","Reduced eGFR (<60).",
        "Review baseline, medicines, BP and urine ACR. CKD requires persistence ≥3 months or other qualifying kidney damage; one result cannot establish CKD.");
    if(v.cr !== null && v.cr > 104 && v.cr < 300)
      add("CR_HIGH","Creatinine above this page's indicative range.",
        "Use the laboratory range and baseline; AKI may occur below an absolute creatinine cutoff.");
    if(v.ferritin !== null){
      if(v.ferritin < 30) add("IRON_LOW","Low ferritin suggests iron deficiency.",
        "Review Hb/MCV, source of blood loss and malabsorption; treat and monitor response per pathway. Red-flag GI symptoms need appropriate referral.");
      else add("IRON_CONTEXT","Ferritin ≥30 does not by itself exclude iron deficiency.",
        "Interpret with laboratory range, FBC and inflammation; consider transferrin saturation if iron restriction remains suspected.");
      if(v.ferritinUln === null) missing.push("Laboratory ferritin upper limit is needed to identify high ferritin.");
      else if(v.ferritin > v.ferritinUln) add("FERRITIN_HIGH","Ferritin above the laboratory upper limit.",
        "Review inflammation, liver/metabolic disease and iron studies; assess transferrin saturation and follow high-ferritin pathway.");
    }
    if(v.b12 !== null){
      const unit = raw.b12Unit;
      if(!["ng/L","pmol/L"].includes(unit)) errors.push({field:"b12Unit",text:"Select total B12 units (ng/L or pmol/L); active B12 is a different assay."});
      else {
        const low = unit === "ng/L" ? 180 : 133, high = unit === "ng/L" ? 350 : 258;
        if(v.b12 < low) add("B12_LOW","Total B12 in the deficiency range.", "Assess cause and symptoms; replace per pathway. Use validated assay/laboratory cutoffs.");
        else if(v.b12 <= high) add("B12_INDETERMINATE","Indeterminate total B12: possible deficiency.",
          "Assess symptoms/risk factors and consider MMA or treatment per NICE/local pathway; do not dismiss deficiency because MCV is normal.");
        else add("B12_ABOVE_BAND","Total B12 above the indicative indeterminate band.",
          "Interpret with assay, supplements and symptoms; persistent neurological concern needs clinical assessment.");
      }
    }
    if(v.folate !== null && v.folate <= 4) add("FOLATE_LOW","Folate low/borderline against the indicative >4 µg/L range.",
      "Check laboratory cutoff and B12 status; exclude or treat B12 deficiency before folate alone. Replace confirmed deficiency per pathway.");
    if(v.tsh !== null && (v.tsh > 4 || v.tsh < 0.4))
      add("TSH_ABNORMAL",v.tsh > 4 ? "Raised TSH." : "Suppressed TSH.",
        "Correlate with symptoms and FT4 (±FT3 for suppressed TSH); use laboratory/local thyroid pathway. TSH alone does not establish the diagnosis.");
    if(v.hba1c !== null){
      if(raw.diabetesStatus === "known") add("HBA1C_MONITOR","HbA1c monitoring in known diabetes.", "Compare with the individualised target, previous result and treatment; this is not a new-diagnosis rule.");
      else if(v.hba1c >= 48) add("HBA1C_DIABETES","Diabetes-range HbA1c.", "If asymptomatic and without known diabetes, confirm per diagnostic pathway; assess symptoms and glycaemic/CV risk management.");
      else if(v.hba1c >= 42) add("HBA1C_RISK","High-risk/prediabetes-range HbA1c.", "Offer lifestyle/risk management and planned monitoring per pathway.");
      else add("HBA1C_BELOW","HbA1c below the high-risk threshold.", "This does not exclude acute/type 1 diabetes; use glucose testing if symptoms or rapid onset.");
      if(raw.diabetesStatus === "unknown" || !raw.diabetesStatus) missing.push("Known diabetes status: distinguish diagnosis from monitoring.");
      if(raw.hba1cUnreliable === true || (v.hb !== null && hbLow !== null && v.hb < hbLow) ||
          (v.ferritin !== null && v.ferritin < 30) || (v.b12 !== null && v.b12 < (raw.b12Unit === "pmol/L" ? 133 : 180)))
        limitations.push("HbA1c may be unreliable with anaemia/iron or B12 deficiency, altered red-cell survival, haemoglobinopathy, recent transfusion or dialysis. Use the glucose-based pathway when indicated.");
    }
    if(v.bnp !== null){
      if(raw.peptideAssay === "ntprobnp"){
        if(v.bnp > 2000) add("NT_HF_2W","NT-proBNP >2000 ng/L: urgent heart failure diagnostic pathway.",
          "For suspected chronic HF, refer for specialist assessment and echocardiography within 2 weeks. Acute decompensation requires same-day/emergency assessment.",2);
        else if(v.bnp >= 400) add("NT_HF_6W","NT-proBNP 400–2000 ng/L: heart failure diagnostic pathway.",
          "For suspected chronic HF, refer for specialist assessment and echocardiography within 6 weeks. Acute symptoms override outpatient timing.");
        else add("NT_HF_LOW","NT-proBNP <400 ng/L makes chronic HF less likely in an untreated person.",
          "Review alternative causes and discuss persistent suspicion; obesity/treatment can lower levels. This is not an acute HF exclusion rule.");
      } else if(raw.peptideAssay === "bnp")
        add("BNP_LOCAL","BNP entered: NT-proBNP referral cutoffs do not apply.",
          "Use the local BNP assay-specific pathway and clinical assessment; elevated peptides have non-HF causes. Acute decompensation requires same-day/emergency assessment.");
      else {
        errors.push({field:"peptideAssay",text:"Select BNP or NT-proBNP before interpreting the peptide result."});
        missing.push("Natriuretic peptide assay is required; BNP and NT-proBNP are not interchangeable.");
      }
    }
    const liverLimits = {alt:v.altUln,alp:v.alpUln,ggt:v.ggtUln};
    for(const [key, limit] of Object.entries(liverLimits)){
      if(v[key] === null) continue;
      if(limit === null) missing.push("Laboratory " + key.toUpperCase() + " upper limit is needed to classify this result.");
      else if(v[key] > limit) add("LFT_" + key.toUpperCase(),key.toUpperCase() + " above the laboratory upper limit (" + (v[key]/limit).toFixed(1) + "× ULN).",
        "Review symptoms, medicines, alcohol, prior results and liver investigation pathway; magnitude alone does not determine diagnosis.");
    }
    if(v.alp !== null && v.alpUln !== null && v.alp > v.alpUln){
      if((v.bili !== null && v.bili > 21) || (v.ggt !== null && v.ggtUln !== null && v.ggt > v.ggtUln))
        add("LFT_CHOLESTATIC","Raised ALP with bilirubin/GGT elevation supports a hepatobiliary/cholestatic pattern.",
          "Assess jaundice, pain, fever, medicines and imaging need; symptomatic cases require urgent assessment.",2);
      else if(v.ggt !== null && v.ggtUln !== null && v.ggt <= v.ggtUln)
        add("LFT_BONE","Raised ALP with GGT not elevated may indicate a non-hepatic source.",
          "Consider bone/vitamin D context while reviewing the full clinical pattern.");
    }
    if(v.bili !== null && v.bili > 21)
      add("BILI_HIGH","Bilirubin above the indicative range.",
        "Review other LFTs, haemolysis and symptoms; isolated mild elevation may be Gilbert's, but do not assume this without assessment.");
    if(v.albumin !== null && v.albumin < 35) add("ALBUMIN_LOW","Low albumin.",
      "Review inflammation, liver synthetic function (including INR if indicated), renal loss and nutrition.");
    if(v.crp !== null && v.crp > 5) add("CRP_HIGH","CRP elevated.", "Non-specific: correlate with clinical picture; normal CRP does not exclude early serious illness.");
    if(!findings.length && resultCount)
      actions.push("No modelled abnormal pattern identified in the supplied values. Compare every result with its laboratory range; missing context and unmodelled conditions prevent safety clearance.");
    return out();
  }
  return {evaluate, fields, symptomKeys};
});
