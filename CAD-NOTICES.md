# CAD取り込みについて

DXF（ASCII）・DWG・JWWの住宅平面図から、直線を壁にした概略3Dを作成します。PDF・JPG・PNG・WebPも引き続き使用できます。

- ファイルは25MB以下。1フロアずつ、壁を含むレイヤーを選びます。3D化する壁は400本以下です。
- LINE、直線部分のLWPOLYLINE/POLYLINE、ブロック内の直線に対応します。斜めの壁も表示・歩行できます。
- 曲線、文字、寸法、ハッチング、外部参照、専用オブジェクト、3Dソリッドは住宅の壁として再現しません。すべてのCAD版・図形を保証するものではありません。
- DXFの単位情報を候補として使用します。単位なしの図面は横幅10mが仮設定です。2点間の既知の長さで補正してください。
- JWWの座標は紙上mmです。初期の縮尺1/100を原図の縮尺に変更してください。縮尺の異なるレイヤーグループを同時に取り込まないでください。
- 壁高・壁厚・ドア・窓は確認と編集が必要です。床・屋根は矩形の仮形状で、部屋名や階数を自動推定しません。施工・寸法確認用のCADではありません。
- 原本はブラウザー内のWorkerで処理します。変換サーバーへの送信はありません。初回は下記の読取ライブラリをjsDelivrからダウンロードします。閉じるとCADの読取を中止できます。60秒でタイムアウトします。
- バイナリDXFや読み取れないDWG/JWWは、CADソフトでASCII DXFまたはPDFに書き出して読み込んでください。

## 読み取りライブラリ

- [dxf-parser 1.1.2](https://github.com/gdsestimating/dxf-parser) — MIT。変更せずCDNから読み込みます。[ライセンス](https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/LICENSE)
- [dwgdxf 2.0.1](https://github.com/ducflair/dwgdxf) — MIT、acadrustを用いたWebAssembly変換。変更せずCDNから読み込みます。[ライセンス・ソース](https://github.com/ducflair/dwgdxf/tree/v2.0.1)
- [ezjww 0.7.11](https://github.com/monozukuri-ai/ezjww) — MIT。WebAssembly本体は変更せずCDNから読み込みます。Node用のWASM初期化処理を端末内で非同期ブラウザー用に置き換えます。[ライセンス](https://github.com/monozukuri-ai/ezjww/blob/main/LICENSE)
- 変換の検証には[ACadSharp公開サンプル](https://github.com/DomCR/ACadSharp/tree/master/samples)を利用します。ユーザーの図面を公開テストには使用しません。
