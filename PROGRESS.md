# PROGRESS
- 14:30 着手。skill(bakage/ship)・index-games のルール・anti-ai-tells・promo recipe を読了
- 14:35 素材(音25・Kenney glb)・vendor・テンプレ配置済み。既存作: Midnight Mascots(cinevva・ホラー、追ってくるのが着ぐるみ側)/Closed Room 2・Balloon Head(itch・頭が外れるが着ぐるみ無し)。違い=自分が着ぐるみで頭の傾きを直しながら逃げる。題名はGoogle候補『着ぐるみ 中の人』『ゆるキャラ』『着ぐるみ 逃げる』
- 14:44 game.js 1000行・title/run/reveal の画面確認済み(shots/)。次: bot で難度調整→verify→og→公開
- 14:50 verify 46/49(拡大止めCSS・og追加で解消予定)。bot: human中央値120m・idle5秒・expert1500m。og.png作成。次: ai_tells・iOSシミュ・公開
- 14:52 iOSシミュ(iPhone17Pro Safari)でタイトル→走行→正体バレ→結果を通し確認。verify 49/49。次: 公開
- 14:53 公開済 https://tom3games.github.io/kigurumi-run/?v=1 live.mjs OK
- 15:11 v2 着手。本人感想: 足が短い・ジャンプ・スライディング・質。方針: 中の人=Quaternius Modular(7頭身,pruneしたglb)+大きな頭、タップでジャンプ、障害物(コーン/箱/ベンチ/看板)、スライダーファン、慣れる区間
- 15:26 v2 実装: 中の人=Quaternius Modular(カプセルで着ぐるみ体)、タップジャンプ、障害物4種、スライダー、地面/小物/影。bot調整中(human 396m/41s)
- v2 完了前: verify 54/54、sim(human 474m/48s, slow 442m/46s, idle 9s)。公開へ
