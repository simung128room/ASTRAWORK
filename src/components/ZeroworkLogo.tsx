import React from "react";

interface NexaLogoProps {
  className?: string;
  size?: number | string;
  height?: number | string;
  width?: number | string;
}

export const NexaEmblemLogo: React.FC<NexaLogoProps> = ({
  className = "",
  size,
  height = 36,
  width,
}) => {
  const finalHeight = size || height || 36;
  const finalWidth = size || width || "auto";

  return (
    <svg
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none filter drop-shadow-sm transition-transform duration-200 hover:scale-105 ${className}`}
      style={{
        height: finalHeight,
        width: finalWidth === "auto" ? "auto" : finalWidth,
        aspectRatio: "1/1",
      }}
      aria-label="NEXA Original Star Emblem"
    >
      {/* 
        Original 5 Sharp White Shards surrounding central black negative space star
      */}
      {/* Shard 1: Top Shard */}
      <polygon points="428,195 300,405 452,360" fill="#FFFFFF" />

      {/* Shard 2: Top-Right Shard */}
      <polygon points="452,252 670,300 548,338" fill="#FFFFFF" />

      {/* Shard 3: Right Wing Shard */}
      <polygon points="600,322 750,555 598,412" fill="#FFFFFF" />

      {/* Shard 4: Bottom Blade Shard (Pointing down) */}
      <polygon points="572,486 688,512 468,800" fill="#FFFFFF" />

      {/* Shard 5: Left Wing Shard (Pointing far left) */}
      <polygon points="160,398 492,642 452,360" fill="#FFFFFF" />
    </svg>
  );
};

export const StarEmblemLogo = NexaEmblemLogo;

export const NexaLogo: React.FC<{
  className?: string;
  height?: number | string;
  width?: number | string;
  showText?: boolean;
}> = ({
  className = "",
  height = 34,
  width = "auto",
  showText = true,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      style={{ height, width: width === "auto" ? "auto" : width }}
    >
      <NexaEmblemLogo height={height} />
      {showText && (
        <span 
          className="text-white tracking-[0.15em] text-[17px] select-none flex items-center drop-shadow-sm mt-0.5"
          style={{ fontFamily: "'Michroma', sans-serif" }}
        >
          NEXA
        </span>
      )}
    </div>
  );
};

export const ZeroworkLogo = NexaLogo;

