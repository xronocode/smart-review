// START_MODULE_CONTRACT
//   PURPOSE: Minimal JSON Schema validator covering the subset used by smart-review schemas.
//   SCOPE: type, enum, required, properties, additionalProperties, items, minItems, minLength, pattern, minimum, maximum, local $ref.
//   DEPENDS: none
//   LINKS: M-SECTION-CLI, V-M-SECTION-CLI
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   validate - return a list of { path, message } violations of value against schema
// END_MODULE_MAP

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(actual, wanted) {
  return actual === wanted || (wanted === 'number' && actual === 'integer');
}

// START_CONTRACT: validate
//   PURPOSE: Check a JSON value against a schema and collect every violation.
//   INPUTS: { value: any, schema: object, root?: object - schema holding $defs }
//   OUTPUTS: { Array<{path: string, message: string}> - empty when valid }
//   SIDE_EFFECTS: none
// END_CONTRACT: validate
export function validate(value, schema, root = schema, path = '$', out = []) {
  if (schema.$ref) {
    const name = schema.$ref.replace('#/$defs/', '');
    const target = root.$defs && root.$defs[name];
    if (!target) {
      out.push({ path, message: `unresolved $ref ${schema.$ref}` });
      return out;
    }
    return validate(value, target, root, path, out);
  }
  const t = typeOf(value);
  if (schema.type) {
    const wanted = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!wanted.some((w) => typeMatches(t, w))) {
      out.push({ path, message: `expected ${wanted.join('|')}, got ${t}` });
      return out;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    out.push({ path, message: `must be one of: ${schema.enum.join(', ')}` });
  }
  if (t === 'string') {
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) {
      out.push({ path, message: `must have at least ${schema.minLength} non-blank character(s)` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      out.push({ path, message: `must match ${schema.pattern}` });
    }
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) out.push({ path, message: `must be >= ${schema.minimum}` });
    if (schema.maximum !== undefined && value > schema.maximum) out.push({ path, message: `must be <= ${schema.maximum}` });
  }
  if (t === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      out.push({ path, message: `must have at least ${schema.minItems} item(s)` });
    }
    if (schema.items) value.forEach((v, i) => validate(v, schema.items, root, `${path}[${i}]`, out));
  }
  if (t === 'object') {
    for (const k of schema.required || []) {
      if (!(k in value)) out.push({ path, message: `missing required property "${k}"` });
    }
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(v, props[k], root, `${path}.${k}`, out);
      else if (schema.additionalProperties === false) out.push({ path, message: `unknown property "${k}"` });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validate(v, schema.additionalProperties, root, `${path}.${k}`, out);
      }
    }
  }
  return out;
}
