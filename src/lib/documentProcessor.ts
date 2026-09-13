import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface ParseDocumentResult {
  success: boolean
  filename: string
  markdown: string
  title?: string
  error?: string
}

function toBuffer(data: ArrayBuffer | Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(data)) {
    return data
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  return Buffer.from(data)
}

/**
 * Universal document parser using Microsoft MarkItDown.
 * Supports: .docx, .xlsx, .pptx, .pdf, .csv, .html, images (.png, .jpg, .jpeg)
 *
 * Architecture:
 * 1. Checks if an external DOCUMENT_PROCESSOR_URL service is configured (e.g. Cloud Run in production).
 * 2. If not or if service is unavailable, executes local python `cli_convert.py` helper (seamless local dev).
 * 3. Graceful fallback for basic PDFs if Python is absent.
 */
export async function parseDocumentWithMarkItDown(
  fileData: ArrayBuffer | Uint8Array | Buffer,
  filename: string
): Promise<ParseDocumentResult> {
  const serviceUrl = process.env.DOCUMENT_PROCESSOR_URL
  const buffer = toBuffer(fileData)

  // ── Strategy 1: Remote Microservice (e.g. Cloud Run or Docker) ──────────────
  if (serviceUrl) {
    try {
      const blob = new Blob([new Uint8Array(buffer)])
      const formData = new FormData()
      formData.append('file', blob, filename)

      const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/convert`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60_000),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.markdown) {
          return {
            success: true,
            filename,
            markdown: data.markdown,
            title: data.title || filename,
          }
        }
      }
    } catch (fetchErr) {
      console.warn('[DocumentProcessor] Service call failed, falling back to local runner:', fetchErr)
    }
  }

  // ── Strategy 2: Local Python CLI Runner ─────────────────────────────────────
  let tempFilePath: string | null = null
  try {
    const ext = path.extname(filename).toLowerCase() || '.bin'
    const tempDir = os.tmpdir()
    const safeName = `botify_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    tempFilePath = path.join(tempDir, safeName)

    await fs.writeFile(tempFilePath, buffer)

    const scriptPath = path.resolve(process.cwd(), 'services', 'document-processor', 'cli_convert.py')

    const { stdout } = await execFileAsync(
      'python',
      ['-W', 'ignore', scriptPath, tempFilePath],
      {
        encoding: 'utf8',
        maxBuffer: 30 * 1024 * 1024,
        timeout: 90_000,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
        },
      }
    )

    const result = JSON.parse(stdout.trim())
    if (result.success && result.markdown) {
      return {
        success: true,
        filename,
        markdown: result.markdown,
        title: result.title || filename,
      }
    } else if (result.error) {
      throw new Error(result.error)
    }
  } catch (localErr: any) {
    console.error('[DocumentProcessor] Local conversion error:', localErr.message)
    // If it's a PDF and local runner fails, attempt fallback below
  } finally {
    if (tempFilePath) {
      fs.unlink(tempFilePath).catch(() => {})
    }
  }

  // ── Strategy 3: Fallback for PDF via unpdf ─────────────────────────────────
  const isPdf = filename.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const uint8 = new Uint8Array(buffer)
      const pdf = await getDocumentProxy(uint8)
      const result = await extractText(pdf, { mergePages: true })
      const text = Array.isArray(result.text) ? result.text.join('\n') : result.text
      if (text && text.trim().length > 0) {
        return {
          success: true,
          filename,
          markdown: text.trim(),
          title: filename,
        }
      }
    } catch (unpdfErr: any) {
      console.error('[DocumentProcessor] Fallback unpdf failed:', unpdfErr.message)
    }
  }

  return {
    success: false,
    filename,
    markdown: '',
    error: 'ไม่สามารถอ่านและแปลงเนื้อหาจากเอกสารนี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์เอกสารที่ถูกต้องและไม่ติดรหัสผ่าน',
  }
}
