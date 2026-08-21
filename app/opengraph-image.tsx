import { ImageResponse } from "next/og";

export const alt = "PLUMARELI — acompanhamento escolar online com clareza e acompanhamento humano";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f7f8ff",
          color: "#17284e",
          padding: "72px 82px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ position: "absolute", width: 360, height: 360, borderRadius: 999, background: "#dff3ac", top: -155, right: -85 }} />
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: 999, background: "#ffd9e8", bottom: -170, left: 250 }} />
        <div style={{ position: "absolute", width: 220, height: 220, borderRadius: 999, background: "#dce5ff", bottom: -70, right: 160 }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 54, height: 54, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#315efb", color: "white", fontSize: 29, fontWeight: 800 }}>P</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 29, fontWeight: 900, letterSpacing: 1 }}>PLUMARELI</div>
              <div style={{ fontSize: 17, color: "#66728b" }}>Acompanhamento escolar online</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 900, gap: 22 }}>
            <div style={{ fontSize: 68, lineHeight: 1.02, letterSpacing: -2.5, fontWeight: 900 }}>
              Organize o que estudar agora e avance com mais clareza.
            </div>
            <div style={{ fontSize: 27, lineHeight: 1.35, color: "#56627a", maxWidth: 870 }}>
              Missões, atividades no caderno, encontros e acompanhamento humano do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio.
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, fontSize: 18, fontWeight: 700 }}>
            <div style={{ padding: "12px 18px", borderRadius: 999, background: "#e7edff", color: "#2649bd" }}>Tecnologia ajuda.</div>
            <div style={{ padding: "12px 18px", borderRadius: 999, background: "#ffe5ef", color: "#b92b6e" }}>Seu cérebro resolve.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
