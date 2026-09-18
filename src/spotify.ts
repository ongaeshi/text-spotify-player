import { SpotifyApi, Scopes } from "@spotify/web-api-ts-sdk";

// Client ID should be stored in an environment variable .env: VITE_SPOTIFY_CLIENT_ID
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
const redirectUrl = window.location.origin;

export let spotifyApi: SpotifyApi | null = null;

export const initializeSpotify = async () => {
  if (!clientId) {
    console.error("VITE_SPOTIFY_CLIENT_ID is not defined.");
    return null;
  }
  
  if (!spotifyApi) {
    spotifyApi = SpotifyApi.withUserAuthorization(clientId, redirectUrl, [
      ...Scopes.playlistModify,
      ...Scopes.playlistRead,
      ...Scopes.userPlaybackRead,
      ...Scopes.userPlaybackModify,
      "streaming",
      "user-read-email",
      "user-read-private"
    ]);
  }
  
  // Note: withUserAuthorization will automatically handle token exchange
  // if the URL contains code & state parameters from Spotify redirect.
  return spotifyApi;
};

export const getSpotifyApi = () => spotifyApi;
