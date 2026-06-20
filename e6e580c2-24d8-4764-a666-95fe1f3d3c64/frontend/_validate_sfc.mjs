import { readFileSync } from 'fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const file = 'src/views/ProductManagement.vue'
const src = readFileSync(file, 'utf-8')
const { descriptor, errors } = parse(src, { filename: file })

if (errors.length) {
  console.error('PARSE ERRORS:')
  errors.forEach((e) => console.error(e.message))
  process.exit(1)
}

let ok = true

try {
  const script = compileScript(descriptor, { id: 'pm' })
  console.log('SCRIPT block compiled OK, bindings:', Object.keys(script.bindings || {}).length)
} catch (e) {
  ok = false
  console.error('SCRIPT COMPILE ERROR:', e.message)
}

try {
  const tpl = compileTemplate({ source: descriptor.template.content, filename: file, id: 'pm' })
  if (tpl.errors && tpl.errors.length) {
    ok = false
    console.error('TEMPLATE ERRORS:')
    tpl.errors.forEach((e) => console.error(typeof e === 'string' ? e : e.message))
  } else {
    console.log('TEMPLATE compiled OK')
  }
} catch (e) {
  ok = false
  console.error('TEMPLATE COMPILE ERROR:', e.message)
}

console.log(ok ? 'SFC_VALIDATION_PASS' : 'SFC_VALIDATION_FAIL')
process.exit(ok ? 0 : 1)
