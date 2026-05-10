# Plan 03: question_number を NUMERIC(5,1) へ変更

> **サイクル**: Plan Mode 壁打ち #3 → Action（このファイル生成）
> **日付**: 2026-05-10
> **ステータス**: 承認済み・実装済み

---

## Context

実際の過去問（MIS 2023）を `/api/import` に送ったところ、以下のエラーが発生した：

```
{ "inserted": 23, "skipped": 0, "errors": [
  "Q10.1: invalid input syntax for type integer: \"10.1\"",
  "Q10.2: invalid input syntax for type integer: \"10.2\""
]}
```

Gemini プロンプトを更新し、「第10問 設問1」→ `question_number: 10.1`、「第10問 設問2」→ `question_number: 10.2` のように小数で表現するようになった。DB の `questions.question_number` は `INT NOT NULL` であるため小数を拒否していた。

---

## 実施内容

### 1. Supabase SQL Editor（手動実行）

```sql
ALTER TABLE questions
  ALTER COLUMN question_number TYPE NUMERIC(5,1);
```

既存の 23 件は `10 → 10.0` に自動変換される。UNIQUE 制約はそのまま有効。

### 2. `docs/gemini_prompt_final.md` を更新

- `question_number` に小数規則を追記（単独問: 整数、設問構造: `10.1` 形式）
- `correct_answer` に `"全員正解"` を有効値として追記

### 3. `docs/plan_01_db_schema.md` を更新

DDL 内の `question_number INT NOT NULL` → `NUMERIC(5,1) NOT NULL` に修正。

---

## コード変更なし

| ファイル | 理由 |
|---------|------|
| `src/app/api/import/route.ts` | `typeof obj.question_number === 'number'` は整数・小数どちらも通過する |
| `src/lib/supabase/types.ts` | `question_number: number` は TypeScript の `number` 型で小数を扱える |

---

## 検証方法

1. Supabase Table Editor で `question_number` 列の型が `numeric` になっていることを確認
2. Q10.1・Q10.2 を含む JSON を再度 POST → `{ inserted: 2, skipped: 0, errors: [] }` になることを確認
3. 全問（25問）を再送 → `{ inserted: 0, skipped: 25, errors: [] }` になることを確認（べき等性）
