import React from 'react';
import { initializeSpotify } from '../spotify';
import { Music } from 'lucide-react';

export const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const handleLogin = async () => {
    const api = await initializeSpotify();
    if (api) {
      try {
        await api.authenticate();
        onLogin();
      } catch (e) {
        console.error("Authentication failed", e);
      }
    } else {
      alert("Spotify Client ID is not configured. Please create an .env file with VITE_SPOTIFY_CLIENT_ID.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="p-8 bg-surface rounded-2xl shadow-xl flex flex-col items-center max-w-sm w-full">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-6">
          <Music className="text-white w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Text Spotify Player</h1>
        <p className="text-gray-400 text-center mb-8">
          Paste artist and title to play your music directly in the browser.
        </p>
        <button 
          onClick={handleLogin}
          className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-full transition-colors w-full"
        >
          Login with Spotify
        </button>
      </div>
    </div>
  );
};
