# FORGE ZERO — Visual Lab 0.1 (candidate)

獨立的 Three.js r180 視覺實驗，與正式 SPIN//BREAK ARENA V10.7 的伺服器、Rapier 物理、多人連線和部署完全隔離。四陀螺的展示模擬不是正式遊戲物理。

## 啟動（Windows）
解壓後執行 `START_WINDOWS.cmd`（首次需要網路下載 Three.js；Node.js 22+）。或在資料夾執行 `npm install --omit=dev`、`npm start`，瀏覽 http://127.0.0.1:5177。沒有外部 CDN 或線上模型依賴。選陀螺、衝鋒 Q、重擊 W、黑洞 E、暫停 Space、重置，另有四種鏡頭。低畫質關閉後製及即時陰影，保留接觸陰影。

## 開發與驗證
- `npm run check`：語法。
- `node scripts/test-battle.mjs`：四陀螺簡化模擬。
- `npm install`、`npx playwright install chromium`、`npm run capture`：真正的桌面及手機尺寸 Chromium 渲染、四陀螺特寫、事件截圖；只建立技術結果，仍需要人或具視覺能力的代理開圖驗收。
- `captures/` 保存實際執行紀錄；若為阻擋截圖，絕非遊戲渲染成果。

## 狀態
初次候選實作，尚未取得有效 Three.js 渲染。環境 DNS 無法下載 npm 套件，Chromium 訪問 localhost 回報 ERR_BLOCKED_BY_ADMINISTRATOR。因此尚未證明任何美術品質或手機 FPS。原版本未修改。尚未加入音效或正式多人系統，亦未把低護欄示範當成正式碰撞形狀。研究紀錄見 `RESEARCH.md`。

GitHub Actions 第一次驗證 run 45616917505：npm 安裝及語法/模擬通過，Playwright 1.56.1 不支援 ubuntu-latest 實際使用的 Ubuntu 26.04；已將實驗 workflow 固定至 Ubuntu 24.04。未把 CI 安裝成功視為畫面驗收。

## 0.4 battle prototype
Training remains available; select a top and ratchet/bit then Start for a local four-actor match. Q charge, W skill, R guard; click opponents to target. E black hole in training. Original procedural soundtrack **Foundry Circuit** (16 bars, 132 BPM) and generated sample buffers, enable audio with a click. Not recorded audio or a separate generative music model. Match finish, spin-out/ring-out/burst, cooldowns and snapshot replay. No multiplayer migration. Browser screenshot review required.

Additional polish: physically marked ring-out gates, distinct visual ratchet/bit scaling, visual wind and gravity effects, three-part burst debris, interpolated half-speed playback with recorded event effects. These are local gameplay prototypes, not a physics engine migration.

## 0.5 — contact sound overhaul
Six CC0 Kenney metal impact samples; differentiated wall and pair contacts, velocity-based tiers, voice limits and music ducking. Original Foundry Circuit remains. Preview cycles light/medium/heavy. Restrained reflections, rear mechanical panels. See src/sfx/CREDITS.md. No production multiplayer change.

## 0.6 — combat visuals and three arenas
Independent Forge / Void / Storm architectures use identical battle boundaries. Reusable shader shockwaves, contact flash sprites, instanced debris, charge aura, guard shield and enhanced accretion disk. Rotor tooling details and exposure streaks. Browser captures cover additional stages and guard. Existing 0.5 audio and local simulation are retained; no multiplayer or mobile hardware performance claim.
