import React, { useState } from 'react';
import { getSpotifyApi } from '../spotify';
import { Play } from 'lucide-react';

interface PlayerProps {
  deviceId: string | null;
}

export const Player: React.FC<PlayerProps> = ({ deviceId }) => {
  const [text, setText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState('');

  const parseLine = (line: string) => {
    // Matches "Artist / Title" or "Artist - Title"
    const match = line.match(/^(.*?)\s*[/\\-]\s*(.*)$/);
    if (match) {
      return { artist: match[1].trim(), title: match[2].trim() };
    }
    return null;
  };

  const handlePlay = async () => {
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return;

    if (!deviceId) {
      setMessage("Player is not ready yet. Please wait.");
      return;
    }

    const firstLine = lines[0];
    const parsed = parseLine(firstLine);
    
    let query = '';
    if (parsed) {
      query = `artist:${parsed.artist} track:${parsed.title}`;
    } else {
      query = firstLine; // fallback to general search
    }

    setIsSearching(true);
    setMessage(`Searching for: ${firstLine}...`);

    try {
      const api = getSpotifyApi();
      if (!api) throw new Error("API not initialized");

      const searchResults = await api.search(query, ["track"], undefined, 1);
      
      if (searchResults.tracks.items.length > 0) {
        const track = searchResults.tracks.items[0];
        setMessage(`Playing: ${track.artists[0].name} - ${track.name}`);
        
        await api.player.startResumePlayback(deviceId, undefined, [track.uri]);
      } else {
        setMessage(`Not found: ${firstLine}`);
      }
    } catch (e) {
      console.error(e);
      setMessage("Error searching or playing track.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background pt-12 px-4 pb-32">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-6">Text Player</h1>
        <p className="text-gray-400 mb-4">Paste multiple lines in the format: <strong>Artist / Title</strong></p>
        
        <textarea 
          className="w-full h-64 bg-surface text-white p-4 rounded-xl border border-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary mb-4"
          placeholder="e.g.&#10;The Beatles / Let It Be&#10;Queen - Bohemian Rhapsody"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-400">
            {message && <span className={message.startsWith('Error') || message.startsWith('Not found') ? 'text-red-400' : 'text-green-400'}>{message}</span>}
          </div>
          <button 
            onClick={handlePlay}
            disabled={isSearching || text.trim() === ''}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full transition-colors flex items-center space-x-2"
          >
            <Play className="w-5 h-5" fill="currentColor" />
            <span>Play First Line</span>
          </button>
        </div>
      </div>
    </div>
  );
};
