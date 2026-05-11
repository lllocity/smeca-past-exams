# Plan 09: ダッシュボード改善・問題パーマリンク・セッション完走記録

## Context

Plan 08 で実装したダッシュボードに対し、以下のフィードバックが挙がった：
- 科目コードのみで日本語名が分かりづらい
- 苦手問題の正答率が「X/Y回正解」表示でなく「%」が欲しい
- 苦手問題からクイズページへ直リンクできるパーマリンクが欲しい
- 正答率をクイズ解説欄にも表示してほしい
- 全体進捗バーは不要（科目×年度バーで十分）
- 科目×年度の正答率は「通しで完走したセッション」だけを記録すべき

`session_completions` テーブルは Supabase で作成済み（SQL 実行完了）。

---

## 変更内容

### 1. `session_completions` への完走ログ記録 (`QuizSession.tsx`)

- `isFinished` が `true` になった瞬間に一度だけ INSERT（`useEffect` + `useRef` フラグで重複防止）
- リセット時は `sessionId` を `crypto.randomUUID()` で再生成し、フラグもリセット → 再完走で再記録可能
- `session_id UNIQUE` 制約があるため二重 INSERT は DB 側でも防がれる

```typescript
// QuizSession.tsx に追加
const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
const completionLoggedRef = useRef(false)

useEffect(() => {
  if (!isFinished || completionLoggedRef.current) return
  completionLoggedRef.current = true
  createClient().from('session_completions').insert({
    user_id: userId,
    session_id: sessionId,
    subject_code: subject,
    year: year,
    correct: score.correct,
    total: total,
  }) // eslint lint 対応: deps に全参照変数を列挙
}, [isFinished, sessionId, userId, subject, year, score.correct, total])
// ※ subject/year/userId/total はセッション中不変のため実質再実行されない
// ※ React StrictMode で二重起動しても session_id UNIQUE 制約が二重 INSERT を防ぐ

function handleReset() {
  // ... existing reset
  setSessionId(crypto.randomUUID())
  completionLoggedRef.current = false
}
```

### 2. 問題パーマリンク (`/quiz/[subject]/[year]/[question_number]/page.tsx`)

新規 Server Component。回答選択不要の読み取り専用ページ。

- ヘッダー: 科目コード・日本語名・年度・問番号・配点
- 問題文（ReactMarkdown）
- 全選択肢（正解のみ緑ハイライト表示）※ `correct_answer === '全員正解'` の問題は全選択肢を緑表示
- 解説（ReactMarkdown）
- ユーザーの過去正答率（ログがあれば表示、なければ「初回」）
- 「← ダッシュボードへ」リンク

URL 例: `/quiz/ECO/2024/12`、`/quiz/ECO/2024/10.1`（小数 question_number 対応）

### 3. クイズ解説欄に過去正答率を追加 (`QuizSession.tsx`)

`/quiz/[subject]/[year]/page.tsx` でセッション開始前の過去ログを取得し、`history` prop として渡す。解説欄（`isAnswered` 時）にその問題の過去正答率を表示。

```typescript
// quiz/[subject]/[year]/page.tsx で追加取得
const { data: histLogs } = await supabase
  .from('user_logs')
  .select('question_id, is_correct')
  .eq('user_id', user!.id)
  .in('question_id', questions.map(q => q.id))

const history: Record<number, { correct: number; total: number }> = {}
for (const log of histLogs ?? []) {
  if (!history[log.question_id]) history[log.question_id] = { correct: 0, total: 0 }
  history[log.question_id].correct += log.is_correct ? 1 : 0
  history[log.question_id].total += 1
}
// → <QuizSession ... history={history} />
```

解説欄での表示:
```
過去の正答率: 67%（2/3回）  ← ログあり
初挑戦                       ← ログなし
```

### 4. ダッシュボード改修 (`dashboard/page.tsx`)

| 変更 | 内容 |
|------|------|
| 全体進捗セクション削除 | 科目×年度バーで代替可能のため削除 |
| 科目コード + 日本語名 | バー・苦手問題リスト両方で `ECO — 経済学・経済政策` 形式で表示 |
| 苦手問題の正答率表示 | `1/2回正解` → `50%（1/2回）` |
| 苦手問題パーマリンク | 各問題を `/quiz/{subject}/{year}/{question_number}` へリンク |
| 科目×年度スコアの取得元変更 | `user_logs` から `session_completions` へ切替（完走データのみ） |

ダッシュボードの2クエリ構成（責務分離）:
```typescript
// ① session_completions → 科目×年度バー用
const { data: completions } = await supabase
  .from('session_completions')
  .select('subject_code, year, correct, total, completed_at')
  .eq('user_id', user!.id)
  .order('completed_at', { ascending: false })

// 科目×年度ごとに最新1件（order desc なので最初に出たものが最新）
const subjectYearMap = new Map<string, { correct: number; total: number; pct: number }>()
for (const c of completions ?? []) {
  const key = `${c.subject_code}::${c.year}`
  if (!subjectYearMap.has(key)) {
    subjectYearMap.set(key, {
      correct: c.correct,
      total: c.total,
      pct: Math.round((c.correct / c.total) * 100),
    })
  }
}

// ② user_logs → 苦手問題リスト・日別解答数用（question_tags JOIN 維持）
const { data: logs } = await supabase
  .from('user_logs')
  .select('question_id, is_correct, answered_at, questions(subject_code, year, question_number, question_tags(tags(name)))')
  .eq('user_id', user!.id)
  .order('answered_at', { ascending: false })
```

完走記録がない場合（`completions.length === 0`）は「まだ完走記録がありません」と表示（初回デプロイ後・既存ユーザーにも考慮）。

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/lib/supabase/types.ts` | 修正 | `session_completions` テーブル型追加 |
| `src/components/QuizSession.tsx` | 修正 | 完走 INSERT・reset 時 sessionId 再生成・過去正答率表示 |
| `src/app/quiz/[subject]/[year]/page.tsx` | 修正 | 過去ログ取得・`history` prop 追加 |
| `src/app/quiz/[subject]/[year]/[question_number]/page.tsx` | 新規 | 問題パーマリンク（Server Component） |
| `src/app/dashboard/page.tsx` | 修正 | 全体進捗削除・日本語名追加・session_completions 参照・%表示・リンク |
| `docs/plan_09_dashboard_v2.md` | 新規 | このプランのコピー |

---

## 検証方法

1. MIS 2023 を通しで完走 → ダッシュボードの科目×年度バーに反映されることを確認
2. 途中で離脱（全問解かずリロード）→ バーに反映されないことを確認
3. 同じセットを2回完走 → 最新スコアで上書きされていることを確認
4. 苦手問題リストの「ECO 2024 第12問」をクリック → `/quiz/ECO/2024/12` でその問題が正解込みで表示されることを確認
5. クイズ中に問題に回答 → 解説欄に過去正答率（または「初挑戦」）が表示されることを確認
6. 科目バーとヘッダーに日本語名が表示されていることを確認
