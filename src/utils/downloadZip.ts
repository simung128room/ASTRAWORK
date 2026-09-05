/**
 * Robust ZIP Downloader with Blob fallback for Sandboxed iframes
 */
export async function downloadProjectZip(): Promise<boolean> {
  try {
    const res = await fetch("/api/download-zip", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP error " + res.status);

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "jomcode-source.zip";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);
    return true;
  } catch (err) {
    console.warn("Direct blob download failed, falling back to location.href:", err);
    window.location.href = "/api/download-zip";
    return false;
  }
}
