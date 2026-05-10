# Plan 01: DB スキーマ設計（ハイブリッド型・推奨案）

> **サイクル**: Plan Mode 壁打ち #1 → Action（このファイル生成）
> **日付**: 2026-05-07
> **ステータス**: 承認済み・実装待ち

---

## このドキュメントの目的

たたき台DDL（3テーブル構成）を6つの観点でクロスレビューし、
各設計判断について「なぜ変えるべきか / なぜ変えなくていいか」の根拠を明示する。

---

## 前提：このアプリの設計制約

| 制約 | 内容 |
|------|------|
| 利用者 | 個人（本人1名）|
| 規模 | 全7科目 × 約20年分 × 約30問 ≒ **最大4,200問**（十分小規模）|
| インフラ | Supabase Free Tier（DB 500MB上限）|
| 学習目的 | RDB・SQL・正規化の実践学習（試験範囲でもある）|
| 開発工数 | できるだけ省エネに（一人開発）|

---

## クロスレビュー：6つの課題と判断

---

### 課題① `tags TEXT[]` — 集計クエリの複雑さ問題

#### たたき台の実装
```sql
tags TEXT[] DEFAULT '{}'   -- 例: {'需要曲線', 'IS-LMモデル', '比較優位'}
```

#### 問題が起きる具体的なクエリ

「自分が最も間違えた論点タグTop5を出す」ダッシュボードクエリ：

```sql
-- TEXT[] のまま集計しようとすると unnest() が必要になる
SELECT
    unnest(q.tags) AS tag_name,
    COUNT(*) FILTER (WHERE ul.is_correct = FALSE) AS wrong_count,
    COUNT(*) AS total
FROM user_logs ul
JOIN questions q ON ul.question_id = q.id
GROUP BY tag_name
ORDER BY wrong_count DESC
LIMIT 5;
```

`unnest()` 自体は PostgreSQL の合法な構文で動作するが、**問題は typo リスク**。
`'IS-LMモデル'` と `'IS-LMモデル '`（末尾スペース）が混入すると、別タグとして集計される。
TEXT[] は挿入時の値を誰も検証しない。

#### 正規化した場合のクエリ

```sql
-- tags + question_tags テーブルで同じ集計（シンプルなJOIN）
SELECT
    t.name AS tag_name,
    COUNT(*) FILTER (WHERE ul.is_correct = FALSE) AS wrong_count,
    COUNT(*) AS total
FROM user_logs ul
JOIN questions q ON ul.question_id = q.id
JOIN question_tags qt ON q.id = qt.question_id
JOIN tags t ON qt.tag_id = t.id
GROUP BY t.name
ORDER BY wrong_count DESC
LIMIT 5;
```

DB側でUNIQUE制約が効いているため、typoが混入しない。管理画面でタグ名を一箇所修正すれば全問題に反映される。

#### 判断

> **✅ tags を正規化（M:Nテーブル化）すべき**
> Why: 「論点タグごとの誤答傾向集計」が主要要件として明示されている。集計クエリの正確性と保守性を担保するには DB レベルの整合性（UNIQUE制約）が必要。TEXT[] だと typo による集計ズレが静かに混入する。
> また、`tags（M:N）`は試験範囲のRDB正規化の教材として最良の素材でもある。

---

### 課題② `user_logs` に `user_id` がない

#### たたき台の実装
```sql
CREATE TABLE user_logs (
    id          BIGSERIAL PRIMARY KEY,
    question_id BIGINT REFERENCES questions(id),
    -- user_id が存在しない
    ...
);
```

#### なぜ個人利用でも問題になるか

Supabase は「Row Level Security（RLS）」でテーブルのアクセス制御をする。
RLS を**無効のまま**にすると、APIキーが漏洩した瞬間に全ログが外部から読み書きされる。
RLS を有効化するには `auth.uid() = user_id` というポリシーが必要で、`user_id` 列が必須。

```sql
-- RLS を有効化する場合に必要なポリシー
CREATE POLICY "own logs only" ON user_logs
    USING (auth.uid() = user_id);  -- ← user_id がないと書けない
```

#### 判断

> **✅ `user_id UUID REFERENCES auth.users(id)` を追加すべき**
> Why: Supabase で安全にテーブルを公開するには RLS が事実上必須。個人利用でも「最初から正しい設計にする」ことが学習目的とも一致する。後から追加すると既存ログのマイグレーションコストがかかる。

---

### 課題③ `has_image BOOLEAN` — 画像URLを保存できない

#### たたき台の実装
```sql
has_image BOOLEAN DEFAULT FALSE
```

