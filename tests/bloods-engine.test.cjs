const {test} = require("node:test");
const assert = require("node:assert/strict");
const {evaluate, fields} = require("../bloods-engine.js");
const run = input => evaluate({scope:"adult", sex:"female", symptomStatus:"none", ...input});
const has = (r, code) => r.findings.some(f => f.code === code);
function expectCode(input, code, level){
  const r = run(input);
  assert.ok(has(r, code), code + ": " + JSON.stringify(r));
  if(level !== undefined) assert.equal(r.level, level);
  return r;
}

test("empty and reference-only inputs do not masquerade as results", () => {
  assert.equal(run({}).empty, true);
  const r = run({altUln:40});
  assert.equal(r.resultCount, 0);
  assert.equal(r.level, 0);
});
for(const [input, code, level] of [
  [{potassium:6.5},"K_SEVERE_HIGH",4],
  [{sodium:120},"NA_PROFOUND_LOW",3],
  [{hb:60},"HB_SEVERE",3],
  [{platelets:10},"PLT_SEVERE",3],
  [{neut:0.2},"NEUT_SEVERE",3],
  [{calcium:1.7},"CA_SEVERE_LOW",4],
  [{cr:500},"CR_MARKED",3],
  [{egfr:9},"RENAL_SEVERE",3],
  [{alt:1000},"ALT_MARKED",3]
]){
  test("standalone critical alert: " + code, () => {
    const r = expectCode(input,code,level);
    assert.ok(r.actions.length);
    assert.equal(evaluate(input).level,level, "unknown scope must not suppress safety");
    assert.equal(evaluate({...input,scope:"outside"}).level,level);
  });
}
test("original missed severe FBC regression", () => {
  const r = run({hb:130,mcv:90,platelets:10,neut:0.2,wcc:1});
  assert.equal(r.level,3);
  for(const code of ["PLT_SEVERE","NEUT_SEVERE","WCC_LOW","MULTIPLE_CYTOPENIAS"])
    assert.ok(has(r,code));
});
test("both dangerous electrolyte directions remain visible", () => {
  const r = run({sodium:160,potassium:2.4});
  assert.equal(r.level,4);
  assert.ok(has(r,"NA_SEVERE_HIGH") && has(r,"K_SEVERE_LOW"));
});
for(const [value, code, level] of [
  [2.49,"K_SEVERE_LOW",4],[2.5,"K_MODERATE_LOW",3],[2.99,"K_MODERATE_LOW",3],
  [3,"K_MILD_LOW",2],[3.49,"K_MILD_LOW",2],
  [5.01,"K_BORDERLINE_HIGH",1],[5.49,"K_BORDERLINE_HIGH",1],
  [5.5,"K_MILD_HIGH",2],[5.9,"K_MILD_HIGH",2],[5.99,"K_MILD_HIGH",2],
  [6,"K_MODERATE_HIGH",3],[6.4,"K_MODERATE_HIGH",3],[6.49,"K_MODERATE_HIGH",3],
  [6.5,"K_SEVERE_HIGH",4]
]) test("potassium boundary " + value, () => expectCode({potassium:value},code,level));
for(const value of [3.5,5]) test("potassium normal edge " + value, () => assert.equal(run({potassium:value}).level,0));
for(const [value,code,level] of [
  [124.99,"NA_PROFOUND_LOW",3],[125,"NA_MODERATE_LOW",3],[129,"NA_MODERATE_LOW",3],
  [130,"NA_MILD_LOW",2],[134.99,"NA_MILD_LOW",2],
  [145.01,"NA_MILD_HIGH",2],[149.99,"NA_MILD_HIGH",2],[150,"NA_HIGH",3],
  [159.99,"NA_HIGH",3],[160,"NA_SEVERE_HIGH",4]
]) test("sodium boundary " + value, () => expectCode({sodium:value},code,level));
for(const value of [135,145]) test("sodium normal edge " + value, () => assert.equal(run({sodium:value}).level,0));
for(const [value,code,level] of [
  [1.89,"CA_SEVERE_LOW",4],[1.9,"CA_LOW",2],[2.1,"CA_LOW",2],[2.19,"CA_LOW",2],
  [2.61,"CA_MILD_HIGH",2],[2.99,"CA_MILD_HIGH",2],[3,"CA_HIGH",3],
  [3.5,"CA_HIGH",3],[3.51,"CA_SEVERE_HIGH",4]
]) test("calcium boundary " + value, () => expectCode({calcium:value},code,level));
for(const value of [2.2,2.6]) test("calcium normal edge " + value, () => assert.equal(run({calcium:value}).level,0));
test("symptomatic low calcium overrides mild numeric range", () => expectCode({calcium:2.15,lowCalciumSymptoms:true,symptomStatus:"checked"},"CA_SEVERE_LOW",4));
for(const [value,code,level] of [
  [0,"NEUT_SEVERE",3],[0.49,"NEUT_SEVERE",3],[0.5,"NEUT_MODERATE",2],
  [0.99,"NEUT_MODERATE",2],[1,"NEUT_MILD",1],[1.49,"NEUT_MILD",1],
  [1.5,"NEUT_BORDERLINE",1],[1.99,"NEUT_BORDERLINE",1],[7.51,"NEUT_HIGH",1]
]) test("neutrophil boundary " + value, () => expectCode({neut:value},code,level));
for(const [value,code,level] of [
  [0,"PLT_SEVERE",3],[29,"PLT_SEVERE",3],[30,"PLT_LOW_URGENT",3],
  [49,"PLT_LOW_URGENT",3],[50,"PLT_LOW",2],[149,"PLT_LOW",2],
  [401,"PLT_HIGH",1],[999,"PLT_HIGH",1],[1000,"PLT_MARKED_HIGH",3]
]) test("platelet boundary " + value, () => expectCode({platelets:value},code,level));
for(const value of [150,400]) test("platelet normal edge " + value, () => assert.equal(run({platelets:value}).level,0));
test("multiple cell lines trigger pancytopenia", () => expectCode({hb:100,wcc:2,platelets:100},"MULTIPLE_CYTOPENIAS",3));
test("no invented morphology when MCV is absent", () => {
  const r = expectCode({hb:100,ferritin:50},"ANAEMIA_UNCLASSIFIED");
  assert.equal(has(r,"ANAEMIA_NORMO"),false);
});
for(const [mcv,code] of [[79.9,"ANAEMIA_MICRO"],[80,"ANAEMIA_NORMO"],[100,"ANAEMIA_NORMO"],[100.1,"ANAEMIA_MACRO"]])
  test("MCV classification " + mcv, () => expectCode({hb:100,mcv},code));
