const LISBON_TZ = 'Europe/Lisbon'

const baseFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LISBON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LISBON_TZ,
  weekday: 'short',
})

function partsFromFormatter(formatter, date){
  const out = {}
  for (const part of formatter.formatToParts(date)){
    if (part.type === 'literal') continue
    out[part.type] = part.value
  }
  return out
}

function getLisbonOffsetMinutes(date){
  const parts = partsFromFormatter(baseFormatter, date)
  const utcFromLisbon = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return (utcFromLisbon - date.getTime()) / 60000
}

export function lisbonDateTimeToInstant({ year, month, day, hour = 0, minute = 0, second = 0 }){
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = getLisbonOffsetMinutes(guess)
  return new Date(guess.getTime() - offset * 60000)
}

export function instantToLisbonDateTime(date){
  const parts = partsFromFormatter(baseFormatter, date)
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

export function lisbonMidnightInstant(date){
  const parts = instantToLisbonDateTime(date)
  return lisbonDateTimeToInstant({ ...parts, hour: 0, minute: 0, second: 0 })
}

export function shiftLisbonDateParts(parts, deltaDays){
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0))
  utc.setUTCDate(utc.getUTCDate() + deltaDays)
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  }
}

export function getLisbonWeekdayIndex(date){
  const wk = weekdayFormatter.format(date)
  switch (wk){
    case 'Sun': return 0
    case 'Mon': return 1
    case 'Tue': return 2
    case 'Wed': return 3
    case 'Thu': return 4
    case 'Fri': return 5
    case 'Sat': return 6
    default: return 0
  }
}

export { LISBON_TZ }
