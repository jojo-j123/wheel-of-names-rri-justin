import { describe, expect, it } from 'vitest'
import { buildParticipantsFromTable, parseCsvText, parseNameLines } from './participantsCsv'

describe('CSV import', () => {
  it('parses the documented format with header detection', () => {
    const t = parseCsvText('name,email,phone\nJohn Doe,john@example.com,01000000000\nJane Smith,jane@example.com,01111111111\n')
    expect(t.hasHeader).toBe(true)
    expect(t.mapping).toMatchObject({ name: 0, email: 1, phone: 2 })
    const people = buildParticipantsFromTable(t, t.mapping)
    expect(people).toEqual([
      { name: 'John Doe', email: 'john@example.com', phone: '01000000000', metadata: undefined },
      { name: 'Jane Smith', email: 'jane@example.com', phone: '01111111111', metadata: undefined },
    ])
  })

  it('handles BOM, quotes, semicolons, extra columns as metadata and reordered headers', () => {
    const t = parseCsvText('﻿Email;Full Name;Department\n"a@x.com";"Doe, John";Sales\nb@x.com;Jane;HR')
    expect(t.mapping.name).toBe(1)
    expect(t.mapping.email).toBe(0)
    const p = buildParticipantsFromTable(t, t.mapping)
    expect(p[0]).toMatchObject({ name: 'Doe, John', email: 'a@x.com', metadata: { Department: 'Sales' } })
  })

  it('combines first + last name columns', () => {
    const t = parseCsvText('First Name,Last Name,Mobile\nAhmed,Ali,+20 100 000 0000')
    expect(t.mapping.name).toBe('first_last')
    expect(buildParticipantsFromTable(t, t.mapping)[0]).toMatchObject({ name: 'Ahmed Ali', phone: '+20 100 000 0000' })
  })

  it('detects columns without a header row by content', () => {
    const t = parseCsvText('John Doe,john@example.com\nJane Smith,jane@example.com')
    expect(t.hasHeader).toBe(false)
    expect(t.mapping).toMatchObject({ name: 0, email: 1 })
    expect(buildParticipantsFromTable(t, t.mapping)).toHaveLength(2)
  })

  it('reports no name column when there is none, and skips empty names', () => {
    const t = parseCsvText('id,score\n1,5\n2,7')
    expect(t.mapping.name).toBeNull()
    expect(buildParticipantsFromTable(t, t.mapping)).toHaveLength(0)
    const u = parseCsvText('name,email\n,x@y.z\nBob,')
    expect(buildParticipantsFromTable(u, u.mapping).map((p) => p.name)).toEqual(['Bob'])
  })

  it('does not crash on malformed input', () => {
    expect(() => parseCsvText('"unterminated,quote\nfoo')).not.toThrow()
    expect(parseCsvText('').rows).toHaveLength(0)
  })

  it('TXT / pasted lines: one name per line, strips bullets and numbering', () => {
    expect(parseNameLines('John Doe\r\n\n  Jane   Smith \n1. Ahmed Ali\n- Sarah Hassan\n• Mike')).toEqual(['John Doe', 'Jane Smith', 'Ahmed Ali', 'Sarah Hassan', 'Mike'])
  })

  it('parses 1,000 rows', () => {
    const csv = 'name,email\n' + Array.from({ length: 1000 }, (_, i) => `Person ${i},p${i}@x.com`).join('\n')
    const t = parseCsvText(csv)
    expect(buildParticipantsFromTable(t, t.mapping)).toHaveLength(1000)
  })
})