test("Hb reference is explicit and can use laboratory limits", () => {
  assert.ok(run({hb:120,sex:"unknown"}).missing.length);
  assert.equal(has(run({hb:120,sex:"male"}),"ANAEMIA_UNCLASSIFIED"),true);
  assert.equal(has(run({hb:120,sex:"female"}),"ANAEMIA_UNCLASSIFIED"),false);
  assert.equal(has(run({hb:120,hbLow:125}),"ANAEMIA_UNCLASSIFIED"),true);
});
test("RBC/Hct/MCH/MCHC are actually interpreted", () => {
  const r = run({rbc:6,hct:0.6,mch:20,mchc:300});
  for(const code of ["INDEX_RBC","INDEX_HCT","INDEX_MCH","INDEX_MCHC"]) assert.ok(has(r,code));
});
for(const [cr,hours,expected] of [[105.99,48,false],[106,48,true],[106,48.01,false],[120,168,true],[119.99,168,false],[120,168.01,false]])
  test("AKI boundary " + cr + "/" + hours, () => {
    const r = run({cr,baselineCr:80,elapsedHours:hours});
    assert.equal(has(r,"AKI"),expected);
  });
test("one renal result cannot diagnose CKD or exclude AKI", () => {
  const r = run({egfr:50});
  assert.ok(r.missing.some(x => x.includes("AKI")));
  assert.ok(r.actions.some(x => x.includes("≥3 months")));
});
test("neutropenic fever beats numeric and scope gates", () => expectCode({neut:0.8,fever:true,symptomStatus:"checked"},"NEUTROPENIC_SEPSIS",4));
for(const key of ["unstable","neuro","bleeding"])
  test("clinical emergency without bloods: " + key, () => {
    const r = run({[key]:true,symptomStatus:"checked"});
    assert.equal(r.level,4); assert.equal(r.empty,false);
  });
