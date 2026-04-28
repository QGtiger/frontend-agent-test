/**
 * 全局 loading 遮罩工具
 *
 * 使用方式：
 *   import { showLoading, hideLoading } from "../../../utils/loading";
 *
 *   showLoading("正在转存飞书图片...");
 *   // ... 异步操作
 *   hideLoading();
 */

let loadingContainer: HTMLDivElement | null = null;

export function showLoading(tip: string = "加载中...") {
  // 如果已存在，先移除
  hideLoading();

  // 创建遮罩层
  const container = document.createElement("div");
  container.id = "__global_loading__";
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  // 创建 Spin 内容
  const spinWrapper = document.createElement("div");
  spinWrapper.style.cssText = `
    background: #fff;
    padding: 32px 48px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  `;

  // 使用 antd 的 Spin 组件样式
  spinWrapper.innerHTML = `
    <div class="ant-spin ant-spin-lg">
      <span class="ant-spin-dot ant-spin-dot-spin">
        <i class="ant-spin-dot-item"></i>
        <i class="ant-spin-dot-item"></i>
        <i class="ant-spin-dot-item"></i>
        <i class="ant-spin-dot-item"></i>
      </span>
    </div>
    <div style="color: #666; font-size: 14px;">${tip}</div>
  `;

  container.appendChild(spinWrapper);
  document.body.appendChild(container);
  loadingContainer = container;
}

export function hideLoading() {
  if (loadingContainer) {
    document.body.removeChild(loadingContainer);
    loadingContainer = null;
  }
}
