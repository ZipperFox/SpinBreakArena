# SPIN//BREAK ARENA V2｜手機一鍵邀請的多人戰鬥陀螺

**12 款陀螺、5 個競技場、2～4 人即時對戰（也可單人對 AI）**。本版主要升級手機開房、分享邀請、斷線重連，以及「不必設定路由器」的跨網路連線方式。

> **重要：此 ZIP 是遊戲程式，不是已上線的公開網站。** 要從不同網路玩，仍須啟動下列「臨時公開網址」或部署到雲端伺服器。任何玩家只要有有效的遊戲 HTTPS 網址，就可以用 iPhone／Android／電腦瀏覽器遊玩，不用安裝 App。

## A. 最快跨網路玩法｜Windows 主機開啟臨時公開網址

適合：你有一台 Windows 電腦能開著，但自己想拿 iPhone 玩，也想邀請不在同一 Wi-Fi 的朋友。**不需要申請 Cloudflare 帳號，不需要路由器轉發或固定 IP。**

1. 解壓縮整個遊戲資料夾；電腦需要 **Node.js 22 以上**（你原有的 Node.js 24 可以使用）。
2. 在 Windows 電腦上，雙擊 **`start_public_windows.bat`**。
3. 第一次啟動會詢問是否從 Cloudflare 官方 GitHub 下載 `cloudflared`。確認後會儲存於專案的 `tools/` 子資料夾，之後不必重複下載。程式來源：`https://github.com/cloudflare/cloudflared/releases`。
4. 啟動器會在畫面顯示 HTTPS 臨時網址（例如 `https://random-word.trycloudflare.com`），並嘗試**自動開啟瀏覽器與複製網址**。
5. 把這個網址傳給自己的 iPhone；手機用 Safari 開啟 → 輸入暱稱 → **一鍵建立房間** → **分享邀請** → 傳送給朋友。
6. 朋友按邀請連結，畫面會直接顯示 **「加入這場對戰」**，點一下加入。房主選場地、AI 人數並按 **LET IT RIP!** 開戰。

