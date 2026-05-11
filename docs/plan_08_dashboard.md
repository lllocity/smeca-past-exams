# Plan 08: ダッシュボード

## Context

user_logs への回答記録（plan_07）が完成した。蓄積したログを可視化するダッシュボードを作る。  
CLAUDE.md の要件は「全体の進捗率・科目ごとの正解率・日ごとの解答数の可視化」。  
グラフライブラリは追加せず、CSS ベースのバーで実装してシンプルに保つ。

---

## 表示内容

### 1. 全体進捗
- 解いた問題数（ユニーク question_id） / 全問題数 → 進捗率バー

### 2. 科目×年度別 最新セッション正答率
- 解いた（科目×年度）の組み合わせごとに横バーを表示
- スコアは**その科目×年度を最後に演習したセッションの正答率**（複数回やり直しても上書き）
- 表示例: `ECO 2024  ████████░░  80%（直近 16/20 問正解）`
- **Why**: 「直近にやった時点での実力」を科目×年度単位で把握し、どのセットを再演習すべきか判断するため

### 3. 苦手問題リスト
- **科目ごとにセクション分け**（年度横断）し、**複数回解いた問題**の中で正答率が低い順に上位3問を表示
- 表示: 年度・問番号・正答率（X/Y回正解）・タグ（論点名）
- **Why**: 「ECO の中でどの問題が苦手か」を年度をまたいで把握し、科目単位の再演習ポイントを特定するため
- タグが付いている問題は論点名を表示し、「この論点が苦手」という傾向把握を助ける

### 4. 日別解答数（直近30日）
- 縦バーグラフ（CSS flex）
- **Why**: 学習習慣の継続状況を可視化するため

---

## データ取得設計

Server Component（`src/lib/supabase/server.ts` の `createClient()` を使用）。

```typescript
// ① 全問題数
const { count: totalQuestions } = await supabase
  .from('questions')
  .select('*', { count: 'exact', head: true })

// ② ログ + 問題情報（JOIN）—— タグも含めて取得
const { data: logs } = await supabase
  .from('user_logs')
  .select(`
    question_id, is_correct, answered_at, session_id,
    questions(subject_code, year, question_number, question_tags(tags(name)))
  `)
  .eq('user_id', user!.id)
  .order('answered_at', { ascending: false })
```

Supabase JS は GROUP BY 非対応のため、集計はサーバー側の JS で実施：
- `new Set(logs.map(l => l.question_id)).size` → ユニーク解答数
- 科目×年度別 最新セッション正答率:
  - `Map<"ECO::2024", Map<session_id, {correct, total, maxAnsweredAt}>>` で全セッション集計
  - 各科目×年度の中で `maxAnsweredAt` が最大の session_id のスコアを採用
- 苦手問題リスト（科目ごと・年度横断）:
  - `Map<subject_code, Map<question_id, {correct, total, year, question_number, tags}>>` で集計
  - 各科目内で `correct/total` 昇順ソート → 上位3問を抽出（total >= 2 のみ対象）
- `Map<date_string, count>` → 日別集計（直近30日）

---

## ファイル構成

```
src/app/
├── dashboard/
│   └── page.tsx          ← 新規（Server Component）
└── page.tsx              ← 修正（ダッシュボードへのリンク追加）
```

コンポーネント分割はせず、`dashboard/page.tsx` 内にすべてインラインで実装（ダッシュボード固有の小さなUI部品のため）。

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/app/dashboard/page.tsx` | 新規作成 | ダッシュボード（Server Component） |
| `src/app/page.tsx` | 修正 | ヘッダーに「ダッシュボード」リンク追加 |
| `docs/plan_08_dashboard.md` | 新規作成 | このプランのコピー |

---

## 検証方法

1. 数問回答してからダッシュボードを開き、解答数・正解率が反映されていることを確認
2. 科目別バーが正しい科目に表示されることを確認
3. 日別バーで今日の解答数が表示されることを確認
4. 未解答の科目はグレーで「未挑戦」と表示されることを確認
