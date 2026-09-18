# Novel Editor Persistent Rules & Guidelines

## プレビュー消滅・バグ防止ルール（HTML/バニラJS・原稿用紙エディタ用）

1. **エディタの高さを最低限確保**:
   - テキスト入力エリア（contenteditable）や親要素（`#w`など）に文字が入っていない初期状態でも背景のマス目が潰れて消えないよう、必ず `min-height: 400px;` などの最小の高さをCSSで確保してください。

2. **文字とグリッド線の同期**:
   - マス目（`linear-gradient` による背景）の縦横サイズ（`background-size`）は、CSS変数（`--cs`）などを通じてフォントサイズ（`font-size`）や行の高さ（`line-height`）と必ず連動するように計算・設定し、プレビューの画面サイズが変わってもマス目と文字が絶対にズレないようにしてください。

3. **プレビュー・印刷時の背景保持**:
   - プレビュー表示や画面切り替えの際に、背景のマス目がブラウザの仕様で省略されないよう、CSSに `-webkit-print-color-adjust: exact;` および `print-color-adjust: exact;` を必ず明記してください。
