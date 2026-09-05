import React from "react";

interface JomcodeLogoProps {
  className?: string;
  height?: number | string;
  width?: number | string;
  variant?: "duo" | "light" | "dark" | "monochrome";
}

export const JomcodeLogo: React.FC<JomcodeLogoProps> = ({
  className = "",
  height = 30,
  width = "auto",
  variant = "duo",
}) => {
  // Colors based on the uploaded pixel logo
  const jomColor =
    variant === "light"
      ? "#a3a3a3"
      : variant === "dark"
      ? "#737373"
      : variant === "monochrome"
      ? "currentColor"
      : "#a3a3a3"; // Grey for 'jom'

  const codeColor =
    variant === "light"
      ? "#ffffff"
      : variant === "monochrome"
      ? "currentColor"
      : "#f4f4f5"; // White for 'code'

  const shadeColor = "#383838"; // Dark inner shadow notch

  return (
    <svg
      viewBox="0 0 460 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      style={{ height, width: width === "auto" ? "auto" : width, display: "inline-block" }}
      aria-label="JOMCODE"
    >
      {/* ===================== JOM (SILVER / GRAY) ===================== */}
      {/* 'j' */}
      <g>
        <rect x="35" y="20" width="18" height="68" fill={jomColor} />
        <rect x="15" y="68" width="38" height="20" fill={jomColor} />
        {/* bottom inner shadow */}
        <rect x="35" y="58" width="18" height="10" fill={shadeColor} />
      </g>

      {/* 'o' */}
      <g>
        <rect x="65" y="20" width="54" height="68" fill={jomColor} />
        <rect x="80" y="36" width="24" height="36" fill="#0c0c0e" />
        {/* shadow strip across lower loop */}
        <rect x="80" y="54" width="24" height="18" fill={shadeColor} />
      </g>

      {/* 'm' */}
      <g>
        <rect x="130" y="20" width="68" height="68" fill={jomColor} />
        {/* Left cutout */}
        <rect x="144" y="36" width="12" height="52" fill="#0c0c0e" />
        <rect x="144" y="54" width="12" height="18" fill={shadeColor} />
        {/* Right cutout */}
        <rect x="170" y="36" width="12" height="52" fill="#0c0c0e" />
        <rect x="170" y="54" width="12" height="18" fill={shadeColor} />
      </g>

      {/* ===================== CODE (WHITE) ===================== */}
      {/* 'c' */}
      <g>
        <rect x="210" y="20" width="54" height="68" fill={codeColor} />
        <rect x="226" y="36" width="38" height="36" fill="#0c0c0e" />
        {/* bottom shade */}
        <rect x="226" y="54" width="38" height="18" fill={shadeColor} />
      </g>

      {/* 'o' */}
      <g>
        <rect x="275" y="20" width="54" height="68" fill={codeColor} />
        <rect x="290" y="36" width="24" height="36" fill="#0c0c0e" />
        <rect x="290" y="54" width="24" height="18" fill={shadeColor} />
      </g>

      {/* 'd' */}
      <g>
        <rect x="340" y="20" width="54" height="68" fill={codeColor} />
        <rect x="376" y="0" width="18" height="88" fill={codeColor} />
        <rect x="355" y="36" width="21" height="36" fill="#0c0c0e" />
        <rect x="355" y="54" width="21" height="18" fill={shadeColor} />
      </g>

      {/* 'e' */}
      <g>
        <rect x="405" y="20" width="54" height="68" fill={codeColor} />
        {/* Top inner gap */}
        <rect x="420" y="34" width="24" height="14" fill="#0c0c0e" />
        {/* Bottom inner gap with shade */}
        <rect x="420" y="54" width="39" height="18" fill="#0c0c0e" />
        <rect x="420" y="54" width="39" height="18" fill={shadeColor} />
      </g>
    </svg>
  );
};

export const JomcodeIcon: React.FC<{
  size?: number | string;
  className?: string;
  inverted?: boolean;
}> = ({ size = 32, className = "", inverted = false }) => {
  return (
    <div
      className={`rounded-xl flex items-center justify-center font-bold font-mono tracking-tighter shrink-0 transition-transform ${
        inverted
          ? "bg-white text-zinc-900 border border-zinc-200 shadow-xs"
          : "bg-black text-white border border-zinc-800 shadow-xs"
      } ${className}`}
      style={{ width: size, height: size }}
      title="JOMCODE"
    >
      <JomcodeLogo height={typeof size === "number" ? size * 0.45 : "16px"} />
    </div>
  );
};
