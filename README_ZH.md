# SPIN//BREAK ARENA V6 — TRUE 3D PHYSICS

本版用 **Rapier 3D WebAssembly** 取代舊版平面碰撞，用 **Three.js WebGL** 畫出 3D 陀螺與立體競技場。運動、撞擊、傾斜、翻倒與角速度由伺服器上的 3D 剛體負責；手機僅呈現同步快照。

## 玩法

- 取消 WASD / 虛擬搖桿。陀螺自主巡航，玩家選擇敵人、按「衝鋒」或「必殺」影響剛體動量。
- 上方刀刃、棘輪、軸心三段可改造：12 × 6 × 8，共 576 種配裝。零件影響質量、抓地力、轉速耗損、攻擊衝量、穩定性。
- 場地有真實的 3D 防護球牆、固定撞擊柱、南北出界口、左右可進入的軌道輔助回場段。
- 接觸力事件來自 Rapier 的真實碰撞；在此基礎上加上刻意放大的分離衝量與短暫拋飛，追求爽快的 **arcade physics（誇張化物理）**，不主張工業級真實陀螺動力學精度。
- 以高速撞出場外、旋轉速度耗盡、翻倒判定 KO；不設血量。
- 2–4 人 WebSocket 房間，後端判定勝負，預設 AI 練習，支援斷線恢復。

## 執行

安裝 Node.js 22+，執行 `npm install`（包含 WebAssembly 物理套件，會測試 3D 核心），再執行 `npm start`，進入 `http://localhost:3000`。

公開網址： https://spin-break-arena.onrender.com

Render 使用 `npm install --omit=dev`，安裝過程將 Three.js 模組複製到 `public/vendor/`，**遊玩時不需要額外第三方 CDN**。Node 伺服器預設 `PORT` 環境變數。

## 驗證

`npm run test:3d`：檢查 3D 碰撞核心初始化、四個陀螺動力學、衝鋒冷卻、3D 座標與姿態。`npm test`：多人 WebSocket 回歸（若測試支援）。

## 已知限制

1. 真正的 3D 剛體物理，但各零件使用簡化的圓柱、球體組合碰撞器，未採真實玩具零件的精確質量分佈、空氣動力、精密接觸面與完整陀螺力學。
2. 軌道「導回」屬原創遊戲化輔助力，非純被動物理軌道。
3. 大量高速撞擊效果為人為放大，不是現實的彈性碰撞守恆模型。
4. 不同手機硬體的 FPS、Safari WebGL 支援、所有配裝平衡與玩家手感仍需要實機驗收。
5. 免費 Render 可能閒置休眠或限制可同時進行的物理房間。

參考文件：Rapier https://rapier.rs/docs/user_guides/javascript/rigid_bodies/ ，Three.js https://threejs.org/manual/pages/installation.html