test("clinical hyperglycaemic features override normal HbA1c", () => expectCode({hba1c:35,hyperglycaemia:true,symptomStatus:"checked"},"GLYCAEMIC_EMERGENCY",3));
test("B12 neurological symptoms override normal MCV", () => expectCode({b12:250,b12Unit:"ng/L",mcv:90,b12Neuro:true,symptomStatus:"checked"},"B12_NEURO",3));
for(const [value,code] of [[179,"B12_LOW"],[180,"B12_INDETERMINATE"],[200,"B12_INDETERMINATE"],[350,"B12_INDETERMINATE"],[351,"B12_ABOVE_BAND"]])
  test("B12 ng/L boundary " + value, () => expectCode({b12:value,b12Unit:"ng/L"},code));
for(const [value,code] of [[132,"B12_LOW"],[133,"B12_INDETERMINATE"],[258,"B12_INDETERMINATE"],[259,"B12_ABOVE_BAND"]])
  test("B12 pmol/L boundary " + value, () => expectCode({b12:value,b12Unit:"pmol/L"},code));
test("B12 unit selection is mandatory", () => assert.ok(run({b12:200}).errors.some(e => e.field === "b12Unit")));
test("folate standalone is interpreted with B12 safeguard", () => {
  const r = expectCode({folate:3},"FOLATE_LOW");
  assert.ok(r.actions.some(x => x.includes("B12")));
});
for(const [value,code] of [[41,"HBA1C_BELOW"],[42,"HBA1C_RISK"],[47,"HBA1C_RISK"],[48,"HBA1C_DIABETES"]])
  test("HbA1c boundary " + value, () => expectCode({hba1c:value,diabetesStatus:"notKnown"},code));
test("known diabetes is monitoring, not a new diagnosis", () => {
  const r = expectCode({hba1c:80,diabetesStatus:"known"},"HBA1C_MONITOR");
  assert.equal(has(r,"HBA1C_DIABETES"),false);
});
test("iron deficiency warns about HbA1c reliability", () => assert.ok(run({hba1c:50,ferritin:20}).limitations.some(x => x.includes("HbA1c may be unreliable"))));
for(const [value,code] of [[399,"NT_HF_LOW"],[400,"NT_HF_6W"],[2000,"NT_HF_6W"],[2001,"NT_HF_2W"]])
  test("NT-proBNP boundary " + value, () => expectCode({bnp:value,peptideAssay:"ntprobnp"},code));
test("BNP has its own pathway and always has actions", () => {
  const r = expectCode({bnp:400,peptideAssay:"bnp"},"BNP_LOCAL");
  assert.equal(has(r,"NT_HF_6W"),false); assert.ok(r.actions.length);
});
test("peptide assay must be selected", () => assert.ok(run({bnp:400}).errors.some(e => e.field === "peptideAssay")));
for(const [value,expected] of [[39.99,false],[40,false],[40.01,true],[120,true],[121,true]])
  test("ALT lab ULN boundary " + value, () => assert.equal(has(run({alt:value,altUln:40}),"LFT_ALT"),expected));
test("missing lab ULN is explicit", () => assert.ok(run({alt:120}).missing.some(x => x.includes("ALT"))));
test("liver patterns use lab GGT limit", () => expectCode({alp:200,alpUln:130,ggt:45,ggtUln:40},"LFT_CHOLESTATIC",2));
test("isolated bilirubin is not silently ignored", () => expectCode({bili:40},"BILI_HIGH"));
for(const [value,code] of [[29,"IRON_LOW"],[30,"IRON_CONTEXT"],[400,"IRON_CONTEXT"],[401,"FERRITIN_HIGH"]])
  test("ferritin lab range boundary " + value, () => expectCode({ferritin:value,ferritinUln:400},code));
test("high ferritin without upper limit stays uncertain", () => {
  const r = run({ferritin:401});
  assert.ok(r.missing.some(x => x.includes("ferritin upper")));
  assert.ok(!r.findings.some(f => /normal|within.*range/i.test(f.text)));
});
for(const value of [-1,"abc","NaN","Infinity","6,5","6 mmol/L"])
  test("invalid values are reported: " + value, () => {
    const r = run({potassium:value});
    assert.ok(r.errors.some(e => e.field === "potassium"));
  });
