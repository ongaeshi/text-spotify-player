import React, { useEffect, useState, useRef } from 'react';
import { getSpotifyApi } from '../spotify';

interface WebPlaybackProps {
  onDeviceReady: (deviceId: string) => void;
}

export const WebPlayback: React.FC<WebPlaybackProps> = ({ onDeviceReady }) => {
  const [player, setPlayer] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(true);
  
  const isInitializing = useRef(false);

  useEffect(() => {
    if (isInitializing.current || player) return;
    isInitializing.current = true;
    
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    document.body.appendChild(script);

    (window as any).onSpotifyWebPlaybackSDKReady = async () => {
      const api = getSpotifyApi();
      if (!api) return;

      const accessToken = await api.getAccessToken();
      if (!accessToken) return;

      const spotifyPlayer = new (window as any).Spotify.Player({
        name: 'Text Spotify Player PWA',
        getOAuthToken: (cb: (token: string) => void) => { cb(accessToken.access_token); },
        volume: 0.5
      });

      setPlayer(spotifyPlayer);

      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Ready with Device ID', device_id);
        onDeviceReady(device_id);
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline', device_id);
      });

      spotifyPlayer.addListener('player_state_changed', (state: any) => {
        if (!state) return;
        setCurrentTrack(state.track_window.current_track);
        setIsPaused(state.paused);
        
        spotifyPlayer.getCurrentState().then((s: any) => {
          (!s)? setIsActive(false) : setIsActive(true);
        });
      });

      spotifyPlayer.connect();
    };

    return () => {
      if (player) player.disconnect();
    };
  }, [player, onDeviceReady]);

  if (!isActive && !currentTrack) {
    return null; // Don't show anything if nothing is playing
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 p-4 flex items-center justify-between">
      {currentTrack ? (
        <div className="flex items-center space-x-4">
          {currentTrack.album.images[0]?.url && (
            <img src={currentTrack.album.images[0].url} alt="" className="w-14 h-14 rounded" />
          )}
          <div>
            <div className="font-bold text-white">{currentTrack.name}</div>
            <div className="text-sm text-gray-400">
              {currentTrack.artists.map((a: any) => a.name).join(', ')}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">Loading playback...</div>
      )}
      
      <div className="flex space-x-4">
        <button 
          onClick={() => { player.togglePlay() }}
          className="bg-primary hover:bg-primary-hover rounded-full w-12 h-12 flex items-center justify-center text-white"
        >
          {isPaused ? "▶" : "⏸"}
        </button>
      </div>
    </div>
  );
};
