// Central API base URL for the backend.
// Override at build/deploy time with the VITE_API_URL environment variable.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
