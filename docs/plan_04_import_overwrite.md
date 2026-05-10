# Plan 04: インポート上書きモード（PUT /api/import）

> **サイクル**: Plan Mode 壁打ち #4 → Action（このファイル生成）
> **日付**: 2026-05-10
> **ステータス**: 承認済み・実装済み

---

## Context

`POST /api/import` は既存レコードをスキップする（べき等インポート）。Gemini で問題文・解説を再生成して一括上書きする手段がなかった。

管理画面は1問ずつの手動修正用途であり、数十問をまとめて再生成・上書きする場合はインポート API でまかなうのが自然。

---

## 設計方針

HTTP メソッドで意図を分ける（クエリパラメータで POST の挙動を変えるのは設計として弱い）。

| メソッド | 挙動 | 用途 |
|---------|------|------|
| `POST /api/import` | 既存スキップ（現挙動） | 初回インポート・追加インポート |
| `PUT /api/import` | 既存を UPDATE（新規は INSERT） | Gemini 再生成後の一括上書き |

---

## 実装内容

`src/app/api/import/route.ts` を変更：

- 共通処理を `handleImport(request, overwrite: boolean)` に抽出
- `POST` → `handleImport(request, false)`
- `PUT` → `handleImport(request, true)`
- `overwrite=true` 時: `23505` エラーで UPDATE + `updated++`
- `overwrite=false` 時: `23505` エラーで skipped++（現挙動）
- レスポンスを `{ inserted, updated, skipped, errors }` に拡張
- `question_images` テーブルは触らない（手動アップロード画像を保持）
- `tags` は両モード共通で upsert

---

## 検証方法

1. `POST` で再送 → `{ inserted: 0, updated: 0, skipped: 25, errors: [] }`
2. `PUT` で再送 → `{ inserted: 0, updated: 25, skipped: 0, errors: [] }`
3. `question_images` テーブルが変化していないことを確認