test("invalid companion never hides valid urgent result", () => {
  const r = run({potassium:6.5,hba1c:-1});
  assert.equal(r.level,4); assert.ok(r.errors.length);
});
test("invalid/reversed limits are rejected", () => {
  assert.ok(run({altUln:0}).errors.length);
  assert.ok(run({hbLow:150,hbHigh:100}).errors.length);
  assert.ok(run({calciumLow:3,calciumHigh:2}).errors.length);
  assert.ok(run({hct:40}).errors.length);
});
test("differential consistency is checked without hiding alerts", () => {
  const r = run({wcc:1,neut:0.2,lymph:5});
  assert.ok(r.errors.some(e => e.field === "wcc"));
  assert.equal(r.level,3);
});
test("outside scope limits adult patterns without removing alerts", () => {
  const r = run({scope:"outside",hba1c:50});
  assert.equal(has(r,"HBA1C_DIABETES"),false);
  assert.ok(r.limitations.some(x => x.includes("Outside scope")));
});
test("unknown symptoms remain unknown, never presumed absent", () => assert.ok(run({symptomStatus:"unknown",sodium:140}).limitations.some(x => x.includes("not been assessed"))));
test("symptom contradictions retain emergency priority", () => {
  const r = run({unstable:true,symptomStatus:"none"});
  assert.equal(r.level,4);
  assert.ok(r.errors.some(e => e.field === "symptomStatus"));
});
test("urgent alert is invariant under unrelated normal companions", () => {
  const baseline = run({potassium:6.5});
  for(const [key,value] of Object.entries({hb:130,mcv:90,ferritin:50,hba1c:35,sodium:140,calcium:2.4})){
    const r = run({potassium:6.5,[key]:value});
    assert.equal(r.level,baseline.level);
    assert.ok(has(r,"K_SEVERE_HIGH"));
  }
});
test("adding another urgent result never downgrades severity", () => {
  const r = run({potassium:6.5,sodium:129,calcium:3,ferritin:50});
  assert.equal(r.level,4);
  for(const code of ["K_SEVERE_HIGH","NA_MODERATE_LOW","CA_HIGH"]) assert.ok(has(r,code));
});
test("all supplied results remain counts, blank differs from zero", () => {
  assert.equal(run({platelets:0}).resultCount,1);
  assert.equal(run({platelets:""}).resultCount,0);
  assert.equal(run({potassium:"0"}).errors.length,1);
});
test("evaluation is deterministic and does not mutate input", () => {
  const input = Object.freeze({potassium:6.5,scope:"adult"});
  assert.deepEqual(evaluate(input),evaluate(input));
});
test("laboratory critical flag survives without a modelled result", () => expectCode({labCritical:true,symptomStatus:"checked"},"LAB_CRITICAL",3));
test("laboratory AKI alert survives normal absolute creatinine", () => expectCode({cr:90,akiReport:true,symptomStatus:"checked"},"LAB_AKI",3));
test("hypocalcaemic symptoms are assessed without calcium", () => expectCode({lowCalciumSymptoms:true,symptomStatus:"checked"},"CA_SYMPTOMS",3));
test("HTML input keys match the pure engine contract", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname,"../bloods.html"),"utf8");
  const keys = [...html.matchAll(/<input[^>]*data-engine-key="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual([...keys].sort(),Object.keys(fields).sort());
  assert.equal(new Set(keys).size,keys.length);
  for(const key of require("../bloods-engine.js").symptomKeys)
    assert.ok(html.includes('data-engine-context="' + key + '"'));
  assert.ok(html.includes('src="bloods-engine.js"'));
});

