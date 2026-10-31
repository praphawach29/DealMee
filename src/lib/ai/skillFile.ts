export type ParsedSkillFile = {
  category: string
  description: string | null
  instruction: string
}

export const MAX_SKILL_FILE_BYTES = 16 * 1024
export const MAX_SKILL_INSTRUCTION_CHARS = 8000

export function parseSkillFile(filename: string, bytes: Uint8Array): ParsedSkillFile {
  if (!/\.(md|txt)$/i.test(filename)) throw new Error('Only .md and .txt files are supported')
  if (bytes.byteLength > MAX_SKILL_FILE_BYTES) throw new Error('File exceeds 16 KB')
  let instruction: string
  try {
    instruction = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('File must contain valid UTF-8 text')
  }
  // Text files may contain tabs and line endings, but not binary control bytes.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(instruction)) {
    throw new Error('Binary files and control characters are not supported')
  }
  let category = 'imported'
  let description: string | null = null
  if (/^---(?:\r?\n|$)/.test(instruction)) {
    const opening = instruction.indexOf('\n') + 1
    const closing = /^---\r?$/gm
    closing.lastIndex = opening
    const end = opening > 0 ? closing.exec(instruction) : null
    if (!end) throw new Error('Invalid frontmatter: missing closing --- line')
    const metadata = new Map<string, string>()
    for (const line of instruction.slice(opening, end.index).split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue
      const match = /^(name|description):[ \t]*(.*)$/.exec(line)
      if (!match || metadata.has(match[1])) throw new Error('Unsupported frontmatter: only unique name and description text fields are allowed')
      const value = parseMetadataValue(match[2].trim())
      if (!value.trim()) throw new Error('Invalid frontmatter: metadata values cannot be empty')
      metadata.set(match[1], value)
    }
    category = metadata.get('name') ?? category
    description = metadata.get('description') ?? null
    if (category.length > 50) throw new Error('Frontmatter name exceeds 50 characters')
    if (description && description.length > 8000) throw new Error('Frontmatter description exceeds 8000 characters')
    const afterDelimiter = end.index + end[0].length
    // Remove only the closing delimiter's newline, never trim the body.
    instruction = instruction.slice(afterDelimiter + (instruction[afterDelimiter] === '\n' ? 1 : 0))
  }
  if (!instruction.trim()) throw new Error('Skill instructions cannot be empty')
  if (instruction.length > MAX_SKILL_INSTRUCTION_CHARS) throw new Error('Instructions exceed 8000 characters; shorten the file (nothing is truncated)')
  return { category, description, instruction }
}

function parseMetadataValue(raw: string): string {
  const error = () => new Error('Unsupported frontmatter YAML: use single-line text for name/description; no lists, objects, block scalars, tags, anchors or inline comments')
  if (raw.startsWith('"')) {
    try {
      const value: unknown = JSON.parse(raw)
      if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw error()
      return value
    } catch { throw error() }
  }
  if (raw.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(raw)) throw error()
    return raw.slice(1, -1).replace(/''/g, "'")
  }
  if (/^[\[\]{}|>&*!%@`?#,:-]/.test(raw) || /:\s|\s#/.test(raw)) throw error()
  return raw
}
