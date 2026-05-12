/** @jsxRuntime classic */
/** @jsx jsxCustomEvent */
import { useEffect, useMemo } from "react";
import jsxCustomEvent from "@micro-zoe/micro-app/polyfill/jsx-custom-event";
import microApp from "@micro-zoe/micro-app";
// import { pluginManager } from '../index';

export interface MicroAppProps {
  /** 微应用名称 */
  name: string;
  /** 微应用地址 */
  url: string;
  /** 路由基地址 */
  baseroute?: string;
  /** 路由模式，可选值: native | native-scope | custom */
  routerMode?: "native" | "native-scope" | "custom";
  /** 传递给微应用的数据 */
  data?: Record<string, any>;
  /** 是否使用 iframe 模式 */
  iframe?: boolean;
  /** 是否在卸载时销毁微应用 */
  destroy?: boolean;
  /** 是否禁用沙箱 */
  disableSandbox?: boolean;
  /** 是否禁用样式隔离 */
  disableScopecss?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 其他 micro-app 支持的属性 */
  [key: string]: any;
}

/**
 * 封装的 micro-app 组件
 * 集成了插件系统，支持在渲染前后执行插件逻辑
 */
export default function MicroApp(props: MicroAppProps) {
  const {
    name,
    url,
    baseroute = "",
    routerMode = "native",
    data = {},
    iframe = true,
    destroy = false,
    disableSandbox,
    disableScopecss,
    className,
    style,
    ...restProps
  } = props;

  // 默认数据
  const defaultData = useMemo(
    () => ({
      requestBaseURL: "/",
      ...data,
    }),
    [data],
  );

  // 应用插件修改配置
  const modifiedProps = useMemo(() => {
    const baseProps = {
      name,
      url,
      baseroute,
      data: defaultData,
      router_mode: routerMode,
    };

    // const pluginResult = pluginManager.applyBeforeMicroRender({
    //   ...baseProps,
    //   ...restProps,
    // });

    return baseProps;
  }, [name, url, baseroute, routerMode, defaultData, restProps]);

  // 组件卸载时执行 afterMicroRender 钩子
  //   useEffect(() => {
  //     return () => {
  //       pluginManager.applyAfterMicroRender({});
  //     };
  //   }, []);

  // 构建 micro-app 的属性
  const microAppProps: any = {
    "router-mode": modifiedProps.router_mode || routerMode,
    name: modifiedProps.name || name,
    url: modifiedProps.url || url,
    baseroute: modifiedProps.baseroute || baseroute,
    data: modifiedProps.data || defaultData,
    ...(iframe !== undefined && { iframe }),
    ...(destroy !== undefined && { destroy }),
    ...(disableSandbox !== undefined && { "disable-sandbox": disableSandbox }),
    ...(disableScopecss !== undefined && {
      "disable-scopecss": disableScopecss,
    }),
    ...restProps,
  };

  return (
    <div className={className} style={style} key={modifiedProps.name || name}>
      <micro-app {...microAppProps}></micro-app>
    </div>
  );
}
