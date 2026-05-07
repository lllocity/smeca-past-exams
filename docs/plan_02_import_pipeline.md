# Plan 02: Gemini インポートパイプライン設計

> **サイクル**: Plan Mode 壁打ち #2 → Action（このファイル生成）
> **日付**: 2026-05-07
> **ステータス**: 承認済み・実装済み

---

## Context

過去問PDFをDBに取り込む一連のフロー（PDF → Gemini → JSON → API → DB）を実装する。
`docs/proposal_prompt.md`（Gemini プロンプト初期案）は plan_01 確定前に作成されたものであり、
確定 DB スキーマ（plan_01）との間に 2 つのズレがあった。

**ズレ①**: `has_image` フィールドが `questions` テーブルから削除された
**ズレ②**: `tags TEXT[]` が `questions` テーブルから削除された（正規化テーブルへ）

確定 DB スキーマが真として、Gemini プロンプトと API をそれに合わせる。

---

## 全体フロー

```
① 公式サイトから過去問 PDF を手動ダウンロード
       ↓
② Gemini に docs/gemini_prompt_final.md のプロンプト + PDF を入力
       ↓
③ Gemini が JSON 配列を出力
       ↓
④ POST /api/import に JSON を送信（Authorization: Bearer <IMPORT_SECRET>）
       ↓
⑤ API が questions / tags / question_tags テーブルに UPSERT
       ↓
⑥ レスポンスで { inserted, skipped, errors } を確認
```

---

## Gemini JSON スキーマ（確定版）

`has_image` フィールドは**削除**。図表がある場合は `question_text` 末尾に注釈を直接埋め込む。

```typescript
type GeminiQuestion = {
  subject_code: 'ECO' | 'FIN' | 'MGT' | 'OPS' | 'LAW' | 'MIS' | 'SME'
  year: number
  question_number: number
  points: number
  question_text: string  // 図表がある場合は末尾に注釈を直接埋め込む
  options: Array<{ label: string; text: string }>
  correct_answer: string
  explanation: string | null
  tags: string[]         // API 側で tags + question_tags テーブルに正規化
}
```

### 各フィールドと DB テーブルの対応

| JSON フィールド | DB の保存先 | 変換処理 |
|---------------|------------|---------|
| subject_code〜explanation | `questions` テーブル | そのまま |
| tags[] | `tags` + `question_tags` テーブル | API 側で正規化 |
| ~~has_image~~ | なし（削除） | `question_text` 内注釈で代替 |

---

## 実装コンポーネント

### 1. `docs/gemini_prompt_final.md`

`proposal_prompt.md` から `has_image` フィールドを削除した確定版プロンプト。

### 2. `src/app/api/import/route.ts`

**認証**: `Authorization: Bearer ${IMPORT_SECRET}`
**DB**: `SUPABASE_SERVICE_ROLE_KEY` で RLS バイパス

**処理フロー**:
1. Bearer トークン検証
2. JSON ボディをパース・バリデーション
3. 各問題を処理:
   - `questions` に `INSERT ... ON CONFLICT DO NOTHING`
   - スキップされた場合は `SELECT id` で既存 ID を取得
   - `tags[]` を `tags` テーブルに `UPSERT`（id を取得）
   - `question_tags` に `INSERT ... ON CONFLICT DO NOTHING`
4. `{ inserted, skipped, errors }` を返却

### 3. `src/lib/supabase/types.ts`

`confidence_flag: string | null` → `'confident' | 'guess' | null`（型の narrowing）

---

## 環境変数

```env
IMPORT_SECRET=<openssl rand -hex 32 で生成>
SUPABASE_SERVICE_ROLE_KEY=<Supabase の sb_secret_... キー>
```

---

## 検証方法

1. `IMPORT_SECRET` なしで POST → 401
2. 正しいトークンで JSON（3〜5問）を POST → `{ inserted: 3, skipped: 0, errors: [] }`
3. 同じ JSON を再送 → `{ inserted: 0, skipped: 3, errors: [] }`（べき等性）
4. Supabase Table Editor で `questions` / `tags` / `question_tags` を目視確認
