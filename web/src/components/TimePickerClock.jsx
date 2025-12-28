import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TWO_PI = Math.PI * 2
const CLOCK_RADIUS = 100
const CLOCK_CENTER = CLOCK_RADIUS
const INNER_RADIUS = 56
const OUTER_RADIUS = 84
const STROKE = 2
const HOUR_ORDER = [12,1,2,3,4,5,6,7,8,9,10,11]
const OUTER_HOUR_ORDER = [0,13,14,15,16,17,18,19,20,21,22,23]
const MINUTE_VALUES = Array.from({ length: 12 }, (_, i) => (i * 5) % 60)

function polarToCartesian(angle, radius){
  const rad = (Math.PI / 2) - angle
  return {
    x: CLOCK_CENTER + radius * Math.cos(rad),
    y: CLOCK_CENTER - radius * Math.sin(rad),
  }
}

function formatHour(hour){
  return String(hour).padStart(2,'0')
}

function formatMinute(minute){
  return String(minute).padStart(2,'0')
}

function parseTime(value){
  const [hh = '', mm = ''] = String(value || '').split(':')
  const hour = Number(hh)
  const minute = Number(mm)
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

export default function TimePickerClock({ value, onChange, id, name, disabled, placeholder }){
  const { hour, minute } = useMemo(() => parseTime(value), [value])
  const [open,setOpen] = useState(false)
  const [stage,setStage] = useState('hour') // 'hour' | 'minute'
  const containerRef = useRef(null)
  const hourGradientId = useMemo(()=> `clock-hour-bg-${Math.random().toString(36).slice(2,8)}`,[])
  const minuteGradientId = useMemo(()=> `clock-minute-bg-${Math.random().toString(36).slice(2,8)}`,[])

  useEffect(()=>{
    if(!open) return
    const handleClick = (event)=>{
      if(!containerRef.current) return
      if(containerRef.current.contains(event.target)) return
      setOpen(false)
      setStage('hour')
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return ()=>{
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  },[open])

  const handleInputChange = useCallback((event)=>{
    onChange?.(event.target.value)
  },[onChange])

  const applyTime = useCallback((nextHour, nextMinute)=>{
    const hh = formatHour(nextHour)
    const mm = formatMinute(nextMinute)
    onChange?.(`${hh}:${mm}`)
  },[onChange])

  const handleHourSelect = useCallback((selectedHour)=>{
    setStage('minute')
    applyTime(selectedHour, minute)
  },[applyTime, minute])

  const handleMinuteSelect = useCallback((selectedMinute)=>{
    applyTime(hour, selectedMinute)
    setOpen(false)
    setStage('hour')
  },[applyTime, hour])

  const hourAngle = useMemo(()=>{
    const normalized = hour % 12
    return (normalized === 0 ? 0 : normalized) / 12 * TWO_PI
  },[hour])

  const hourPointerRadius = useMemo(()=>{
    if(hour === 0 || hour > 12) return OUTER_RADIUS
    return INNER_RADIUS
  },[hour])

  const minuteAngle = useMemo(()=> (minute / 60) * TWO_PI, [minute])

  const renderHourMarker = (val, index, ring) => {
    const angle = (index / 12) * TWO_PI
    const radius = ring === 'inner' ? INNER_RADIUS : OUTER_RADIUS
    const { x, y } = polarToCartesian(angle, radius)
    const display = ring === 'inner' ? (val === 12 ? '12' : String(val)) : (val === 0 ? '00' : String(val))
    const isSelected = hour === (val % 24)
    const textColor = isSelected ? '#fff' : (ring === 'inner' ? 'var(--accent-2)' : 'var(--muted)')
    const selectionRadius = ring === 'inner' ? 18 : 16
    return (
      <g key={`${ring}-${val}`} transform={`translate(${x},${y})`} style={{ cursor:'pointer' }} onClick={()=> handleHourSelect(val % 24)}>
        {isSelected && (
          <circle r={selectionRadius} fill="var(--accent)" opacity={0.94} />
        )}
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          alignmentBaseline="middle"
          style={{
            fill: textColor,
            fontWeight: isSelected ? 700 : 600,
            fontSize: ring === 'inner' ? 16 : 13,
          }}
        >
          {display}
        </text>
      </g>
    )
  }

  const renderHourClock = () => {
    const pointerTarget = polarToCartesian(hourAngle, hourPointerRadius)
    return (
      <svg width={CLOCK_RADIUS * 2} height={CLOCK_RADIUS * 2} role="presentation">
        <defs>
          <radialGradient id={hourGradientId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="rgba(148,210,189,0.18)" />
            <stop offset="75%" stopColor="rgba(255,255,255,0.96)" />
          </radialGradient>
        </defs>
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={OUTER_RADIUS + STROKE} fill="var(--surface)" stroke="var(--border)" strokeWidth={STROKE} />
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={OUTER_RADIUS - 8} fill={`url(#${hourGradientId})`} stroke="rgba(10,147,150,0.10)" strokeWidth={1} />
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={INNER_RADIUS + 6} fill="rgba(10,147,150,0.08)" stroke="rgba(10,147,150,0.15)" strokeWidth={1} />
        <line x1={CLOCK_CENTER} y1={CLOCK_CENTER} x2={pointerTarget.x} y2={pointerTarget.y} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={4} fill="var(--accent)" />
        {HOUR_ORDER.map((val, index) => renderHourMarker(val, index, 'inner'))}
        {OUTER_HOUR_ORDER.map((val, index) => renderHourMarker(val, index, 'outer'))}
      </svg>
    )
  }

  const renderMinuteClock = () => {
    const pointerTarget = polarToCartesian(minuteAngle, OUTER_RADIUS)
    return (
      <svg width={CLOCK_RADIUS * 2} height={CLOCK_RADIUS * 2} role="presentation">
        <defs>
          <radialGradient id={minuteGradientId} cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="rgba(148,210,189,0.12)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.96)" />
          </radialGradient>
        </defs>
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={OUTER_RADIUS + STROKE} fill="var(--surface)" stroke="var(--border)" strokeWidth={STROKE} />
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={OUTER_RADIUS - 6} fill={`url(#${minuteGradientId})`} stroke="rgba(10,147,150,0.10)" strokeWidth={1} />
        <line x1={CLOCK_CENTER} y1={CLOCK_CENTER} x2={pointerTarget.x} y2={pointerTarget.y} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
        <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={4} fill="var(--accent)" />
        {MINUTE_VALUES.map((val, index) => {
          const angle = (index / 12) * TWO_PI
          const { x, y } = polarToCartesian(angle, OUTER_RADIUS)
          const isSelected = minute === val
          return (
            <g key={`minute-${val}`} transform={`translate(${x},${y})`} style={{ cursor:'pointer' }} onClick={()=> handleMinuteSelect(val)}>
              {isSelected && (
                <circle r={18} fill="var(--accent)" opacity={0.94} />
              )}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                alignmentBaseline="middle"
                style={{
                  fill: isSelected ? '#fff' : 'var(--accent-2)',
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: 15,
                }}
              >
                {String(val).padStart(2,'0')}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="time-picker-clock" ref={containerRef}>
      <input
        type="time"
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="input"
        onChange={handleInputChange}
      />
      <button
        type="button"
        className="clock-btn"
        onClick={()=> !disabled && setOpen(o=>!o)}
        aria-label="Choose time"
        disabled={disabled}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="clock-popover" role="dialog">
          <div className="clock-stage-label">
            {stage==='hour' ? 'Select hour' : 'Select minutes'}
          </div>
          <div className="clock-face">
            {stage==='hour' ? renderHourClock() : renderMinuteClock()}
          </div>
          <div className="clock-controls">
            {stage==='minute' && (
              <button type="button" className="btn secondary" onClick={()=> setStage('hour')}>
                Back
              </button>
            )}
            <button type="button" className="btn secondary" onClick={()=> { setOpen(false); setStage('hour') }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
