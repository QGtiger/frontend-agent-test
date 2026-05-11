import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { initRoutes } from "./utils/pagerouter/index.tsx";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Button, message, Result } from "antd";
import { useMount } from "ahooks";
import { lightfishApiClient } from "@lightfish/server/api";

import "./main.css";

lightfishApiClient.interceptors.response.use((res: any) => {
  if (res.data.code !== 200) {
    message.error(res.data.message || "接口请求失败");
    throw new Error(res.data.message || "接口请求失败");
  }
  return res;
});

const routes = initRoutes();
console.log(routes);
const router = createBrowserRouter(routes);

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  useMount(() => {
    console.error(error);
    // 上传错误
  });

  return (
    <Result
      status="500"
      title="500"
      subTitle="抱歉，系统出现了一些问题，请稍后再试。"
      className="mt-20"
      extra={
        <div className="flex gap-4 justify-center">
          <Button type="primary" onClick={resetErrorBoundary}>
            刷新
          </Button>
          <Button
            type="primary"
            onClick={() => {
              location.href = "/";
            }}
          >
            返回首页
          </Button>
        </div>
      }
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <RouterProvider router={router} />
  </ErrorBoundary>,
);
