// node pipeline.js [shorts] [overview]
// Renders picture (Chromium frame by frame), writes cues.json, makes the music + sound effects with
// music.py (from checkmee-video/kit — composed in code, no licensed audio), muxes, and writes the
// voice-over script (.md) and subtitles (.srt) for the owner to record over.
const { chromium } = require('playwright-core')
const { spawn, execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const clips = require(process.env.CLIPS || './clips')
const overview = require(process.env.SEGMENTS || './overview')
const LONG_NAME = process.env.OUTNAME || 'dealmee-00-overview'
const LONG_TITLE = process.env.TITLE || 'DealMee ภาพรวม (คลิปแรก)'

const FPS = 30
const XF = 0.4 // overview crossfade
const OUT = path.join(__dirname, 'out')
const WORK = path.join(OUT, 'work')
fs.mkdirSync(WORK, { recursive: true })
const want = process.argv.slice(2)
const doShorts = !want.length || want.includes('shorts')
const doOverview = !want.length || want.includes('overview')

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })
const endStartOf = (c) => c.duration - (c.endDur || 0)

async function renderVideo(page, clip, file) {
  await page.evaluate((c) => window.build(c), clip)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] })
  const frames = Math.round(clip.duration * FPS)
  for (let i = 0; i < frames; i++) {
    await page.evaluate((x) => window.render(x), i / FPS)
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 })
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
  }
  ff.stdin.end()
  await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))))
}

/** Sound-effect times for one clip, shifted by `off` (its start in the final video) */
function cuesFor(clip, off = 0) {
  const c = { pops: [], taps: [], keys: [], whooshes: [], chimes: [], sting: [] }
  const m = clip.main
  const es = endStartOf(clip)
  if (m) {
    if (off === 0 || clip.hook.dur < 50) c.whooshes.push(off + clip.hook.dur)
    for (const x of m.msgs) {
      if (x.side === 'sys') continue
      c.pops.push(off + x.t)
      if (x.chime) c.chimes.push([off + x.t + 0.05, [76, 79]])
    }
    for (const co of m.callouts) c.taps.push(off + co.t + 0.05)
    for (const o of m.overlays || []) {
      if (o.kind === 'notify') c.chimes.push([off + o.t + 0.1, [72, 76, 79]])
      if (o.kind === 'panel') {
        o.fields.forEach((f, j) => {
          const start = o.t + 0.6 + j * 0.9
          for (let k = 0; k < f.value.length; k += 2) c.keys.push(off + start + (k / f.value.length) * 0.7)
        })
        c.taps.push(off + o.press)
      }
    }
  } else if (clip.hook.dur < 50) {
    c.whooshes.push(off + clip.hook.dur)
  }
  if (clip.endDur) {
    c.whooshes.push(off + es)
    c.sting.push(off + es + 0.1)
  }
  return c
}

function writeMusic(cues, duration, end, name) {
  const cueFile = path.join(WORK, `${name}-cues.json`)
  fs.writeFileSync(cueFile, JSON.stringify({ duration, end, bed: 0.6, peak: 0.85, ...cues }))
  const wav = path.join(WORK, `${name}-music.wav`)
  run('python3', [path.join(__dirname, 'music.py'), wav, cueFile])
  return wav
}

function mux(video, wav, out) {
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out])
}

const srtTime = (s) => {
  const ms = Math.round(s * 1000)
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const mi = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const se = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `${h}:${mi}:${se},${String(ms % 1000).padStart(3, '0')}`
}
const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

