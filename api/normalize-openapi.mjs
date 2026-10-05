import { readFileSync, writeFileSync } from 'node:fs'

// TypeSpec emits `additionalProperties: { not: {} }` for sealed objects.
// kin-openapi 0.142 treats that schema as empty, and oapi-codegen generates
// map fields for it. The boolean form has identical OpenAPI 3.0 semantics
// and is supported by both consumers. This is part of generation, not a
// hand edit of the contract: only this exact representation is rewritten.
const spec = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'))
function normalize(value) {
  if (!value || typeof value !== 'object') return
  if (JSON.stringify(value.additionalProperties) === '{"not":{}}') {
    value.additionalProperties = false
  }
  Object.values(value).forEach(normalize)
}
normalize(spec)
writeFileSync(new URL('./openapi.json', import.meta.url), JSON.stringify(spec, null, 2) + '\n')
