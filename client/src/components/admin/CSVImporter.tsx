import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import { clsx } from 'clsx'
import { Button } from '../common/Button'
import { importApi } from '../../lib/api'

interface CSVImporterProps {
  bankId: number
  onSuccess?: (count: number) => void
}

interface ParsedRow {
  type?: string
  question?: string
  options?: string
  answer?: string
  hint?: string
  points?: string
  time_limit?: string
  category?: string
  difficulty?: string
  [key: string]: string | undefined
}

export function CSVImporter({ bankId, onSuccess }: CSVImporterProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    Papa.parse<ParsedRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        setRows(data)
        setHeaders(meta.fields || [])
      },
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) parseFile(f)
  }, [parseFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }, [parseFile])

  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await importApi.csv(bankId, fd)
      setResult(res)
      if (res.imported > 0) onSuccess?.(res.imported)
    } catch (e) {
      setResult({ imported: 0, errors: ['Upload failed. Please try again.'] })
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setRows([])
    setHeaders([])
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const expectedCols = ['type', 'question', 'options', 'answer', 'hint', 'points', 'time_limit', 'category', 'difficulty']

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
            isDragging
              ? 'border-unoh-red bg-unoh-red/10'
              : 'border-gray-600 hover:border-gray-400 bg-gray-900'
          )}
        >
          <div className="text-4xl mb-3">📁</div>
          <div className="text-white font-semibold mb-1">
            Drop your CSV file here or click to browse
          </div>
          <div className="text-gray-400 text-sm">Accepts .csv files only</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Expected columns hint */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Expected Columns</div>
        <div className="flex flex-wrap gap-2">
          {expectedCols.map(col => (
            <span key={col} className={clsx(
              'px-2 py-0.5 rounded text-xs font-mono',
              headers.includes(col)
                ? 'bg-green-900 text-green-300 border border-green-700'
                : 'bg-gray-800 text-gray-400'
            )}>
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-300">
              Preview: <span className="text-white">{rows.length}</span> questions found
            </div>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-red-400">
              Remove file
            </button>
          </div>
          <div className="overflow-auto rounded-xl border border-gray-700 max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  {headers.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap border-b border-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                    {headers.map(h => (
                      <td key={h} className="px-3 py-2 text-gray-300 max-w-xs truncate">
                        {row[h] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length > 10 && (
                  <tr>
                    <td colSpan={headers.length} className="px-3 py-2 text-center text-gray-500 italic">
                      ... and {rows.length - 10} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              loading={uploading}
              onClick={handleImport}
            >
              Import {rows.length} Questions
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={clsx(
          'rounded-xl border p-4',
          result.imported > 0 ? 'bg-green-950 border-green-700' : 'bg-red-950 border-red-700'
        )}>
          {result.imported > 0 && (
            <div className="text-green-300 font-bold mb-2">
              ✓ Successfully imported {result.imported} questions!
            </div>
          )}
          {result.errors.length > 0 && (
            <div>
              <div className="text-red-300 font-semibold mb-1">Errors ({result.errors.length}):</div>
              <ul className="list-disc list-inside text-red-400 text-sm space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
