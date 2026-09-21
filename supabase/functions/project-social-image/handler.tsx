import React from "npm:react@19.2.0";
import { ImageResponse } from "npm:@vercel/og@0.8.6";

export type SocialProject = {
  name: string;
  summary: string;
  creatorName: string;
  imageUrl: string | null;
  amountBacked: number;
  goal: number;
  backers: number;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function socialImageResponse(project: SocialProject | null, headers: HeadersInit = {}) {
  const progress = project?.goal
    ? Math.min(100, Math.max(0, Math.round((project.amountBacked / project.goal) * 100)))
    : 0;
  const headline = project?.name ?? "Back things you want to exist.";
  const description =
    project?.summary ?? "Reward and preorder crowdfunding for independent projects.";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#f4f4f2",
        color: "#111111",
        fontFamily: "Arial, sans-serif",
        padding: "42px",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#ffffff",
          border: "1px solid #dededb",
          borderRadius: "24px",
        }}
      >
        <div
          style={{
            height: "104px",
            display: "flex",
            alignItems: "center",
            padding: "24px 34px",
            borderBottom: "1px solid #e6e6e3",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#5171ff",
              fontSize: "32px",
              fontWeight: 700,
              letterSpacing: "-1px",
            }}
          >
            Backed
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "38px 42px 34px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "#5171ff", fontSize: "20px", fontWeight: 700 }}>
              {project ? "Back this project" : "Backed"}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "14px",
                fontSize: headline.length > 45 ? "46px" : "58px",
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: "-1.8px",
              }}
            >
              {headline}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "17px",
                color: "#5f6368",
                fontSize: description.length > 110 ? "21px" : "25px",
                lineHeight: 1.28,
              }}
            >
              {description}
            </div>
          </div>

          {project ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: "21px", fontWeight: 600 }}>
                {money(project.amountBacked)} backed of {money(project.goal)} goal ·{" "}
                {project.backers} {project.backers === 1 ? "backer" : "backers"}
              </div>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "10px",
                  marginTop: "14px",
                  overflow: "hidden",
                  background: "#e7e7e4",
                  borderRadius: "999px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: `${progress}%`,
                    height: "100%",
                    background: "#5171ff",
                  }}
                />
              </div>
              <div style={{ display: "flex", marginTop: "14px", fontSize: "18px" }}>
                by {project.creatorName}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers,
    },
  );
}
