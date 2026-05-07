-- 1. 科目マスタテーブルの作成
CREATE TABLE subjects (
    code VARCHAR(10) PRIMARY KEY, -- 'ECO'(経済), 'FIN'(財務), 'MIS'(情報) など
    name VARCHAR(50) NOT NULL     -- '経営情報システム' など
);

-- 2. 問題メインテーブルの作成 (jsonb型と配列型を内包した軽量設計)
CREATE TABLE questions (
    id BIGSERIAL PRIMARY KEY,
    subject_code VARCHAR(10) REFERENCES subjects(code) ON DELETE RESTRICT,
    year INT NOT NULL,                 -- 実施年度 (例: 2024)
    question_number INT NOT NULL,      -- 第何問 (例: 1)
    points INT NOT NULL,               -- 配点 (例: 4)
    question_text TEXT NOT NULL,       -- 問題文 (Markdown対応)
    options JSONB NOT NULL,            -- 選択肢の配列 [{"label": "ア", "text": "..."}, ...]
    correct_answer VARCHAR(5) NOT NULL, -- 正解のラベル (例: 'イ')
    explanation TEXT,                  -- 解説文 (Markdown対応)
    has_image BOOLEAN DEFAULT FALSE,   -- 図表画像の有無
    tags TEXT[] DEFAULT '{}',          -- 論点タグの文字配列 (例: {'データベース', '正規化'})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ユーザー正誤履歴・学習ログテーブルの作成
CREATE TABLE user_logs (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,       -- 正誤判定
    confidence_flag VARCHAR(10),       -- 自信度フラグ ('confident':確信あり, 'guess':たぶん・勘)
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 初期データ（科目マスタの全7科目）の挿入
INSERT INTO subjects (code, name) VALUES
('ECO', '経済学・経済政策'),
('FIN', '財務・会計'),
('MGT', '企業経営理論'),
('OPS', '運営管理'),
('LAW', '経営法務'),
('MIS', '経営情報システム'),
('SME', '中小企業経営・中小企業政策');