function writeVoiceover(name, title, total, sections) {
  const srt = sections.map((s, i) => `${i + 1}\n${srtTime(s.from + 0.3)} --> ${srtTime(Math.max(s.from + 1, s.to - 0.3))}\n${s.vo}\n`).join('\n')
  fs.writeFileSync(path.join(OUT, `${name}-voiceover.srt`), srt)
  const md = `# ${title} — บทพากย์

ความยาว ${total.toFixed(1)} วินาที · คลิป \`${name}.mp4\` มีเพลงกับเสียงเอฟเฟค (แต่งด้วยโค้ด ไม่ติดลิขสิทธิ์) และตัวหนังสือบนจอ ไม่มีเสียงพูด
บทนี้ไว้อัดเสียงเองแล้ววางทับ (ซับ: \`${name}-voiceover.srt\`) · เพลงเปิดเบาไว้แล้ว (bed 0.6) ให้เสียงพูดเด่น

| เวลา | ภาพ | บทพูด |
|---|---|---|
${sections.map((s) => `| ${clock(s.from)}–${clock(s.to)} | ${s.scene} | ${s.vo} |`).join('\n')}

## บทพูดอ่านรวดเดียว

${sections.map((s) => `> ${s.vo}`).join('\n>\n')}
`
  fs.writeFileSync(path.join(OUT, `${name}-voiceover.md`), md)
}

const strip = (h) => String(h || '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '')

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto('file://' + path.join(__dirname, 'template.html'))

  if (doShorts) {
    for (const clip of clips) {
      const name = `dealmee-${clip.id}`
      const vid = path.join(WORK, `${name}-video.mp4`)
      await renderVideo(page, clip, vid)
      const wav = writeMusic(cuesFor(clip), clip.duration, endStartOf(clip), name)
      mux(vid, wav, path.join(OUT, `${name}.mp4`))
      const es = endStartOf(clip)
      const cs = clip.main.callouts
      writeVoiceover(name, `DealMee ${clip.tag}`, clip.duration, [
        { from: 0, to: clip.hook.dur, scene: `ประโยคเปิด: ${strip(clip.hook.title)}`, vo: clip.hook.vo },
        ...cs.map((c, i) => ({ from: c.t, to: cs[i + 1] ? cs[i + 1].t : es, scene: strip(c.text), vo: c.vo })),
        { from: es, to: clip.duration, scene: `ฉากปิด: ${strip(clip.end.title)} + ทดลองใช้ฟรี 14 วัน`, vo: clip.end.vo },
      ])
      console.log('done', name)
    }
  }

  if (doOverview) {
    const parts = []
    for (const seg of overview) {
      const vid = path.join(WORK, `${seg.id}.mp4`)
      await renderVideo(page, seg, vid)
      parts.push(vid)
      console.log('segment', seg.id)
    }
    // offsets in the joined video
    const offs = []
    let acc = 0
    overview.forEach((s, i) => {
      offs.push(acc)
      acc += s.duration - (i < overview.length - 1 ? XF : 0)
    })
    const total = acc
    const inputs = parts.flatMap((p) => ['-i', p])
    let filter = ''
    let last = '[0:v]'
    for (let i = 1; i < parts.length; i++) {
      const label = i === parts.length - 1 ? '[v]' : `[x${i}]`
      filter += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${offs[i].toFixed(3)}${label};`
      last = label
    }
    const joined = path.join(WORK, `${LONG_NAME}-video.mp4`)
    run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter.replace(/;$/, ''), '-map', '[v]',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), joined])

    const cues = { pops: [], taps: [], keys: [], whooshes: [], chimes: [], sting: [] }
    overview.forEach((s, i) => {
      const c = cuesFor(s, offs[i])
      for (const k of Object.keys(cues)) cues[k].push(...c[k])
      if (i > 0) cues.whooshes.push(offs[i] + XF / 2)
    })
    const lastSeg = overview[overview.length - 1]
    const end = offs[overview.length - 1] + endStartOf(lastSeg)
    const name = LONG_NAME
    const wav = writeMusic(cues, total, end, name)
    mux(joined, wav, path.join(OUT, `${name}.mp4`))
    writeVoiceover(name, LONG_TITLE, total, overview.map((s, i) => ({
      from: offs[i],
      to: i < overview.length - 1 ? offs[i + 1] : total,
      scene: strip(s.hook.title),
      vo: s.vo || s.hook.vo,
    })))
    console.log('done', name, total.toFixed(1) + 's')
  }
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
