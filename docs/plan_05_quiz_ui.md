# Plan 05: 演習画面（一問一答）

> **サイクル**: Plan Mode 壁打ち #5 → Action（このファイル生成）
> **日付**: 2026-05-10
> **ステータス**: 承認済み・実装済み

---

## Context

DB にデータが入ったため、アプリのコア機能である演習画面を実装した。  
この段階では回答ログの保存はしない（Supabase Auth が未設定）。スコアはセッション中のローカル state のみで管理。

---

## ルーティング設計

```
/                              → 科目・年度選択
/quiz/[subject]/[year]         → クイズセッション（ブックマーク・共有可能）
```

---

## 実装ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/page.tsx` | Server Component。questions から subject+year の件数を集計して SubjectGrid に渡す |
| `src/app/quiz/[subject]/[year]/page.tsx` | Server Component。questions を取得して QuizSession に渡す。無効な科目・年度は 404 |
| `src/components/SubjectGrid.tsx` | Client Component。2カラムグリッド、カードタップで年度アコーディオン展開 |
| `src/components/QuizSession.tsx` | Client Component。一問一答 UI。スコア・進捗バー・解説・最終スコア画面 |

---

## 依存追加

- `react-markdown`: question_text・explanation の Markdown レンダリング

---

## 特記事項

- `correct_answer === '全員正解'` の場合: 全選択肢を正解色にし、どれを選んでも correct としてカウント
- `options` フィールドは DB 型が `Json` のため `as { label: string; text: string }[]` でキャスト
- `question_number` は NUMERIC(5,1) のため `String()` でそのまま表示（10.1 などが正しく表示される）