#### 何が足りないか

管理画面で画像をアップロードした後、Next.js は Supabase Storage の URL を取得する。
この URL を **どこにも保存する場所がない**。
フラグが `TRUE` になっても、実際の画像をどこから取得すればいいかわからない。

#### 解決策の選択肢

**案A: `questions.image_urls TEXT[]` 列を追加**
```sql
image_urls TEXT[] DEFAULT '{}'
```
- シンプルだが、アップロード日時・表示順序を管理できない

**案B: `question_images` 別テーブル（採用）**
```sql
CREATE TABLE question_images (
    id           SERIAL PRIMARY KEY,
    question_id  BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    display_order INT DEFAULT 0,
    uploaded_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 判断

> **✅ `question_images` 別テーブル（案B）を採用すべき**
> Why: 1問に複数画像が必要なケース（経済学のグラフ + 数値表 など）が現実に存在する。管理画面のドラッグ&ドロップで複数枚アップロードした場合に対応するには、別テーブルで `display_order` を持つ必要がある。

---

### 課題④ UNIQUE制約の欠落 — 重複インポートの危険

#### たたき台の実装
```sql
-- (subject_code, year, question_number) の UNIQUE 制約がない
```

#### 何が起きるか

Gemini で生成した JSON を `/api/import` で流し込む際、同じファイルを2回実行すると全問題が2重登録される。エラーにならず静かにデータが汚染される。

```sql
-- UNIQUE 制約があれば、べき等なインポートが実現できる
INSERT INTO questions (subject_code, year, question_number, ...)
VALUES ('MIS', 2023, 5, ...)
ON CONFLICT (subject_code, year, question_number) DO NOTHING;
```

#### 判断

> **✅ `UNIQUE(subject_code, year, question_number)` を追加すべき**
> Why: インポートAPIをべき等（何度実行しても同じ結果）にするための前提条件。コストゼロで重大なデータ汚染リスクを排除できる。

---

### 課題⑤ インデックスの欠落

#### 主要クエリの分析

| クエリ | 必要なインデックス |
|--------|------------------|
| `WHERE subject_code='MIS' AND year=2023` | `(subject_code, year)` 複合インデックス |
| `WHERE question_id = $1`（ログ集計） | `question_id` インデックス |
| `WHERE user_id = $1` | `user_id` インデックス |

#### 判断

> **✅ インデックスを明示的に追加すべき**
> Why: 今のデータ規模では問題ないが、最初から正しいインデックス設計を学ぶことが試験範囲の実践学習として有意義。定義コストはゼロ。

---

### 課題⑥ セッション概念の欠落

#### 要件
「セッション内のリアルタイム得点表示」（演習中のスコアを画面上に表示する）

#### セッション得点の集計方法

**案A: フロントエンドのみで管理**
- React の useState でセッション中の正解数を管理
- シンプルだが、ページリロード時にリセットされる

**案B: `session_id UUID` を `user_logs` に追加（採用）**
- クライアント側で演習開始時に `crypto.randomUUID()` を生成
- 同じセッションの回答は全て同じ `session_id` で記録
- 過去セッションのスコアをいつでも集計可能

#### 判断

> **✅ `session_id UUID` を `user_logs` に追加すべき**
> Why: 「昨日の演習で何問正解したか」という過去セッションの振り返りがダッシュボードの主要ユースケース。フロントのみで管理するとリロード時に喪失する。

---

### 保留：`options JSONB` について（変えない理由）

#### たたき台の実装（維持）
```sql
options JSONB NOT NULL   -- [{"label":"ア","text":"..."},{"label":"イ","text":"..."}]
```

#### 正規化する場合との比較

| 観点 | JSONB | question_choices テーブル |
|------|-------|--------------------------|
| Geminiインポートの実装 | そのまま挿入できる | choicesをループしてinsertが必要 |
| 演習画面での取得 | 1クエリで完結 | questions JOIN question_choices |
| 選択肢ごとの集計 | 不可 | 可能 |
| 個人アプリの要件 | 「どの選択肢が多く選ばれたか」は不要 | 不要 |

#### 判断

> **✅ `options JSONB` を維持（変えない）**
> Why: 正規化のメリット（選択肢ごとの集計）を活かす要件がなく、正規化するとインポートAPIが複雑になるコストが発生するだけ。「変えなくていいものは変えない」原則に従う。

---

## 推奨設計（まとめ）

### 採用する変更

| 項目 | たたき台 | 推奨 | Why |
|------|---------|------|-----|
| tags | `TEXT[]` | `tags` + `question_tags` テーブル | 集計精度・typo防止・正規化学習 |
| 画像管理 | `has_image BOOLEAN` | `question_images` テーブル | Storage URLの保存・複数画像対応 |
| user_logs.user_id | 欠落 | `UUID REFERENCES auth.users` | RLSポリシーの必須要件 |
| user_logs.session_id | 欠落 | `UUID`（クライアント生成） | セッション得点の過去参照 |
| UNIQUE制約 | 欠落 | `UNIQUE(subject_code, year, question_number)` | べき等インポートの実現 |
| インデックス | 欠落 | 主要クエリ3本分 | 正しい設計の実践学習 |

### 変えないもの

| 項目 | Why |
|------|-----|
| `options JSONB` | 集計要件なし・インポートがシンプル |
| `subjects` テーブルの構造 | 変更不要 |

---

## 推奨DDL（最終版）

```sql
-- 1. 科目マスタ（変更なし）
CREATE TABLE subjects (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- 2. 問題テーブル（tags列削除・has_image削除・UNIQUE制約追加）
CREATE TABLE questions (
    id             BIGSERIAL PRIMARY KEY,
    subject_code   VARCHAR(10) NOT NULL REFERENCES subjects(code) ON DELETE RESTRICT,
    year           INT NOT NULL,
    question_number NUMERIC(5,1) NOT NULL,  -- 整数問: 1, 設問構造: 10.1, 10.2
    points         INT NOT NULL DEFAULT 4,
    question_text  TEXT NOT NULL,
    options        JSONB NOT NULL,           -- [{"label":"ア","text":"..."},...]
    correct_answer VARCHAR(5) NOT NULL,
    explanation    TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (subject_code, year, question_number)
);
CREATE INDEX idx_questions_subject_year ON questions(subject_code, year);

-- 3. 論点タグマスタ（新規：正規化）
CREATE TABLE tags (
    id           SERIAL PRIMARY KEY,
    subject_code VARCHAR(10) REFERENCES subjects(code) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    UNIQUE (subject_code, name)              -- typoを防ぎ、タグ名を一意に保つ
);

-- 4. 問題↔タグ 中間テーブル（新規：M:N関係）
CREATE TABLE question_tags (
    question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    tag_id      INT    REFERENCES tags(id)      ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- 5. 問題画像テーブル（新規：Supabase Storage パスを保持）
CREATE TABLE question_images (
    id           SERIAL PRIMARY KEY,
    question_id  BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,              -- 例: 'question-images/2023/MIS/q5.png'
    display_order INT DEFAULT 0,
    uploaded_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 学習ログ（user_id・session_id追加）
CREATE TABLE user_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL,           -- 演習開始時にクライアントで crypto.randomUUID() 生成
    question_id     BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    is_correct      BOOLEAN NOT NULL,
    confidence_flag VARCHAR(10),             -- 'confident' | 'guess'
    answered_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_user_logs_user ON user_logs(user_id);
CREATE INDEX idx_user_logs_session ON user_logs(session_id);
CREATE INDEX idx_user_logs_question ON user_logs(question_id);

-- RLS（自分のログのみ読み書き）
ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs only" ON user_logs
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 初期データ
INSERT INTO subjects (code, name) VALUES
('ECO', '経済学・経済政策'),
('FIN', '財務・会計'),
('MGT', '企業経営理論'),
('OPS', '運営管理'),
('LAW', '経営法務'),
('MIS', '経営情報システム'),
('SME', '中小企業経営・中小企業政策');
```

---

## 次のステップ（次サイクルへの引き継ぎ）

- [ ] Supabase ダッシュボードの SQL Editor で上記DDLを実行
- [ ] Supabase Storage に `question-images` バケットを作成（Public 読み取り）
- [ ] Next.js プロジェクトの初期化（`npx create-next-app@latest`）
- [ ] Geminiインポート用 JSON スキーマを上記テーブル構造に合わせて更新（`docs/plan_02_import_schema.md` で設計）
- [ ] Next.js の `/api/import` エンドポイントを実装（UNIQUE制約を利用した UPSERT）

## 検証方法

1. **インポートべき等性**: 同じJSONを2回`/api/import`に送り、`ON CONFLICT DO NOTHING`で0件insertになることを確認
2. **RLS**: Supabase の Table Editor で anon ロールから `user_logs` を照会し、0行返ることを確認
3. **タグ集計クエリ**: `user_logs` に数件回答後、タグ別誤答率クエリが正しく集計されることを確認
4. **画像紐付け**: 管理画面でアップロード後、`question_images.storage_path` に値が保存され、演習画面で画像が表示されることを確認
