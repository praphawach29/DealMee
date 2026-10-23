'use client'

import { useState } from 'react'
import type { ChartPoint } from '@/lib/dashboard/metrics'
import { formatBaht } from '@/lib/dashboard/metrics'

export function SalesChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 680
  const height = 240
  const pad = { l: 44, r: 12, t: 18, b: 32 }
  const max = Math.max(1, ...points.map((point) => Math.max(point.current, point.previous)))
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const x = (i: number) => pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => pad.t + innerH - (v / max) * innerH
  const path = (key: 'current' | 'previous') =>
    points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(point[key]).toFixed(1)}`).join(' ')
  const area =
    points.length > 0
      ? `${path('current')} L ${x(points.length - 1).toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`
      : ''
  const ticks = [0, 0.5, 1]
  const empty = points.every((point) => point.current === 0 && point.previous === 0)
  const labelStep = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full"
        role="img"
        aria-label="กราฟยอดขายเทียบช่วงก่อนหน้า"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          if (points.length === 0) return
          const rect = event.currentTarget.getBoundingClientRect()
          const rel = ((event.clientX - rect.left) / rect.width) * width
          let nearest = 0
          let best = Infinity
          points.forEach((_, i) => {
            const dist = Math.abs(x(i) - rel)
            if (dist < best) {
              best = dist
              nearest = i
            }
          })
          setHover(nearest)
        }}
      >
        {ticks.map((tick) => {
          const yy = y(max * tick)
          return (
            <g key={tick}>
              <line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke="#E6EDF5" strokeWidth="1" />
              <text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#8B95A7">
                {compact(max * tick)}
              </text>
            </g>
          )
        })}
        {area && <path d={area} fill="url(#salesFill)" />}
        {points.length > 0 && (
          <path d={path('previous')} fill="none" stroke="#B7C3D6" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round" />
        )}
        {points.length > 0 && (
          <path d={path('current')} fill="none" stroke="#2F6BFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {hover != null && points[hover] && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="#D5DEEA" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(points[hover].current)} r="4.5" fill="#2F6BFF" stroke="white" strokeWidth="2" />
          </g>
        )}
        {points.map((point, i) =>
          i % labelStep === 0 || i === points.length - 1 ? (
            <text key={point.label + i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="#8B95A7">
              {point.label}
            </text>
          ) : null,
        )}
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2F6BFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2F6BFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {hover != null && points[hover] && (
        <div className="pointer-events-none absolute right-3 top-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-xs shadow-card">
          <p className="font-semibold text-on-surface">{points[hover].label}</p>
          <p className="mt-1 text-primary">ช่วงนี้ {formatBaht(points[hover].current)}</p>
          <p className="text-outline">ก่อนหน้า {formatBaht(points[hover].previous)}</p>
        </div>
      )}
      {empty && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-on-surface-variant">
          ยังไม่มียอดขายในช่วงนี้
        </p>
      )}
    </div>
  )
}

export function MiniSparkline({ values }: { values: number[] }) {
  const width = 148
  const height = 46
  const max = Math.max(1, ...values)
  const step = values.length <= 1 ? 0 : width / (values.length - 1)
  const d = values
    .map((value, i) => {
      const x = i * step
      const y = height - 4 - (value / max) * (height - 8)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-36" aria-hidden>
      <path d={d || `M 0 ${height - 4} L ${width} ${height - 4}`} fill="none" stroke="#2F6BFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function compact(value: number) {
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(Math.round(value))
}
