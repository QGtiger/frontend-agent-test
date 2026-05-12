type AppConfig = {
  BASE_URL: string;
  SERVER_API: string;
  version: string;
  appName: string;
  resultUrl: string;
};

export function getAppConfig(): AppConfig {
  //@ts-expect-error 类型待补充
  return window.__ROUTER_APP_CONFIG__ as AppConfig;
}