**注意：** 必須讓 Windows 的遊戲程序與公開連線視窗保持開啟。若關閉視窗／電腦睡眠／斷線，臨時網址就會失效；再次啟動網址也會改變。此功能使用 Cloudflare **Quick Tunnel（開發／測試用途）**，不保證可用率，不適合正式長期營運。建議僅和信任的玩家分享臨時網址；得到網址的人都能存取此公開遊戲服務。若首次下載失敗，請參閱 [Cloudflare 官方 cloudflared 下載頁](https://developers.cloudflare.com/tunnel/downloads/)，手動放入 `tools/cloudflared.exe` 再執行。

## B. 長期固定網址｜Render 部署（不必讓電腦一直開機）

專案根目錄已包含 `render.yaml`，用於部署 Render Web Service，支援 HTTPS + WebSocket（WSS）。

1. 將**本 ZIP 解壓縮後的專案檔案**（`server.js`、`package.json`、`public/`、`render.yaml` 等）推送到一個 GitHub repository 根目錄（公開／私人皆可，依 Render 與 GitHub 授權範圍設定）。
2. 前往 [Render Dashboard](https://dashboard.render.com/) → **New → Blueprint**，連接該 GitHub repository；選擇同意建立 Blueprint 內的 `spin-break-arena` Web Service。也可以直接 **New → Web Service**，選 repository、Node runtime、`npm install --omit=dev`、`node server.js`、計算方案 Free。
3. Render 成功部署後，取得由 Render 配發的 `https://...onrender.com` 網址。**這是實際公開網址**，由 Render 平台提供（本下載包本身不會先附帶一個已部署網址）。
4. iPhone／Android／電腦開該網址玩；開房後直接按 **分享邀請**，連結會帶房間碼，朋友點開就可以加入。

**免費版限制（以 2026-10-28 官方文件為準）：** Render Free Web Service 無訪問約 15 分鐘後會休眠，重新啟動可能約需一分鐘。伺服器若休眠、重新部署或重啟，**所有記憶體中的房間會消失**，請重開房間。請勿誤以為這是穩定的 24 小時遊戲伺服器。正式營運需要按用量選擇付費方案、保存房間／帳號資料並增強防護。

參考來源：[Render WebSocket 官方文件](https://render.com/docs/websocket)、[Render 免費方案](https://render.com/docs/free)、[Render Blueprint](https://render.com/docs/infrastructure-as-code)。

## C. 單機／區域網路

- Windows：雙擊 `start_windows.bat`，電腦開啟 `http://localhost:3000`。
- macOS/Linux：`./start_mac_linux.sh`。
- 同 Wi-Fi 的手機：可開 `http://電腦區域網路IP:3000`，需注意防火牆。**但如果用這個網址分享給不同網路的朋友，他們會無法進入**。要跨網路請使用上面的 A 或 B。
- macOS/Linux 的臨時公開網址：安裝 `cloudflared` 後可執行 `./start_public_mac_linux.sh`，從終端輸出複製 `https://...trycloudflare.com`。

## 手機操作與新增功能

| 功能 | V2 的操作與限制 |
|---|---|
| 建立房間 | 網頁輸入暱稱 → 一鍵建立；預設一名 AI |
| 分享邀請 | iPhone 點 **分享邀請**，可叫出原生分享面板（LINE、訊息等取決於手機）。另有 **複製連結** |
| 加入房間 | 朋友點開網址 `https://遊戲網站/?room=ABCDE` → 「加入這場對戰」；仍可手動輸入五位代碼 |
| 短暫斷線重連 | 網路短暫中斷時自動重連；同一分頁重新連上，保留原玩家編號／陀螺／房間，**最多約 90 秒**。頁面不能被清除儲存空間，伺服器也不能重啟 |
| 網路品質 | 伺服器權威運算 30 TPS，快照 20 Hz。網路延遲會影響即時操作；並未保證跨國低延遲 |
| iPhone 主畫面 | Safari 的分享選單 → **加入主畫面**，可建立捷徑。這只是網頁捷徑，**沒有離線伺服器能力** |
| 操作 | 左下虛擬搖桿；右下爆裂／防禦；電腦 WASD、J、Space |
| 安全限制 | 單次輸入 8 KB、每連線上限 80 訊息／秒、房間上限 80、連線上限 180；這是原型級防護，並非正式營運反作弊 |

## 遊戲內容

- **12 款原創陀螺：** 緋焰鳳凰、雷霆迅鷹、血月螳螂、鋼鐵巨獸、永凍冰壁、黑曜巨神、疾風山貓、幻影九尾、蒼嵐眼鏡蛇、深淵海龍、日輪聖龍、星辰獨角獸。
- **四種定位：** 攻擊、防禦、速度、平衡。各具獨立技能，四維能力總點數均為 20。
- **五個場地：** 王者競技場、深淵漩渦、雷暴聖域、熔岩裂谷、終焉日蝕。
- **勝負：** HP、轉速、碰撞與場地出界決勝；單局約 95 秒。支援 2～4 個參戰單位、真人與 AI 混合。
- **平衡：** V1 先前抽樣 2,700 局 AI 四方混戰，觀察勝率約 19.5%～31.4%；**V2 沒有重新宣稱完成人類玩家平衡測試**。

## 驗證紀錄（V2）

- `node test_multiplayer.js`：實際 WebSocket 4 人房間同步、技能與 AI 練習通過。
- `node test_remote_v2.js`：HTTP 健康檢查／PWA 靜態資源、二次加入、斷線後重連、戰鬥中恢復、代碼／token 驗證、心跳與轉移房主測試通過。
- `node --check server.js`、`node --check public/client.js`：語法檢查通過。
- **未在本環境完成：** 真正 Cloudflare 臨時網址部署、Render 帳號內的雲端部署、iPhone Safari 實機連線、Windows PowerShell 端到端實跑。這些需要用戶端真實機器／外部雲端服務環境。不要把程式已寫好誤認為這些外部操作已成功。

## 安全與已知限制

這是**分享給朋友的小型遊戲原型**，非具有登入、帳號驗證、防 DDoS、跨機器分散式狀態、全球配對、成績持久保存或全面防作弊的正式線上服務。房間碼不是安全密碼，不要用它傳送私人資料；不要使用不明分享連結。在公網部署前，請自行確認各平台現行使用條款及費用。

## D. 公開上線後一鍵驗證（新增）

此版本加入 `Dockerfile`、`.dockerignore`，方便需要容器映像的雲端平台使用；一般 Render Node Web Service 直接使用 `render.yaml` 即可，不必 Docker。

正式部署獲得公開網址後，執行下列命令進行**真正的公網連線**驗證（這項驗證不會在本機測試時自動執行）：

```bash
node verify_live.js https://你的遊戲網址.onrender.com
```

此腳本會實際透過 HTTPS + WSS 建立兩名 WebSocket 玩家，測試開房、加入、戰鬥同步與技能，最後自動離開。若測試過程遇到免費主機冷啟動，請等待健康檢查完成並視需要重試。切勿把本機測試通過誤認為雲端已上線。

**發布權限：** 正式部署需要可連接的託管服務帳戶，並由帳戶所有者授權。GitHub 上目前沒有本專案的獨立倉庫，請勿為了省步驟將遊戲程式擅自發布到其他不相關的既有私有專案中。
