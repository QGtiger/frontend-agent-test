import MicroApp from "./MicroApp";

export default function AiAssistant() {
  const url = `https://test-college.yingdao.com/ai-assistant/float-assistant`;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        top: 0,
        left: 0,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <MicroApp name="ai-assistant" url={url} iframe router-mode="pure" />
    </div>
  );
}
