function equal(a,b) { return a instanceof Date || b instanceof Date ? +new Date(a) === +new Date(b) : String(a) === String(b); }
function matches(record, filter) {
  if (!record) return false;
  return Object.entries(filter).every(([key,value]) => {
    if (key === "$or") return value.some(f => matches(record,f));
    if (key === "$and") return value.every(f => matches(record,f));
    const actual = record[key];
    if (value && typeof value === "object" && !(value instanceof Date) && !value._bsontype) {
      return Object.entries(value).every(([op,test]) => {
        if (op === "$exists") return (actual !== undefined) === test;
        if (op === "$lte") return actual !== undefined && actual <= test;
        if (op === "$gt") return actual !== undefined && actual > test;
        if (op === "$gte") return actual !== undefined && actual >= test;
        if (op === "$in") return test.some(v => equal(actual,v));
        if (op === "$ne") return !equal(actual,test);
        return equal(actual,value);
      });
    }
    return actual === undefined && value === null || equal(actual,value);
  });
}
function apply(record, update) {
  Object.assign(record, update.$set || {});
  for (const key of Object.keys(update.$unset || {})) delete record[key];
  return record;
}
module.exports = { matches, apply };
