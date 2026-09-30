import { describe, expect, it } from 'vitest'
import { buildParticipantsFromTable, parsePastedNames, tableFromRows } from '../csv/participantsCsv'
import { ImportError, jsonToImport, readParticipantFile, wordHtmlToImport } from './fileImport'

const namesOf = (f: ReturnType<typeof wordHtmlToImport>) =>
  f.kind === 'lines' ? f.names : buildParticipantsFromTable(f.sheets[0].table, f.sheets[0].table.mapping).map((p) => p.name)

describe('tableFromRows (Excel / Word / JSON rows)', () => {
  it('handles numbers, dates, nulls and empty columns like a spreadsheet', () => {
    const t = tableFromRows([
      ['Full Name', null, 'Email', 'Mobile', 'Joined'],
      ['Ahmed Ali', null, 'a@x.com', 201001234567, new Date('2026-01-05T00:00:00Z')],
      [null, null, null, null, null],
      ['  Sarah   Hassan ', null, 'S@x.com', 1000, null],
    ])
    expect(t.headers).toEqual(['Full Name', 'Email', 'Mobile', 'Joined'])
    expect(t.mapping).toMatchObject({ name: 0, email: 1, phone: 2 })
    const p = buildParticipantsFromTable(t, t.mapping)
    expect(p.map((x) => x.name)).toEqual(['Ahmed Ali', 'Sarah Hassan'])
    expect(p[0]).toMatchObject({ phone: '201001234567', metadata: { Joined: '2026-01-05' } })
  })
})

describe('Word documents', () => {
  it('uses the biggest table', () => {
    const html = `<p>Guest list</p>
      <table><tr><td>x</td></tr></table>
      <table><tr><th>Name</th><th>Department</th></tr><tr><td>John Doe</td><td>Sales</td></tr><tr><td>Jane Smith</td><td>HR</td></tr></table>`
    const f = wordHtmlToImport(html, 'guests.docx')
    expect(f.kind).toBe('table')
    expect(namesOf(f)).toEqual(['John Doe', 'Jane Smith'])
  })

  it('falls back to one name per paragraph or list item', () => {
    const f = wordHtmlToImport('<h1>Attendees</h1><ol><li>John Doe</li><li>Jane Smith</li></ol><p>Ahmed Ali</p><p></p>', 'names.docx')
    expect(f.kind).toBe('lines')
    expect(namesOf(f)).toEqual(['John Doe', 'Jane Smith', 'Ahmed Ali'])
  })

  it('explains when there is nothing to import', () => {
    expect(() => wordHtmlToImport('<p> </p>', 'empty.docx')).toThrow(ImportError)
  })
})

describe('JSON', () => {
  it('accepts a list of names, a list of objects, or {participants: [...]}', () => {
    expect(namesOf(jsonToImport(['Ann', 'Bob'], 'a.json'))).toEqual(['Ann', 'Bob'])
    expect(namesOf(jsonToImport([{ name: 'Ann', email: 'a@x.com' }, { name: 'Bob' }], 'b.json'))).toEqual(['Ann', 'Bob'])
    expect(namesOf(jsonToImport({ participants: [{ fullName: 'Cat Lee' }] }, 'c.json'))).toEqual(['Cat Lee'])
    expect(() => jsonToImport({ foo: 1 }, 'd.json')).toThrow(ImportError)
  })
})

describe('pasting from Excel', () => {
  it('detects the name column in multi-column (tab-separated) pastes', () => {
    expect(parsePastedNames('Name\tEmail\nJohn Doe\tj@x.com\nJane Smith\tjane@x.com')).toEqual(['John Doe', 'Jane Smith'])
    expect(parsePastedNames('j@x.com\tJohn Doe\nk@x.com\tKate Moss')).toEqual(['John Doe', 'Kate Moss'])
  })
  it('keeps plain one-per-line pastes working', () => {
    expect(parsePastedNames('John Doe\n\nJane Smith')).toEqual(['John Doe', 'Jane Smith'])
  })
})

describe('readParticipantFile', () => {
  it('gives friendly guidance for old or unsupported formats', async () => {
    await expect(readParticipantFile(new File(['x'], 'list.xls'))).rejects.toThrow(/Save As/)
    await expect(readParticipantFile(new File(['x'], 'list.doc'))).rejects.toThrow(/\.docx/)
    await expect(readParticipantFile(new File(['x'], 'list.pdf'))).rejects.toThrow(/PDF/)
    await expect(readParticipantFile(new File([], 'empty.csv'))).rejects.toThrow(/empty/)
  })
  it('reads CSV and TXT', async () => {
    const csv = await readParticipantFile(new File(['name,email\nAnn,a@x.com'], 'a.csv'))
    expect(namesOf(csv)).toEqual(['Ann'])
    const txt = await readParticipantFile(new File(['Ann\nBob'], 'a.txt'))
    expect(namesOf(txt)).toEqual(['Ann', 'Bob'])
  })
})
