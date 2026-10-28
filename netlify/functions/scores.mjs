// Netlify Function: the shared high-score tables, kept in Netlify Blobs (see ../score-table.mjs).
import { getStore } from "@netlify/blobs";
import { makeScoreApi } from "../score-table.mjs";

export default makeScoreApi(() => getStore({ name: "cricketlab-scores", consistency: "strong" }));

export const config = { path: "/api/scores" };