// Adapter integration against a minimal DOM. This is explicitly not browser/layout QA.
function pageHarness(loadEngine = true){
  const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
  const html = fs.readFileSync(path.join(__dirname,"../bloods.html"),"utf8");
  const elements = [], byId = {};
  function attrs(tag){
    return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
  }
  function element(tag, options = []){
    const a = attrs(tag), el = {
      id:a.id, type:a.type, value:"", checked:false, dataset:{}, validity:{badInput:false},
      attributes:{}, listeners:{},
      addEventListener(name, fn){ (this.listeners[name] ||= []).push(fn); },
      removeAttribute(name){ delete this.attributes[name]; },
      setAttribute(name,value){ this.attributes[name] = value; }
    };
    if(a["data-engine-key"]) el.dataset.engineKey = a["data-engine-key"];
    if(a["data-engine-context"]) el.dataset.engineContext = a["data-engine-context"];
    if(options.length){
      el.value = options[0];
      Object.defineProperty(el,"selectedIndex",{set(index){this.value = options[index];}});
    }
    if(el.id) byId[el.id] = el;
    elements.push(el); return el;
  }
  for(const m of html.matchAll(/<input\b[^>]*>/g)) element(m[0]);
  for(const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g))
    element(m[1],[...m[2].matchAll(/<option value="([^"]*)"/g)].map(o => o[1]));
  for(const id of ["engineResults","runDiagnosticBtn","clearDiagnosticBtn"]) element('id="' + id + '"');
  let ready;
  const document = {
    getElementById:id => byId[id],
    addEventListener:(name,fn) => {if(name === "DOMContentLoaded") ready = fn;},
    querySelectorAll(selector){
      if(selector === ".range-card" || selector === ".range-group") return [];
      if(selector === "[aria-invalid]") return elements.filter(el => "aria-invalid" in el.attributes);
      return elements.filter(el =>
        (selector.includes("[data-engine-key]") && el.dataset.engineKey) ||
        (selector.includes("[data-engine-context]") && el.dataset.engineContext) ||
        (selector.includes("#engineSex") && el.id === "engineSex"));
    },
    querySelector(selector){
      const key = selector.match(/data-engine-key="([^"]+)"/)?.[1];
      const context = selector.match(/data-engine-context="([^"]+)"/)?.[1];
      return elements.find(el => (key && el.dataset.engineKey === key) || (context && el.dataset.engineContext === context));
    }
  };
  const context = {document};
  context.window = context;
  vm.createContext(context);
  if(loadEngine) vm.runInContext(fs.readFileSync(path.join(__dirname,"../bloods-engine.js"),"utf8"),context);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  ready();
  return {context,byId,elements,output:() => byId.engineResults.innerHTML};
}
test("page adapter renders standalone emergency and scope limitation", () => {
  const p = pageHarness();
  p.byId.enginePotassium.value = "6.5";
  p.context.runDiagnosticEngine();
  assert.match(p.output(),/Emergency assessment now/);
  assert.match(p.output(),/Confirm that this is an adult/);
  assert.doesNotMatch(p.output(),/alert-success|dot-green/);
});
test("page adapter keeps urgent alert alongside field validation", () => {
  const p = pageHarness();
  p.byId.enginePotassium.value = "6.5";
  p.byId.engineHba1c.value = "-1";
  p.context.runDiagnosticEngine();
  assert.equal(p.byId.engineHba1c.attributes["aria-invalid"],"true");
  assert.match(p.output(),/Emergency assessment now/);
});
test("page adapter does not silently lose bad numeric browser input", () => {
  const p = pageHarness();
  p.byId.enginePotassium.validity.badInput = true;
  p.context.runDiagnosticEngine();
  assert.equal(p.byId.enginePotassium.attributes["aria-invalid"],"true");
  assert.match(p.output(),/Check these inputs/);
});
test("input and context events invalidate stale output", () => {
  const p = pageHarness();
  p.byId.enginePotassium.value = "6.5";
  p.context.runDiagnosticEngine();
  p.byId.enginePotassium.listeners.input[0]();
  assert.match(p.output(),/Results changed/);
  assert.doesNotMatch(p.output(),/Emergency assessment now/);
  p.byId["context-scope"].listeners.change[0]();
  assert.match(p.output(),/Results changed/);
});
test("clear resets results, limits, reference selection, flags and errors", () => {
  const p = pageHarness();
  p.byId.enginePotassium.value = "6.5";
  p.byId.engineHba1c.value = "-1";
  p.byId["context-altUln"].value = "40";
  p.byId["context-scope"].value = "adult";
  p.byId.engineSex.value = "male";
  p.elements.find(el => el.dataset.engineContext === "unstable").checked = true;
  p.context.runDiagnosticEngine();
  p.context.clearDiagnosticEngine();
  assert.equal(p.byId.enginePotassium.value,"");
  assert.equal(p.byId["context-altUln"].value,"");
  assert.equal(p.byId["context-scope"].value,"unknown");
  assert.equal(p.byId.engineSex.value,"unknown");
  assert.equal(p.elements.some(el => el.checked),false);
  assert.equal(p.elements.some(el => "aria-invalid" in el.attributes),false);
  assert.match(p.output(),/Awaiting input/);
});
test("missing engine module fails closed in page adapter", () => {
  const p = pageHarness(false);
  p.context.runDiagnosticEngine();
  assert.match(p.output(),/Engine unavailable/);
  assert.doesNotMatch(p.output(),/Routine|green/);
});
test("rendered text is HTML escaped", () => {
  const p = pageHarness();
  assert.equal(p.context.escapeEngineText('<script>&"'),"&lt;script&gt;&amp;&quot;");
});
