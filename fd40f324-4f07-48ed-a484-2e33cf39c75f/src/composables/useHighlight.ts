import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import rust from 'highlight.js/lib/languages/rust'
import cpp from 'highlight.js/lib/languages/cpp'
import sql from 'highlight.js/lib/languages/sql'
import type { LanguageId } from '@/types'

const registered = new Set<string>()

function registerLanguage(id: string, lang: any) {
  if (!registered.has(id)) {
    try {
      hljs.registerLanguage(id, lang)
      registered.add(id)
    } catch { /* ignore duplicate */ }
  }
}

registerLanguage('javascript', javascript)
registerLanguage('typescript', typescript)
registerLanguage('python', python)
registerLanguage('xml', xml)
registerLanguage('html', xml)
registerLanguage('css', css)
registerLanguage('json', json)
registerLanguage('markdown', markdown)
registerLanguage('go', go)
registerLanguage('java', java)
registerLanguage('rust', rust)
registerLanguage('cpp', cpp)
registerLanguage('c', cpp)
registerLanguage('sql', sql)

const HLJS_LANG_MAP: Record<LanguageId, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  go: 'go',
  java: 'java',
  html: 'xml',
  css: 'css',
  json: 'json',
  markdown: 'markdown',
  rust: 'rust',
  cpp: 'cpp',
  c: 'cpp',
  sql: 'sql'
}

export function useHighlight() {
  function highlight(code: string, language: LanguageId): string {
    const hljsLang = HLJS_LANG_MAP[language] || 'javascript'
    try {
      if (hljs.getLanguage(hljsLang)) {
        return hljs.highlight(code, { language: hljsLang, ignoreIllegals: true }).value
      }
    } catch { /* fallback below */ }
    return escapeHtml(code)
  }

  function highlightAuto(code: string): string {
    try {
      return hljs.highlightAuto(code).value
    } catch {
      return escapeHtml(code)
    }
  }

  function highlightElement(el: HTMLElement, language: LanguageId) {
    const code = el.textContent || ''
    el.innerHTML = highlight(code, language)
    el.classList.add('hljs')
  }

  return {
    highlight,
    highlightAuto,
    highlightElement,
    hljs
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type HighlightAPI = ReturnType<typeof useHighlight>
