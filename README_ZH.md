# SPIN//BREAK ARENA V9 — IMPACT 2.0 / LAUNCH SYSTEM / CUSTOM GARAGE

這是整合 V7、V8、V9 的手機／桌面多人戰鬥陀螺版本，採伺服器權威 Rapier 3D 剛體物理與 Three.js 3D 視覺呈現。**這是物理誇張化遊戲，不是實體陀螺的工程級模擬。**

公開站點：https://spin-break-arena.onrender.com

## V7 — IMPACT 2.0
- 12 款刀刃有不一樣的實體 **3D 複合碰撞器**：中央圓柱 + 2–10 個不同半徑、不同伸出長度的撞擊球體，造成不同外緣接觸輪廓與真實慣性分布。
- 棘輪有 2–9 個物理齒輪碰撞器，軸心依零件使用不同的碰撞球半徑與抓地參數；Rapier 自動從幾何與密度計算質量與慣性。
- 碰撞後反作用衝量、接觸角度造成的傾斜扭矩；重擊在 3D 畫面觸發擴散衝擊波、火花、鏡頭震動。後端決定飛行、轉速與淘汰，不以 HP 作為勝負判定。

## V8 — LAUNCH SYSTEM
- 發射力度 55%～100%、初始角度 -40°～+40°、發射路線（偏左／中央／偏右）。
- 這些選項會在戰鬥建立剛體時，實際改變初始位置、速度方向、速度大小和轉速；遊戲進行中鎖定不能修改。
- 依然取消自由移動：陀螺自動運動，玩家控制衝鋒與專屬必殺技。

## V9 — CUSTOM GARAGE
- 12 種刀刃 × 6 種棘輪 × 8 種軸心 = 576 種組合。
- 3D 零件爆炸預覽採用與實體碰撞器一致的外型參數（異形刀刃外緣、齒輪數量、軸心半徑），不只靠貼圖顯示差異。
- 主色自訂（6 位 HEX），伺服器驗證並在多人畫面同步；三組配裝預設、發射設定在單一裝置的 localStorage 儲存。
- 沒有付費數值優勢。配裝預設僅存在該裝置，換手機或清除 Safari 網站資料會失去預設。

## 如何執行
- Node.js 22+。
- `npm install`：安裝 Rapier 3D 與 Three.js，並於安裝後自動檢查 3D 物理、V9 新功能、四人 WebSocket 連線整合測試。 
- `npm start`：開啟 http://localhost:3000 。正式託管使用 PORT 環境變數及 HTTPS/WSS 反向代理。
- 其他檢查：`npm run test:3d`、`npm run test:v9`、`npm test`。

## 測試與限制
- `test_v9.js` 測試真實不同碰撞器、零件質量、發射速度與方向、配裝色彩及快照；`test_multiplayer.js` 檢查四人同房、改裝同步、發射設定同步、場地與技能。
- 3D 碰撞使用簡化複合碰撞器，不是精密的實體玩具材質、軸承或幾何重建；撞擊效果經過誇張化調整。
- 平衡沒有對 576 組配裝完成全組合、真人操作的大樣本驗證。手機 Safari 的 GPU 和多個 WebGL 畫面需要實機驗收。
- Render Free 可能在閒置後休眠；伺服器重啟會清空記憶體房間。

參考：Rapier [Mass properties](https://rapier.rs/docs/user_guides/javascript/collider_mass_properties/)、[Forces and impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)、[Rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)、[Three.js](https://threejs.org/docs/)。

## V9.1 護欄防自爆修正

- 競技場一般護欄由低球型改為高 2m、重疊式直立圓柱，避免高速碰撞時沿球面被彈飛越過。
- 只在真實護欄碰撞接觸事件後抑制失控向外／垂直速度，其他陀螺之間的撞飛與技能保留。
- 側邊回場軌道增加高外壁與由速度決定的回場加速度；南北指定出界口仍可 KO。
- `npm run test:guardrails`：五個場地的普通護欄、正式出界口及回場通道回歸測試。

## V9.2 北南出界口修正

- 出界口由原本約 34° 的全寬改為約 21.2°（開口角度）；真實 Rapier 護欄與 Three.js 視覺共用相同的缺口界線。
- 取消剛過 `5.9m` 半徑就判 KO 的舊式近場檢查，改為真正穿過洞口約 `6.38m` 後才進入確認程序。
- 只有最近 `1.6 秒` 被其他陀螺以相對速度至少 `3.5m/s` 實際撞擊，且出界速度達 `3.1m/s`，才能從北南缺口被 KO。
- 普通自走、衝鋒落空、擦邊小碰撞：缺口邊緣提供向內導引與回場反彈（保留物理座標與旋轉角速度，不傳送）。
- 保留側邊高速軌道與普通護欄的既有行為。直接跌落到場地外仍依安全邊界處理。
- 新增 `npm run test:exits`，在 Render 建置期間驗證五座場地的意外出界／正式重擊出界／逾時撞擊／輕撞回場。

注意：這屬於偏向好玩的 Arcade 競技設計，而非真實陀螺比賽的原始出界規則。
