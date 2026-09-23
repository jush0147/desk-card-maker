# Desk Card Studio

現代化、純前端的 A4 頭對頭桌牌排版 PWA。

- React 19 + TypeScript + Vite
- Zustand 本機狀態
- dnd-kit 拖曳排序
- vite-plugin-pwa / Workbox 自動更新
- A4 雙桌牌：每頁 2 位、上方倒轉、下方正向
- 使用實測模板尺寸：橫線約 74.1 / 142.7 / 211.3 mm
- 實際 DOM glyph box + binary search 自動字級
- 預設字重 600、填滿程度 86%
- 圖片可選，完全在瀏覽器本機處理
- GitHub Actions CI + Pages 部署

## 開發

```bash
npm install
npm run dev
```

## 測試 / Build

```bash
npm test
npm run build
```

## 隱私

沒有後端、沒有分析碼。名單與圖片都只在使用者瀏覽器內處理。

## License

MIT
