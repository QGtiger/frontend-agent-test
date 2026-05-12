import { Outlet } from "react-router-dom";
import microApp from "@micro-zoe/micro-app";
import FloatAgent from "./components/FloatAgent";

microApp.start();

export default function Layout() {
  return (
    <div className="min-h-screen">
      <Outlet />
      <FloatAgent />
    </div>
  );
}
