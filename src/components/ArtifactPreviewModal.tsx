import React, { useState } from "react";
import { X, ExternalLink, RefreshCw, Code, Monitor, Smartphone } from "lucide-react";

interface ArtifactPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  title?: string;
  language?: string;
}

export const ArtifactPreviewModal: React.FC<ArtifactPreviewModalProps> = ({
  isOpen,
  onClose,
  code,
  title = "Interactive Artifact Preview",
  language = "html",
}) => {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);

  if (!isOpen) return null;

  // Build standalone preview document containing Tailwind CDN & script execution support
  const srcDoc = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Prompt:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', 'Prompt', sans-serif;
      background-color: #09090b;
      color: #f4f4f5;
      margin: 0;
      padding: 1rem;
    }
  </style>
</head>
<body>
  ${code.includes("<html") || code.includes("<!DOCTYPE") ? code : `<div id="root">${code}</div>`}
</body>
</html>
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Code className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 font-sans">{title}</h3>
              <p className="text-xs text-zinc-400 font-mono">Render Mode: {language.toUpperCase()}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Device Toggle */}
            <div className="flex items-center p-1 bg-zinc-950 rounded-lg border border-zinc-800">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`p-1.5 rounded-md transition-colors ${
                  deviceMode === "desktop" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeviceMode("mobile")}
                className={`p-1.5 rounded-md transition-colors ${
                  deviceMode === "mobile" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sandbox Content Container */}
        <div className="flex-1 bg-zinc-900/50 p-4 flex items-center justify-center overflow-auto">
          <div
            className={`h-full transition-all duration-300 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-inner ${
              deviceMode === "mobile" ? "w-[380px] my-auto h-[680px]" : "w-full"
            }`}
          >
            <iframe
              key={refreshKey}
              srcDoc={srcDoc}
              title="Artifact Live Render"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-modals allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
