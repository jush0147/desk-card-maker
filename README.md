# A4 桌牌排版工具

一個完全在瀏覽器內運作的 A4 桌牌排版工具，不需要伺服器、不會上傳輸入內容或圖片。

## 功能

- 一張 A4 排 2 位來賓
- 每位自動產生「上方倒轉、下方正向」的頭對頭桌牌
- 每個文字區塊自動放大到可容納的最大字級
- 水平、垂直置中
- 支援多行文字
- 可選擇本機圖片，套用到每個桌牌左側
- 圖片只在瀏覽器記憶體中處理，不會上傳
- 可直接列印或另存成 PDF
- 純 HTML / CSS / JavaScript，無框架、無外部依賴
- PWA：可安裝到桌面 / 主畫面，首次載入後可離線使用

## 使用方式

1. 開啟 `index.html`。
2. 每位來賓輸入一個區塊，同一位的多行內容直接換行。
3. 用空白行分隔下一位。
4. 如有需要，選擇一張圖片。
5. 按「列印 / 存成 PDF」。列印時建議比例設為 100%，並關閉瀏覽器頁首頁尾。

## GitHub Pages

1. 建立一個 public repository，例如 `desk-card-maker`。
2. 把 repository 內容放到根目錄，包含 `index.html`、`manifest.webmanifest`、`sw.js`、圖示、`README.md`、`LICENSE` 與 `.nojekyll`。
3. 到 **Settings → Pages**。
4. 在 **Build and deployment** 選擇 **Deploy from a branch**。
5. Branch 選 `main`，Folder 選 `/ (root)`，儲存。
6. GitHub Pages 完成部署後即可直接使用。

## 隱私

此工具沒有後端、分析碼或網路請求。文字與使用者選擇的圖片都只在目前瀏覽器分頁中處理。

## License

MIT

## PWA

GitHub Pages 使用 HTTPS，符合 Service Worker 的要求。網站首次成功載入後會快取 App Shell，因此之後可離線開啟。支援安裝提示的瀏覽器會顯示「安裝成 App」按鈕；iOS / iPadOS 可從 Safari 的分享選單加入主畫面。使用者輸入的文字與選擇的圖片不會上傳，也不會被 Service Worker 持久化。
