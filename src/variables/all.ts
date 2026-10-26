import type { ReplaceVariable } from "@crowbartools/firebot-types";
import { getRememberedRolesJson, getRememberedSnapshot, snapshotField } from "../api";

function textVar(handle: string, description: string, path: string): ReplaceVariable {
  return {
    definition: {
      handle,
      description,
      categories: ["common"],
      possibleDataOutput: ["text"],
    },
    evaluator: () => {
      const v = snapshotField(path);
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    },
  };
}

function numVar(handle: string, description: string, path: string): ReplaceVariable {
  return {
    definition: {
      handle,
      description,
      categories: ["common"],
      possibleDataOutput: ["number", "text"],
    },
    evaluator: () => {
      const v = snapshotField(path);
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    },
  };
}

export function buildAllVariables(): ReplaceVariable[] {
  return [
    textVar("vulkanchikCurrentTitle", "Current track title", "current.title"),
    textVar("vulkanchikCurrentArtist", "Current track artist", "current.artist"),
    textVar("vulkanchikCurrentId", "Current queue item id", "current.id"),
    textVar("vulkanchikCurrentVideoId", "Current YouTube video id", "current.videoId"),
    textVar("vulkanchikCurrentRequester", "Current requester name", "current.requesterName"),
    textVar("vulkanchikPlaybackState", "Playback state", "playback.state"),
    numVar("vulkanchikVolume", "Volume 0–100", "playback.volume"),
    {
      definition: {
        handle: "vulkanchikQueueLength",
        description: "Pending queue length from last snapshot",
        categories: ["common"],
        possibleDataOutput: ["number", "text"],
      },
      evaluator: () => {
        const q = snapshotField("queue");
        return Array.isArray(q) ? q.length : 0;
      },
    },
    {
      definition: {
        handle: "vulkanchikSnapshotJson",
        description: "Full last GET /state snapshot as JSON",
        categories: ["advanced"],
        possibleDataOutput: ["text"],
      },
      evaluator: () => {
        const s = getRememberedSnapshot();
        return s ? JSON.stringify(s) : "";
      },
    },
    {
      definition: {
        handle: "vulkanchikRolesJson",
        description: "Last fetched roles JSON",
        categories: ["advanced"],
        possibleDataOutput: ["text"],
      },
      evaluator: () => getRememberedRolesJson() ?? "",
    },
    {
      definition: {
        handle: "vulkanchikQueueJson",
        description: "Pending queue array JSON from last snapshot",
        categories: ["advanced"],
        possibleDataOutput: ["text"],
      },
      evaluator: () => {
        const q = snapshotField("queue");
        return q ? JSON.stringify(q) : "[]";
      },
    },
  ];
}
