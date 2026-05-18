'use client'

import { useRef, useState } from 'react'
import MarkdownRenderer from '@/components/MarkdownRenderer'

type ImageEntry = {
  id: number
  url: string
  display_order: number
}

export default function QuestionEditor({
  questionId,
  initialQuestionText,
  initialExplanation,
  images: initialImages,
}: {
  questionId: number
  initialQuestionText: string
  initialExplanation: string
  images: ImageEntry[]
}) {
  const [questionText, setQuestionText] = useState(initialQuestionText)
  const [explanation, setExplanation] = useState(initialExplanation)
  const [images, setImages] = useState<ImageEntry[]>(initialImages)
  const [previewText, setPreviewText] = useState(false)
  const [previewExp, setPreviewExp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  async function handleSave() {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: questionText, explanation: explanation || null }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadFile(file: File) {
    if (uploading) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('question_id', String(questionId))
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const { error } = await res.json()
        alert(`アップロード失敗: ${error}`)
        return
      }
      const { data } = await res.json()
      setImages((prev) => [...prev, { id: data.id, url: data.url, display_order: data.display_order }])
    } catch {
      alert('アップロード中にエラーが発生しました')
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  async function handleDelete(imageId: number) {
    if (!confirm('この画像を削除しますか？')) return
    const res = await fetch(`/api/question-images/${imageId}`, { method: 'DELETE' })
    if (res.ok) {
      setImages((prev) => prev.filter((img) => img.id !== imageId))
    } else {
      alert('削除に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      {/* 問題文 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">問題文</label>
          <button
            onClick={() => setPreviewText((v) => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            {previewText ? '編集に戻る' : 'プレビュー'}
          </button>
        </div>
        {previewText ? (
          <div className="prose prose-sm max-w-none bg-white border border-gray-100 rounded-xl p-4 min-h-[120px]">
            <MarkdownRenderer>{questionText}</MarkdownRenderer>
          </div>
        ) : (
          <textarea
            value={questionText}
            onChange={(e) => { setQuestionText(e.target.value); setSaveStatus('idle') }}
            rows={8}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
          />
        )}
      </section>

      {/* 解説 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">解説</label>
          <button
            onClick={() => setPreviewExp((v) => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            {previewExp ? '編集に戻る' : 'プレビュー'}
          </button>
        </div>
        {previewExp ? (
          <div className="prose prose-sm max-w-none bg-white border border-gray-100 rounded-xl p-4 min-h-[80px]">
            <MarkdownRenderer>{explanation}</MarkdownRenderer>
          </div>
        ) : (
          <textarea
            value={explanation}
            onChange={(e) => { setExplanation(e.target.value); setSaveStatus('idle') }}
            rows={6}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
          />
        )}
      </section>

      {/* 保存ボタン */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : 'テキストを保存する'}
        </button>
        {saveStatus === 'saved' && (
          <span className="text-sm text-green-600 font-medium">✓ 保存しました</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-sm text-red-600 font-medium">保存に失敗しました</span>
        )}
      </div>

      {/* 画像 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">画像</label>
          <span className="text-xs text-gray-400">（アップロード後すぐに自動保存）</span>
        </div>

        {images.length > 0 && (
          <div className="space-y-2">
            {images.map((img) => (
              <div key={img.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`question image ${img.id}`}
                  className="max-h-48 rounded-lg object-contain border border-gray-100"
                />
                <button
                  onClick={() => handleDelete(img.id)}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ドラッグ＆ドロップ / ファイル選択 */}
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
        >
          {uploading ? (
            <span className="text-sm text-gray-400">アップロード中...</span>
          ) : (
            <>
              <span className="text-2xl">🖼</span>
              <span className="text-sm text-gray-500">ここにドラッグ or クリックして画像を追加</span>
              <span className="text-xs text-gray-400">JPEG / PNG / WebP / GIF · 最大 5MB</span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </section>
    </div>
  )
}
