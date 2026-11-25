# AI Reference Scout — FORGE ZERO 初次研究紀錄

日期：2026-11-25。研究方法源自 ZipperFox/AI-Scene-Architect 的 `feat/ai-reference-scout`（SKILL.md、references/reference-scout.md），將原創主張與實際渲染驗收分離；本案並未執行其 Blender 專用編譯器。沒有宣稱完成美術驗收。

原創主張（creative_judgment）：暗色加工工業機械，分段鋼製競技盤、鋁合金切削刀刃、暗色橡膠和點狀琥珀光；以陀螺為焦點，減少外圈護欄對戰鬥的遮蔽。採用低角度、俯視與特寫以互相驗證。否決滿場霓虹及只用粗糙幾何堆疊。材質與攝影仍須看圖檢查：金屬是否過暗、形狀是否過小、泛光是否失控、外場結構是否空洞。

| 來源 | 實際檢查 / 採用 | 權利 |
|---|---|---|
| https://github.com/Leonxlnx/room-at-dawn | GitHub README 與 LICENSE 原文已讀：程序式材質、per-vertex baked GI、box-projected reflection、固定鏡頭與 HDR pipeline。採用程序式細紋與環境反射的概念；不把離線烘焙流程直接搬到動態模型。未取得該作品原始渲染圖片。 | MIT（程式碼），本樣板未拷貝外部原始碼或圖資 |
| https://github.com/Leonxlnx/walking-block | GitHub README 與 LICENSE 原文已讀：模組化、weathering、headless Chrome 截圖與 storyboard，約 540 萬三角形/幀的離線電影場景。借鑑驗收流程，不直接複製高負載。未取得原始渲染圖片。 | MIT（程式碼），第三方音樂 CC BY 4.0、音效 CC0；未引入 |
| https://threejs.org/docs/pages/UnrealBloomPass | 官方文件搜尋結果確認 addons 匯入及 composer 使用；限制泛光與畫質等級。 | Three.js r180 MIT，透過 npm 安裝 |
| https://raw.githubusercontent.com/mrdoob/three.js/r180/build/three.module.min.js | 官方 r180 源檔授權標頭與模組依賴可讀，下載實際失敗。 | MIT |
| Yoru Lab | 以 Yoru Lab Three.js、"Yoru Lab" "three.js" 搜尋，未可靠定位原始作品，未臆造內容。 | 未知，沒有引入素材 |

本案未使用外部模型/貼圖，並非禁止外部合法素材。後續研究可選用經查證授權的 HDRI、貼圖與 GLB。實際渲染未完成前，不比較美感分數，不使用模型效果示意圖冒充遊戲。

## 補充原始圖像檢視（GitHub Contents API）

- Room at Dawn: `docs/media/hero.jpg`，Git blob `025ac35bb2ac66a91c79c7b5fe07c6bb7298765b`，實際開圖。窗戶是唯一大面積亮點，葉片、窗簾與家具亮度克制；暗部仍具材質區別。採用焦點對比與暗面材質可讀性。
- Walking Block: `docs/hero.jpg`，Git blob `cd882be0d984234c41a7713d0baa0f8360767d44`，實際開圖。巨大機構與霧中地平線建立尺度；暖窗光對比冷藍霧，裝甲具有結構接縫、磨耗、管線與關節層次。採用結構性細節與受控冷暖光。
- 圖像只作參考，不納入素材；新樣板尚未渲染，未進行新舊對比。
